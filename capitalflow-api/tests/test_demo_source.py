"""Tests read real temporary files; no production JSON or database writes."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.legacy_bank_sync import demo_source

class JsonSourceTest(unittest.TestCase):
    def setUp(self):
        self.document = json.loads(demo_source.DATA_PATH.read_text(encoding='utf-8'))
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'data.json'
        self.patch = patch.object(demo_source, 'DATA_PATH', self.path)
        self.patch.start()
        self.write()

    def tearDown(self):
        self.patch.stop()
        self.temp.cleanup()

    def write(self):
        self.path.write_text(json.dumps(self.document, ensure_ascii=False), encoding='utf-8')

    def test_reloads_file_and_supports_utf8_bom(self):
        before = demo_source.read_source('TCB').balance
        self.document['accounts']['TCB']['events'].append({'id': 'tcb-extra', 'date': '2026-10-22',
            'amount': '-100000', 'description': 'New event', 'status': 'BOOKED'})
        self.path.write_text(json.dumps(self.document), encoding='utf-8-sig')
        self.assertEqual(demo_source.read_source('TCB').balance, before - 100000)

    def test_rejects_malformed_events(self):
        original = dict(self.document['accounts']['TCB']['events'][0])
        for field, values in {'id': ['', 'has space'], 'date': ['2026-02-30', '20261022', 0],
                              'amount': ['NaN', 'Infinity', '0', '1.111', 1.5, '1e30'],
                              'status': ['SUCCESS'], 'description': ['']}.items():
            for value in values:
                with self.subTest(field=field, value=value):
                    self.document['accounts']['TCB']['events'][0] = {**original, field: value}
                    self.write()
                    with self.assertRaises(demo_source.SourceUnavailable):
                        demo_source.read_source('TCB')

    def test_duplicate_ids_and_keys_rejected(self):
        self.document['accounts']['TCB']['events'].append(self.document['accounts']['TCB']['events'][0])
        self.write()
        with self.assertRaises(demo_source.SourceUnavailable):
            demo_source.read_source('TCB')
        self.path.write_text('{"schema_version":1,"schema_version":1,"accounts":{}}', encoding='utf-8')
        with self.assertRaises(demo_source.SourceUnavailable):
            demo_source.read_source('TCB')

    def test_missing_and_truncated_file_rejected(self):
        self.path.unlink()
        with self.assertRaises(demo_source.SourceUnavailable):
            demo_source.read_source('TCB')
        self.path.write_text('{', encoding='utf-8')
        with self.assertRaises(demo_source.SourceUnavailable):
            demo_source.read_source('TCB')

if __name__ == '__main__':
    unittest.main()
