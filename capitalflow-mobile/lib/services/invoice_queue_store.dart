import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:sqflite/sqflite.dart';
import '../core/file_digest.dart';

String queueScope(String server, String owner) =>
    sha256.convert(utf8.encode('$server|$owner')).toString();
String queueId() {
  final random = Random.secure();
  return List.generate(
      24, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
}

class QueueSession {
  QueueSession(
      this.scope, this.owner, this.server, this.generation, this.paused);
  final String scope, owner, server;
  final int generation;
  final bool paused;
}

class QueuedInvoice {
  QueuedInvoice(this.data);
  final Map<String, Object?> data;
  String get id => data['id'] as String;
  String get scope => data['scope'] as String;
  String get name => data['filename'] as String;
  String get source => data['source'] as String;
  String get state => data['state'] as String;
  String get stage => data['stage'] as String;
  String get requestKey => data['request_key'] as String;
  String get hash => data['sha256'] as String;
  String? get remoteId => data['remote_id'] as String?;
  String? get outcome => data['outcome'] as String?;
  String? get error => data['error'] as String?;
  String? get lease => data['lease_id'] as String?;
  int get attempts => data['attempts'] as int;
  int get nextAttempt => data['next_attempt'] as int;
  int get createdAt => data['created_at'] as int;
  int get size => data['byte_length'] as int;
  bool get sending =>
      (data['lease_until'] as int) > DateTime.now().millisecondsSinceEpoch;
}

class QueueInterrupted implements Exception {}

/// Metadata and bytes commit together. Android's private database is excluded
/// from backup by the application manifest; no gallery/cache file references.
class InvoiceQueueStore {
  InvoiceQueueStore(this.db, {DateTime Function()? clock})
      : now = clock ?? DateTime.now;
  final Database db;
  final DateTime Function() now;
  static const maxFiles = 20;
  static const maxBytes = 100 * 1024 * 1024;
  static const metadata = [
    'id',
    'scope',
    'filename',
    'source',
    'sha256',
    'byte_length',
    'request_key',
    'stage',
    'state',
    'attempts',
    'next_attempt',
    'created_at',
    'updated_at',
    'remote_id',
    'outcome',
    'error',
    'lease_id',
    'lease_until'
  ];
  int get timestamp => now().millisecondsSinceEpoch;

  static Future<InvoiceQueueStore> open(
      {String? path,
      DatabaseFactory? factory,
      DateTime Function()? clock}) async {
    final f = factory ?? databaseFactory;
    final databasePath =
        path ?? '${await f.getDatabasesPath()}/capitalflow_invoice_queue.db';
    final db = await f.openDatabase(databasePath,
        options: OpenDatabaseOptions(
            version: 1,
            singleInstance: false,
            onConfigure: (db) async {
              // These pragmas return rows; Android rejects them via execute().
              await db.rawQuery('PRAGMA busy_timeout=5000');
              await db.rawQuery('PRAGMA secure_delete=ON');
              await db.execute('PRAGMA auto_vacuum=FULL');
            },
            onCreate: (db, _) async {
              await db.execute(
                  'CREATE TABLE active_session (id INTEGER PRIMARY KEY, scope TEXT, owner TEXT, server TEXT, generation INTEGER NOT NULL)');
              await db.insert('active_session', {'id': 1, 'generation': 0});
              await db.execute(
                  'CREATE TABLE scopes (scope TEXT PRIMARY KEY, paused INTEGER NOT NULL DEFAULT 0)');
              await db.execute('''CREATE TABLE invoice_queue (
          id TEXT PRIMARY KEY, scope TEXT NOT NULL, filename TEXT NOT NULL, source TEXT NOT NULL,
          sha256 TEXT NOT NULL, byte_length INTEGER NOT NULL, content BLOB, request_key TEXT NOT NULL,
          stage TEXT NOT NULL DEFAULT 'upload', state TEXT NOT NULL DEFAULT 'waiting',
          attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, remote_id TEXT, outcome TEXT, error TEXT,
          lease_id TEXT, lease_until INTEGER NOT NULL DEFAULT 0)''');
              await db.execute(
                  "CREATE UNIQUE INDEX queue_pending_hash ON invoice_queue(scope, sha256) WHERE state != 'done'");
              await db.execute(
                  'CREATE INDEX queue_due ON invoice_queue(scope, state, next_attempt)');
              await db.execute(
                  'CREATE TABLE picker_intent (id INTEGER PRIMARY KEY, scope TEXT NOT NULL, source TEXT NOT NULL)');
            }));
    return InvoiceQueueStore(db, clock: clock);
  }

  Future<QueueSession?> active([DatabaseExecutor? executor]) async {
    final rows = await (executor ?? db).rawQuery(
        'SELECT a.*, COALESCE(s.paused,0) AS paused FROM active_session a LEFT JOIN scopes s ON s.scope=a.scope WHERE a.id=1');
    final row = rows.single;
    if (row['scope'] == null) return null;
    return QueueSession(row['scope'] as String, row['owner'] as String,
        row['server'] as String, row['generation'] as int, row['paused'] == 1);
  }

  Future<QueueSession> activate(String server, String owner) =>
      db.transaction((tx) async {
        final scope = queueScope(server, owner);
        await tx.insert('scopes', {'scope': scope},
            conflictAlgorithm: ConflictAlgorithm.ignore);
        await tx.rawUpdate(
            'UPDATE active_session SET scope=?, owner=?, server=?, generation=generation+1 WHERE id=1',
            [scope, owner, server]);
        // A restarted session may supersede a crashed sender. The persisted request
        // key still protects a request which reached the server before the crash.
        await tx.rawUpdate(
            "UPDATE invoice_queue SET lease_id=NULL, lease_until=0, state=CASE WHEN state='auth' THEN 'waiting' ELSE state END WHERE scope=?",
            [scope]);
        return (await active(tx))!;
      });

  Future<void> deactivate() async {
    await db.rawUpdate(
        'UPDATE active_session SET scope=NULL, owner=NULL, server=NULL, generation=generation+1 WHERE id=1');
  }

  Future<void> assertActive(QueueSession session,
      {bool sending = false, String? id, String? lease}) async {
    final current = await active();
    if (current == null ||
        current.scope != session.scope ||
        current.generation != session.generation ||
        (sending && current.paused)) {
      throw QueueInterrupted();
    }
    if (id != null &&
        (await db.query('invoice_queue',
                columns: ['id'],
                where: 'id=? AND scope=? AND lease_id=?',
                whereArgs: [id, session.scope, lease]))
            .isEmpty) {
      throw QueueInterrupted();
    }
  }

  Future<QueuedInvoice> enqueue(QueueSession session, Uint8List bytes,
      String filename, String source) async {
    if (bytes.isEmpty || bytes.length > 10 * 1024 * 1024) {
      throw StateError('Tệp phải từ 1 byte đến 10 MB.');
    }
    final hash = await fileDigest(bytes);
    return db.transaction((tx) async {
      final current = await active(tx);
      if (current?.scope != session.scope ||
          current?.generation != session.generation) {
        throw QueueInterrupted();
      }
      final old = await tx.query('invoice_queue',
          columns: metadata,
          where: "scope=? AND sha256=? AND state!='done'",
          whereArgs: [session.scope, hash]);
      if (old.isNotEmpty) return QueuedInvoice(old.first);
      final totals = (await tx.rawQuery(
              "SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(content)),0) AS bytes FROM invoice_queue WHERE state!='done'"))
          .single;
      if ((totals['n'] as int) >= maxFiles ||
          (totals['bytes'] as int) + bytes.length > maxBytes) {
        throw StateError(
            'Bộ nhớ hàng đợi đã đầy (20 tệp hoặc 100 MB). Hãy gửi hoặc xóa bớt bản chờ.');
      }
      final id = queueId();
      await tx.insert('invoice_queue', {
        'id': id,
        'scope': session.scope,
        'filename': filename,
        'source': source,
        'sha256': hash,
        'byte_length': bytes.length,
        'content': bytes,
        'request_key': 'q-$id',
        'created_at': timestamp,
        'updated_at': timestamp
      });
      return QueuedInvoice((await tx.query('invoice_queue',
              columns: metadata, where: 'id=?', whereArgs: [id]))
          .single);
    });
  }

  Future<List<QueuedInvoice>> list(String scope) async =>
      (await db.query('invoice_queue',
              columns: metadata,
              where: 'scope=?',
              whereArgs: [scope],
              orderBy: 'created_at DESC'))
          .map(QueuedInvoice.new)
          .toList();

  Future<QueuedInvoice?> claim(QueueSession session) =>
      db.transaction((tx) async {
        final current = await active(tx);
        if (current?.scope != session.scope ||
            current?.generation != session.generation ||
            current!.paused) {
          return null;
        }
        final rows = await tx.query('invoice_queue',
            columns: metadata,
            where:
                "scope=? AND state IN ('waiting','retry') AND next_attempt<=? AND lease_until<=?",
            whereArgs: [session.scope, timestamp, timestamp],
            orderBy: 'created_at, rowid',
            limit: 1);
        if (rows.isEmpty) return null;
        final lease = queueId();
        final job = {
          ...rows.single,
          'lease_id': lease,
          'lease_until': timestamp + const Duration(minutes: 8).inMilliseconds
        };
        await tx.update('invoice_queue',
            {'lease_id': lease, 'lease_until': job['lease_until']},
            where: 'id=?', whereArgs: [job['id']]);
        return QueuedInvoice(job);
      });

  Future<Uint8List> bytes(QueuedInvoice job) async {
    // Keep each row below Android CursorWindow limits, including 10 MB files.
    const chunkSize = 512 * 1024;
    final builder = BytesBuilder(copy: false);
    for (var offset = 0; offset < job.size; offset += chunkSize) {
      final rows = await db.rawQuery(
          'SELECT substr(content,?,?) AS chunk FROM invoice_queue WHERE id=? AND scope=? AND lease_id=?',
          [offset + 1, chunkSize, job.id, job.scope, job.lease]);
      if (rows.isEmpty) throw QueueInterrupted();
      final chunk = rows.single['chunk'];
      if (chunk is! Uint8List || chunk.isEmpty) break;
      builder.add(chunk);
    }
    final value = builder.takeBytes();
    if (value.length != job.size || await fileDigest(value) != job.hash) {
      throw StateError(
          'Ảnh lưu trên thiết bị không còn nguyên vẹn. Hãy xóa bản chờ và chọn lại ảnh.');
    }
    return value;
  }

  Future<bool> update(QueuedInvoice job, Map<String, Object?> fields) async =>
      (await db.update('invoice_queue', {...fields, 'updated_at': timestamp},
          where: 'id=? AND scope=? AND lease_id=?',
          whereArgs: [job.id, job.scope, job.lease])) ==
      1;

  Future<void> pause(String scope, bool paused) async =>
      db.update('scopes', {'paused': paused ? 1 : 0},
          where: 'scope=?', whereArgs: [scope]);

  // Only the foreground client may retry jobs waiting for token refresh.
  Future<void> resumeAuth(QueueSession session) => db.transaction((tx) async {
        final current = await active(tx);
        if (current?.scope != session.scope ||
            current?.generation != session.generation ||
            current!.paused) {
          return;
        }
        await tx.update('invoice_queue',
            {'state': 'waiting', 'next_attempt': 0, 'error': null},
            where: "scope=? AND state='auth' AND lease_until<=?",
            whereArgs: [session.scope, timestamp]);
      });
  Future<void> retry(String scope, String id) async => db.update(
      'invoice_queue', {'state': 'waiting', 'error': null, 'next_attempt': 0},
      where: "id=? AND scope=? AND state!='done' AND lease_until<=?",
      whereArgs: [id, scope, timestamp]);
  Future<void> remove(String scope, String id) async =>
      db.delete('invoice_queue',
          where: 'id=? AND scope=?', whereArgs: [id, scope]);
  Future<void> prune() async {
    await db.delete('invoice_queue',
        where: "state='done' AND updated_at<?",
        whereArgs: [timestamp - const Duration(days: 7).inMilliseconds]);
    await db.execute(
        "DELETE FROM invoice_queue WHERE state='done' AND id NOT IN (SELECT id FROM invoice_queue WHERE state='done' ORDER BY updated_at DESC LIMIT 200)");
  }

  Future<void> rememberPicker(QueueSession session, String source) async {
    await assertActive(session);
    await db.insert(
        'picker_intent', {'id': 1, 'scope': session.scope, 'source': source},
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<Map<String, Object?>?> pickerIntent() async {
    final rows = await db.query('picker_intent');
    return rows.isEmpty ? null : rows.single;
  }

  Future<void> clearPicker({String? scope}) async => db.delete('picker_intent',
      where: scope == null ? null : 'scope=?',
      whereArgs: scope == null ? null : [scope]);
}
