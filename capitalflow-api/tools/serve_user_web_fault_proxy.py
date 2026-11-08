"""Local GUI fault injection; refuses any non-disposable upstream database.

Run with --expected-database cf_userweb_test_<12hex>. The real test API stays
running on 8011; point only the isolated Next portal at this proxy on 8012.
No authorization headers, passwords or response bodies are logged.
"""
from __future__ import annotations

import argparse
import json
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

import httpx

UPSTREAM = "http://127.0.0.1:8011"
state = {"mode": "off", "matched": 0, "completed": 0, "upstream_status": None}
lock = threading.Lock()
client = httpx.Client(timeout=100, follow_redirects=False)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def reply(self, status, body, headers=None):
        self.send_response(status)
        for key, value in (headers or {"Content-Type": "application/json"}).items():
            if key.lower() not in {"connection", "transfer-encoding", "content-length", "content-encoding"}:
                self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def handle_request(self):
        route = urlsplit(self.path).path
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        if route == "/__fault":
            with lock:
                if self.command == "POST":
                    try:
                        mode = json.loads(body)["mode"]
                    except (ValueError, KeyError):
                        return self.reply(422, b'{"detail":"Invalid fault configuration"}')
                    if mode not in {"off", "fail_read", "delay_read", "lose_payment_response"}:
                        return self.reply(422, b'{"detail":"Invalid mode"}')
                    state.update(mode=mode, matched=0, completed=0, upstream_status=None)
                snapshot = dict(state)
            return self.reply(200, json.dumps(snapshot).encode())
        if not route.startswith("/api/v1/"):
            return self.reply(404, b'{}')
        with lock:
            mode = state["mode"]
            matched = (self.command == "GET" and route == "/api/v1/bookkeeping" and mode in {"fail_read", "delay_read"}) or (
                self.command == "POST" and re.fullmatch(r"/api/v1/wallets/[0-9a-f-]+/payments/create", route) and mode == "lose_payment_response")
            if matched:
                state["matched"] += 1
        if matched and mode == "fail_read":
            return self.reply(503, b'{"detail":"Controlled test: API read unavailable"}')
        if matched and mode == "delay_read":
            time.sleep(3)
        headers = {k: v for k, v in self.headers.items() if k.lower() not in {"host", "content-length", "connection", "accept-encoding"}}
        try:
            response = client.request(self.command, UPSTREAM + self.path, headers=headers, content=body)
        except httpx.HTTPError:
            return self.reply(503, b'{"detail":"Test upstream unavailable"}')
        if matched:
            with lock:
                state["completed"] += 1
                state["upstream_status"] = response.status_code
                if mode == "lose_payment_response" and response.is_success:
                    state["mode"] = "off"
            if mode == "lose_payment_response" and response.is_success:
                return self.reply(503, b'{"detail":"Controlled test: response lost after commit; retry the same request"}')
        self.reply(response.status_code, response.content, dict(response.headers))

    do_GET = do_POST = do_PATCH = do_DELETE = do_PUT = do_OPTIONS = handle_request


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected-database", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"cf_userweb_test_[0-9a-f]{12}", args.expected_database):
        raise SystemExit("Disposable database name required")
    actual = client.get(UPSTREAM + "/api/v1/__test/status").json()["database"]
    if actual != args.expected_database:
        raise SystemExit("Upstream test database mismatch")
    print("Isolated GUI fault proxy on 127.0.0.1:8012", flush=True)
    try:
        ThreadingHTTPServer(("127.0.0.1", 8012), Handler).serve_forever()
    finally:
        client.close()
