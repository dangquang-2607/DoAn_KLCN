"""Xác minh image API/worker production bằng credential cô lập và không có mạng.

Vai trò: kiểm tra dependency, runtime whitelist, ODBC, worker CLI và HTTP contract.
Đầu vào: tên image API/worker đã build và Docker daemon cục bộ.
Đầu ra/side effect: container tạm cùng kết quả PASS/exit code.
Ràng buộc an toàn: ``--network none``, SQLite tạm, credential ngẫu nhiên và cleanup container.
"""
import argparse
import base64
import os
import secrets
import subprocess
import time
from uuid import uuid4


def verify(api_image, worker_image):
    env = os.environ.copy()
    env.update(
        DATABASE_URL="sqlite:////tmp/docker-verification.db",
        JWT_SECRET_KEY=secrets.token_hex(32),
        JOB_ENCRYPTION_KEY=base64.urlsafe_b64encode(secrets.token_bytes(32)).decode(),
        UPLOAD_DIR="/tmp/docker-verification-uploads",
        APP_ENV="docker-verification",
    )
    env_args = [part for name in ("DATABASE_URL", "JWT_SECRET_KEY", "JOB_ENCRYPTION_KEY", "UPLOAD_DIR", "APP_ENV") for part in ("-e", name)]

    def run(args, **kwargs):
        return subprocess.run(["docker", *args], env=env, check=True, **kwargs)

    def isolated(image, command):
        run(["run", "--rm", "--network", "none", *env_args, image, *command])

    # Các probe tĩnh chạy không có mạng để chứng minh image chỉ chứa runtime,
    # Kiểm tra dependency không hỏng và worker xử lý hàng đợi rỗng không gây tác dụng phụ.
    isolated(api_image, ["python", "-m", "pip", "check"])
    isolated(api_image, ["python", "-c", "from pathlib import Path; import pyodbc; assert not Path('/app/.env').exists(); assert not Path('/app/.venv').exists(); assert not Path('/app/tests').exists(); assert not Path('/app/scripts').exists(); assert not Path('/app/docs').exists(); assert not Path('/app/migrations').exists(); assert not Path('/app/alembic').exists(); assert 'ODBC Driver 18 for SQL Server' in pyodbc.drivers(); print('Image isolation, runtime whitelist and ODBC driver: PASS')"])
    isolated(worker_image, ["python", "-c", "import sys, runpy; import app.shared.database.model_registry; from app.shared.database.base import Base; from app.shared.database.engine import engine; Base.metadata.create_all(engine); sys.argv=['worker','--once']; runpy.run_module('app.modules.jobs.runner',run_name='__main__'); print('Worker CLI, empty isolated queue: PASS')"])

    name = "capitalflow-build-check-" + uuid4().hex[:12]
    start = "from pathlib import Path; import os; Path(os.environ['UPLOAD_DIR']).mkdir(); os.execvp('uvicorn',['uvicorn','app.main:app','--host','0.0.0.0','--port','8000'])"
    try:
        # Container HTTP dùng SQLite và credential ngẫu nhiên trong mạng cô lập;
        # probe chỉ kiểm tra health, readiness và OpenAPI contract.
        run(["run", "-d", "--name", name, "--network", "none", *env_args, api_image, "python", "-c", start], capture_output=True)
        probe = "import json, urllib.request; base='http://127.0.0.1:8000'; assert json.load(urllib.request.urlopen(base+'/health',timeout=3))['status']=='ok'; assert json.load(urllib.request.urlopen(base+'/ready',timeout=3))['status']=='ready'; assert '/api/v1/accounts' in json.load(urllib.request.urlopen(base+'/openapi.json',timeout=3))['paths']"
        for attempt in range(20):
            result = subprocess.run(["docker", "exec", name, "python", "-c", probe], capture_output=True)
            if result.returncode == 0:break
            if attempt == 19:raise RuntimeError("Container HTTP health/readiness/OpenAPI check failed")
            time.sleep(1)
        print("API process: /health, /ready, /openapi.json PASS (isolated SQLite)", flush=True)
    finally:
        # Cleanup theo tên ngẫu nhiên chỉ tác động container do lần verify này tạo.
        subprocess.run(["docker", "rm", "-f", name], capture_output=True, check=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-image", default="capitalflow-api-capitalflow-api")
    parser.add_argument("--worker-image", default="capitalflow-api-capitalflow-worker")
    args = parser.parse_args()
    verify(args.api_image, args.worker_image)
