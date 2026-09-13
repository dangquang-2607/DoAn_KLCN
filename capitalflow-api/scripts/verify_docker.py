"""Verify built API/worker images with isolated credentials, SQLite and no network.

Run from capitalflow-api after docker compose build. No real queue is consumed.
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

    isolated(api_image, ["python", "-m", "pip", "check"])
    isolated(api_image, ["python", "-c", "from pathlib import Path; import pyodbc; assert not Path('/app/.env').exists(); assert not Path('/app/.venv').exists(); assert 'ODBC Driver 18 for SQL Server' in pyodbc.drivers(); print('Image isolation and ODBC driver: PASS')"])
    isolated(api_image, ["python", "-m", "pytest", "-q"])
    isolated(worker_image, ["python", "-c", "import sys, runpy; import app.models; from app.models.base import Base; from app.core.database import engine; Base.metadata.create_all(engine); sys.argv=['worker','--once']; runpy.run_module('app.services.worker',run_name='__main__'); print('Worker CLI, empty isolated queue: PASS')"])

    name = "capitalflow-build-check-" + uuid4().hex[:12]
    start = "from pathlib import Path; import os; Path(os.environ['UPLOAD_DIR']).mkdir(); os.execvp('uvicorn',['uvicorn','app.main:app','--host','0.0.0.0','--port','8000'])"
    try:
        run(["run", "-d", "--name", name, "--network", "none", *env_args, api_image, "python", "-c", start], capture_output=True)
        probe = "import json, urllib.request; base='http://127.0.0.1:8000'; assert json.load(urllib.request.urlopen(base+'/health',timeout=3))['status']=='ok'; assert json.load(urllib.request.urlopen(base+'/ready',timeout=3))['status']=='ready'; assert '/api/v1/accounts' in json.load(urllib.request.urlopen(base+'/openapi.json',timeout=3))['paths']"
        for attempt in range(20):
            result = subprocess.run(["docker", "exec", name, "python", "-c", probe], capture_output=True)
            if result.returncode == 0:break
            if attempt == 19:raise RuntimeError("Container HTTP health/readiness/OpenAPI check failed")
            time.sleep(1)
        print("API process: /health, /ready, /openapi.json PASS (isolated SQLite)", flush=True)
    finally:
        subprocess.run(["docker", "rm", "-f", name], capture_output=True, check=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-image", default="capitalflow-api-capitalflow-api")
    parser.add_argument("--worker-image", default="capitalflow-api-capitalflow-worker")
    args = parser.parse_args()
    verify(args.api_image, args.worker_image)
