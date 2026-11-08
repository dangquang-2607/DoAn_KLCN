"""Verify the web/mobile demo bill QR contract and decode generated QR modules with jsQR."""
from __future__ import annotations

import base64
import json
import re
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from fastapi import HTTPException
from pydantic import ValidationError
import qrcode

from app.main import app
from app.dung_chung.http.phu_thuoc import get_current_user
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.bill_qr import DemoBill, bill_signature, create_bill_qr, parse_bill_qr

def main():
    passed = 0
    body = {"merchant_name": "Quán nước",
            "items": [{"name": "Cà phê", "quantity": 2, "unit_price": "12.50"}]}
    data = create_bill_qr(DemoBill.model_validate(body), User())
    assert data["amount"] == "25.00"
    bill = parse_bill_qr(data["qr_payload"])
    assert bill.amount == 25
    assert re.fullmatch(r"HD-[A-Z2-7]{18}", data["bill_reference"])
    assert bill.bill_reference == data["bill_reference"]
    legacy_reference = "HD-" + "0123456789ABCDEF" * 2
    legacy = bill.model_copy(update={"bill_reference": legacy_reference})
    encoded = base64.urlsafe_b64encode(legacy.model_dump_json().encode()).decode().rstrip("=")
    legacy_qr = f"capitalflow://bill?v=2&data={encoded}&sig={bill_signature(encoded)}"
    assert parse_bill_qr(legacy_qr).bill_reference == legacy_reference
    passed += 5
    for values in ({"currency": "USD"}, {"merchant_name": " "}, {"merchant_name": "😀" * 76},
                   {"items": []}, {"items": [{"name": "X", "quantity": 0, "unit_price": "1"}]},
                   {"items": [{"name": "X", "quantity": 1, "unit_price": "1.001"}]},
                   {"items": [{"name": "X", "quantity": 1000, "unit_price": "99999999999999999.99"}]}):
        try:
            DemoBill.model_validate({**body, **values})
        except ValidationError:
            passed += 1
        else:
            raise AssertionError("Invalid bill accepted")
    for value in ("capitalflow://transfer?v=1&wallet_id=abc",
                  data["qr_payload"].replace("v=2", "v=1"), data["qr_payload"] + "&v=2",
                  "https://example.com/bill", data["qr_payload"] + "#fragment",
                  "capitalflow://bill?v=1&data=%", "capitalflow://bill?v=1&data=A"):
        try:
            parse_bill_qr(value)
        except HTTPException as exc:
            assert exc.status_code == 422
            passed += 1
        else:
            raise AssertionError("Invalid QR accepted")
    raw = json.dumps({**body, "amount": "1.00"}).encode()
    forged = "capitalflow://bill?v=1&data=" + base64.urlsafe_b64encode(raw).decode().rstrip("=")
    try:
        parse_bill_qr(forged)
    except HTTPException as exc:
        assert exc.status_code == 422
        passed += 1
    else:
        raise AssertionError("Mismatching total accepted")

    # No database writes or actual SMTP/Gemini requests.
    overrides = app.dependency_overrides.copy()
    try:
        with patch("app.dung_chung.http.trung_gian.kiem_toan._write_audit_log"), TestClient(app) as client:
            for path in ("/api/v1/wallets/bills/qr", "/api/v1/wallets/bills/resolve"):
                assert client.post(path, json={}).status_code == 401
                passed += 1
            app.dependency_overrides[get_current_user] = lambda: SimpleNamespace()
            result = client.post("/api/v1/wallets/bills/qr", json=body)
            assert result.status_code == 200
            passed += 1
            result = client.post("/api/v1/wallets/bills/resolve", json={"qr_payload": data["qr_payload"]})
            assert result.status_code == 200 and result.json()["amount"] == "25.00"
            passed += 1
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(overrides)

    # Decode independent RGBA pixel data using the very library shipped to user-web.
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=4)
    qr.add_data(data["qr_payload"])
    qr.make(fit=True)
    matrix = qr.get_matrix()
    node = r"""
const jsQR = require('jsqr');
let raw = '';process.stdin.on('data',chunk=>raw+=chunk);
process.stdin.on('end',()=>{
  const { matrix, payload }=JSON.parse(raw), scale=8, width=matrix.length*scale;
  const pixels=new Uint8ClampedArray(width*width*4);
  for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    const at=(y*width+x)*4, value=matrix[Math.floor(y/scale)][Math.floor(x/scale)]?0:255;
    pixels[at]=pixels[at+1]=pixels[at+2]=value;pixels[at+3]=255;
  }
  const result=jsQR(pixels,width,width);
  if(!result||result.data!==payload)throw new Error('QR cannot be read by shipped scanner');
  process.stdout.write('QR pixel decoding passed');
});
"""
    web = Path(__file__).resolve().parents[2] / "frontend" / "user-web"
    result = subprocess.run(["node", "-e", node], cwd=web, input=json.dumps({"matrix": matrix, "payload": data["qr_payload"]}),
                            text=True, capture_output=True, check=True, timeout=20)
    assert "passed" in result.stdout
    passed += 1
    print(json.dumps({"passed": passed, "qr_image_decode": True, "real_emails_sent": 0, "real_gemini_calls": 0}))

if __name__ == "__main__":
    main()
