"""Run the normal API on loopback against the approved isolated SQL QA DB."""
import runtime
import uvicorn
from pathlib import Path

if __name__ == '__main__':
    upload = Path(runtime.config['UPLOAD_DIR']).resolve()
    if upload != (runtime.ROOT / 'demo-uploads').resolve():
        raise RuntimeError('Demo refuses storage outside demo-uploads.')
    upload.mkdir(exist_ok=True)
    uvicorn.run('app.main:app', host='127.0.0.1', port=8028)
