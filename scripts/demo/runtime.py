"""Load isolated demo configuration before any application import."""
import json
import os
import sys
from pathlib import Path
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[2]
config = json.loads((ROOT / '.demo.local.json').read_text(encoding='utf-8'))
if make_url(config['DATABASE_URL']).database != 'CapitalFlow_QA_20261008_b5fcca32':
    raise RuntimeError('Demo refuses a database outside the approved QA target.')
if config.get('APP_ENV') != 'demo-local-isolated':
    raise RuntimeError('Demo environment mismatch.')
os.environ.update(config)
sys.path.insert(0, str(ROOT / 'capitalflow-api'))
