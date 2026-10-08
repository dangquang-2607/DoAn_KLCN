"""Loopback-only smoke against isolated SQL demo. No email/worker/financial writes."""
import json
import re
from urllib.parse import urljoin
import httpx
import runtime
from sqlalchemy import text
from app.dung_chung.database.session import SessionLocal

with SessionLocal() as db:
    assert db.scalar(text('SELECT DB_NAME()')) == 'CapitalFlow_QA_20261008_b5fcca32'

results = []
def check(label, response, expected=200):
    results.append({'check': label, 'status': response.status_code, 'expected': expected})
    assert response.status_code == expected, f'{label}: {response.status_code}'

with httpx.Client(timeout=20, trust_env=False) as client:
    api = 'http://localhost:8028'
    health = client.get(api + '/health')
    check('API health', health)
    assert health.json()['env'] == 'demo-local-isolated'
    check('SQL and storage readiness', client.get(api + '/ready'))
    for port in (3028, 4028):
        base = f'http://localhost:{port}'
        page = client.get(base + '/login')
        check(f'web {port} login HTML', page)
        assets = re.findall(r'(?:src|href)="([^"\s]+\.(?:js|css)(?:\?[^"\s]*)?)"', page.text)
        assert assets, f'No static assets on {port}'
        for asset in set(assets):
            target = urljoin(base, asset)
            if not target.startswith(base + '/'):
                continue
            response = client.get(target)
            check(f'web {port} static asset', response)
            assert 'text/html' not in response.headers.get('content-type', '')
        cors = client.options(api + '/api/v1/auth/login', headers={
            'Origin': base, 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type',
        })
        check(f'CORS {port}', cors)
        assert cors.headers.get('access-control-allow-origin') == base
    for role in ('user', 'admin'):
        response = client.post(api + '/api/v1/auth/login', json={
            'email': f'demo-{role}@example.com', 'password': 'QA-local-only-2026!',
        })
        check(f'{role} login', response)
        tokens = response.json()
        try:
            headers = {'Authorization': 'Bearer ' + tokens['access_token']}
            check(f'{role} sessions', client.get(api + '/api/v1/auth/sessions', headers=headers))
            check(f'{role} admin boundary', client.get(api + '/api/v1/admin/overview', headers=headers), 200 if role == 'admin' else 403)
            refresh = client.post(api + '/api/v1/auth/refresh', json={'refresh_token': tokens['refresh_token']})
            check(f'{role} refresh', refresh)
            # Backend may rotate or return only an access token; preserve current refresh accordingly.
            tokens.update(refresh.json())
        finally:
            check(f'{role} logout', client.post(api + '/api/v1/auth/logout', json={'refresh_token': tokens['refresh_token']}), 204)
    check('anonymous admin denied', client.get(api + '/api/v1/admin/overview'), 401)
print(json.dumps({'environment': 'demo-local-isolated', 'checks': results, 'passed': True}, indent=2))
