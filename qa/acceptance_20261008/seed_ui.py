"""Seed only the explicitly isolated loopback QA server, never port 8000."""
from datetime import date
from uuid import uuid4
import httpx

with httpx.Client(base_url='http://127.0.0.1:8018',timeout=20) as client:
    assert client.get('/health').json()['env']=='qa-local-isolated'
    login=client.post('/api/v1/auth/login',json={'email':'qa-user@example.com','password':'QA-local-only-2026!'});login.raise_for_status()
    client.headers['Authorization']='Bearer '+login.json()['access_token']
    def post(path,data):
        r=client.post('/api/v1/'+path,json=data,headers={'Idempotency-Key':str(uuid4())});r.raise_for_status();return r.json()
    a=post('accounts',{'name':'Ví tiền mặt QA','account_type':'CASH','balance':1000000})
    b=post('accounts',{'name':'Tiết kiệm QA','account_type':'BANK','balance':2000000})
    cats=client.get('/api/v1/categories').json()
    expense=next(c['id'] for c in cats if c['type']=='EXPENSE')
    income=next(c['id'] for c in cats if c['type']=='INCOME')
    for kind,amount,cat,description in [('INCOME',5000000,income,'Lương kiểm thử'),('EXPENSE',65000,expense,'Cà phê kiểm thử'),('EXPENSE',120000,expense,'Ăn trưa kiểm thử')]:
        post('transactions',{'account_id':a['id'],'type':kind,'amount':amount,'category_id':cat,'description':description,'transaction_date':str(date.today())})
    post('budgets',{'name':'Ăn uống tháng này QA','category_id':expense,'amount_limit':1000000,'start_date':str(date.today().replace(day=1)),'end_date':str(date.today().replace(day=28))})
    xml=b'<HDon><DLHDon><TTChung><SHDon>QA20261008</SHDon><NLap>2026-10-08</NLap></TTChung><NDHDon><NBan><Ten>QA Store</Ten></NBan><DSHHDVu><HHDVu><THHDVu>QA Item</THHDVu><SLuong>1</SLuong><DGia>100000</DGia><ThTien>100000</ThTien></HHDVu></DSHHDVu><TToan><TgTCThue>100000</TgTCThue><TgTThue>10000</TgTThue><TgTTTBSo>110000</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>'
    r=client.post('/api/v1/invoices',files={'file':('qa-invoice.xml',xml,'application/xml')});r.raise_for_status()
    print('QA seed complete: 2 wallets, 3 normal transactions, 1 budget, 1 XML invoice')
