"""Register this deployment's webhook; prints no keys, banking details or provider body."""
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from app.dung_chung.config import settings


def main():
    if not all((settings.payos_client_id, settings.payos_api_key, settings.payos_checksum_key)):
        raise SystemExit("payOS keys are incomplete in capitalflow-api/.env")
    frontend = settings.frontend_url.rstrip("/")
    url = urlparse(frontend)
    if url.scheme != "https" or url.netloc != "app.capitalflow.online" or url.path:
        raise SystemExit("Verify the production frontend URL before registering the webhook")
    webhook = frontend + "/api/v1/billing/payos/webhook"
    try:
        with httpx.Client(timeout=30, follow_redirects=False) as client:
            response = client.post("https://api-merchant.payos.vn/confirm-webhook",
                headers={"x-client-id": settings.payos_client_id, "x-api-key": settings.payos_api_key},
                json={"webhookUrl": webhook})
            payload = response.json()
        if response.status_code != 200 or payload.get("code") != "00":
            code = str(payload.get("code", "unknown"))[:16]
            print({"webhook_confirmed": False, "http_status": response.status_code,
                   "provider_code": code if code.isalnum() else "unknown"})
            raise SystemExit(1)
        print({"webhook_confirmed": True, "webhook_url": webhook})
    except (httpx.HTTPError, ValueError):
        raise SystemExit("Webhook registration could not be verified; no provider response or keys were logged") from None


if __name__ == "__main__":
    main()
