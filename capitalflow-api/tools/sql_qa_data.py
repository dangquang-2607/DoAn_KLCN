"""Deterministic, synthetic SQL benchmark fixtures. Called only by guarded QA runner."""
from datetime import datetime, timedelta
from decimal import Decimal
import hashlib
from itertools import islice
import json
from uuid import UUID, uuid5

SIZES={'D1':(20,10000,1000,100,10000,5000,1000), 'D2':(100,50000,5000,500,100000,50000,5000)}
NAMESPACE=UUID('82536f42-7ed1-4674-b3b6-8e126389fd91')
PASSWORD='Sql-QA-only-2026!'

def uid(value): return uuid5(NAMESPACE,str(value))

def seed(engine,dataset):
    from sqlalchemy import select,func
    from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
    from app.dung_chung.security.passwords import hash_password
    from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category
    from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet,WalletEntry,DemoBankBalance,UserBankLink
    from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
    from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
    from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
    from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
    from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget,BudgetChange
    from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import today_vn,period_bounds
    from app.chuc_nang.quan_tri.nhat_ky_quan_tri.luu_tru.nhat_ky import AuditLog
    from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog
    from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
    from app.dung_chung.config import settings
    from cryptography.fernet import Fernet
    from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.luu_tru.thong_bao import Notification
    from app.chuc_nang.quan_tri.ho_tro.luu_tru import AccountSupportCase
    count,tx_count,invoice_count,budget_count,audit_count,email_count,job_count=SIZES[dataset]
    today=today_vn(); instant=datetime.combine(today,datetime.min.time())+timedelta(hours=2)
    first=today-timedelta(days=364); hashed=hash_password(PASSWORD)
    users=[uid('user-'+str(i)) for i in range(count)]
    def owner(i):return 3 if (i*7+i//10)%10<4 else 4+(i%(count-4))
    def wallet_code(number):
        alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';value=''
        for _ in range(8):value=alphabet[number%len(alphabet)]+value;number//=len(alphabet)
        return 'CF-'+value
    def stamp(i):return datetime.combine(first+timedelta(days=i%365),datetime.min.time())+timedelta(seconds=i%86400)
    def bulk(model,rows):
        iterator=iter(rows)
        with engine.begin() as db:
            while batch:=list(islice(iterator,500)):
                db.execute(model.__table__.insert(),batch)
    bulk(User,({'id':users[i],'email':f'sql{i}@example.com','full_name':f'SQL QA {i}',
                'password_hash':hashed,'role':'ADMIN' if i<3 else 'USER','is_system_account':i==0,
                'support_only':i==2,'is_active':True,'must_change_password':False,'token_version':0,
                'last_active_at':instant,'created_at':instant} for i in range(count)))
    cats=[uid('category-'+str(i)) for i in range(12)]
    bulk(Category,({'id':cid,'owner_user_id':None,'name':f'SQL QA category {i}','type':'EXPENSE' if i<8 else 'INCOME',
                    'is_active':True,'sort_order':i,'keywords':'sql-fixture','icon':'wallet'} for i,cid in enumerate(cats)))
    wallets={};banks={}; balances={};bank_balances={};entries=[];txs=[]
    for i,user in enumerate(users):
        banks[i]=uid(f'bank-{i}');bank_balances[i]=Decimal(500000000)
        for j in range(2):wallets[i,j]=uid(f'wallet-{i}-{j}');balances[wallets[i,j]]=Decimal(0)
    def transaction(key,person,amount,day,source='MANUAL',invoice_id=None,entry_id=None,included=True):
        expense=amount<0
        return {'id':uid('txn-'+str(key)),'user_id':users[person],'amount':Decimal(amount),'type':'EXPENSE' if expense else 'INCOME',
                'source':source,'transaction_date':day,'kind':'NORMAL','include_in_reports':included,
                'category_id':cats[(int(hashlib.sha256(str(key).encode()).hexdigest()[:8],16)%8) if expense else 8+person%4],
                'description':f'SQL QA purchase {key}','note':'synthetic fixture','invoice_id':invoice_id,'wallet_entry_id':entry_id,
                'created_at':datetime.combine(day,datetime.min.time()),'updated_at':instant}
    def entry(key,person,wid,kind,amount,bank=None,other=None,operation=None):
        amount=Decimal(amount);balances[wid]+=amount
        eid=uid('entry-'+str(key));day=first+timedelta(days=min(364,len(entries)*365//max(1,tx_count//5)))
        row={'id':eid,'operation_id':operation or uid('op-'+str(key)),'wallet_id':wid,'kind':kind,'amount':amount,
             'balance_after':balances[wid],'bank_id':bank,'counterparty_wallet_id':other,
             'merchant_name':'SQL QA Cafe' if kind=='PAYMENT' else None,'bill_reference':str(key) if kind=='PAYMENT' else None,
             'note':'synthetic wallet movement','created_at':datetime.combine(day,datetime.min.time())+timedelta(seconds=len(entries))}
        entries.append(row);txs.append(transaction('wallet-'+str(key),person,amount,day,'WALLET',entry_id=eid,
                                                 included=kind=='PAYMENT' and len(entries)%7!=0))
    for i in range(count):
        for j in range(2):
            entry(f'fund-{i}-{j}',i,wallets[i,j],'TOPUP',100000000,bank=banks[i]);bank_balances[i]-=100000000
    for k in range(max(10,count)):
        a=3+k%(count-3);b=3+(k+1)%(count-3);operation=uid('transfer-'+str(k))
        entry(f'out-{k}',a,wallets[a,0],'TRANSFER_OUT',-1000,other=wallets[b,0],operation=operation)
        entry(f'in-{k}',b,wallets[b,0],'TRANSFER_IN',1000,other=wallets[a,0],operation=operation)
    while len(entries)<tx_count//5:
        k=len(entries);a=owner(k)
        if k%9==0:
            entry('withdraw-'+str(k),a,wallets[a,0],'WITHDRAW',-5000,bank=banks[a]);bank_balances[a]+=5000
        else:entry('payment-'+str(k),a,wallets[a,0],'PAYMENT',-25000)
    bulk(Wallet,({'id':wid,'user_id':users[i],'name':f'Ví SQL {j}','balance':balances[wid],
                  'is_default':j==0,'is_active':True,'short_code':wallet_code(i*2+j)} for (i,j),wid in wallets.items()))
    bulk(DemoBankBalance,({'id':banks[i],'user_id':users[i],'provider':'VCB','account_number':f'{1000000000000+i}',
                          'account_number_masked':'***000','opening_balance':500000000,'balance':bank_balances[i]} for i in range(count)))
    bulk(UserBankLink,({'id':uid('link-'+str(i)),'user_id':users[i],'bank_id':banks[i],
                       'is_active':True,'expires_at':instant+timedelta(days=30)} for i in range(count)))
    bulk(WalletEntry,entries)
    invoices=[];invoice_owners=[];confirmed=[]
    for i in range(invoice_count):
        person=owner(i);iid=uid('invoice-'+str(i));invoice_owners.append(person)
        status='CONFIRMED' if i%10<7 else 'REVIEW_REQUIRED' if i%10==7 else 'FAILED' if i%10==8 else 'PROCESSING'
        day=first+timedelta(days=(i//8)%365)
        invoices.append({'id':iid,'user_id':users[person],'status':status,'revision':1,'confirmation_generation':0,
                         'merchant_name':f'SQL QA shop {i%4}','merchant_normalized':f'sql qa shop {i%4}',
                         'invoice_date':day,'invoice_number':f'QA-{i}','total_amount':50000,'subtotal_amount':50000,
                         'tax_amount':0,'currency':'VND','mime_type':'image/jpeg','storage_key':f'sql-{i}.jpg',
                         'file_sha256':hashlib.sha256(f'invoice-{i}'.encode()).hexdigest(),'strong_identity_key':None,
                         'deleted_at':instant-timedelta(days=10) if i%37==0 else None,
                         'created_at':stamp(i),'confirmed_at':stamp(i) if status=='CONFIRMED' else None,
                         'extracted_json':json.dumps({'fixture':'x'*500})})
        if status=='CONFIRMED':confirmed.append((i,person,iid,day))
    bulk(Invoice,invoices)
    bulk(InvoiceItem,({'id':uid(f'item-{i}-{j}'),'invoice_id':row['id'],'line_no':j+1,'name':f'SQL QA item {j}',
                       'quantity':1,'unit_price':10000,'line_total':10000} for i,row in enumerate(invoices) for j in range(5)))
    bulk(OcrJob,({'id':uid(f'ocr-{i}-{j}'),'user_id':users[invoice_owners[i]],'invoice_id':row['id'],
                  'status':'FAILED' if row['status']=='FAILED' or j==0 else 'PROCESSING' if row['status']=='PROCESSING' else 'COMPLETED',
                  'attempt_count':j+1,'progress_percent':100 if row['status']!='PROCESSING' else 50,
                  'processing_ms':500+i%3000,'error_code':'QA_TIMEOUT' if row['status']=='FAILED' or j==0 else None,
                  'response_json':json.dumps({'fixture':'x'*500}),'created_at':row['created_at']+timedelta(seconds=j)}
                 for i,row in enumerate(invoices) for j in range(2)))
    for i,person,iid,day in confirmed:txs.append(transaction('ocr-'+str(i),person,-50000,day,'OCR',invoice_id=iid))
    while len(txs)<tx_count:
        k=len(txs);person=owner(k);amount=Decimal((1+k%20)*10000)*(-1 if k%4 else 1)
        txs.append(transaction('manual-'+str(k),person,amount,first+timedelta(days=k%365),included=k%13!=0))
    bulk(Transaction,txs)
    budgets=[];changes=[];used=set();alloc=[3]*20+[4]*10+[5]
    alloc += [6+i%(count-6) for i in range(budget_count-len(alloc))]
    positions={}
    for i,person in enumerate(alloc):
        n=positions.get(person,0);positions[person]=n+1
        period=['WEEKLY','MONTHLY','YEARLY','CUSTOM'][n%4]
        start=today.replace(month=1,day=1)-timedelta(days=180+n)
        recurring=period!='CUSTOM'
        category=None if n%9==0 else cats[n%8]
        end=today+timedelta(days=30) if not recurring else period_bounds(
            Budget(period_type=period,start_date=start,end_date=start,is_recurring=True),start)[1]
        if not recurring:start=today-timedelta(days=20+n)
        bid=uid('budget-'+str(i))
        budgets.append({'id':bid,'user_id':users[person],'category_id':category,'name':f'SQL budget {i}',
                        'amount_limit':999000000,'currency':'VND','period_type':period,'start_date':start,'end_date':end,
                        'is_recurring':recurring,'warning_percent':80,'is_active':True})
        if recurring:
            for j,(delta,active) in enumerate([(0,True),(60,True),(120,False),(150,True)]):
                changes.append({'id':uid(f'change-{i}-{j}'),'budget_id':bid,'effective_date':start+timedelta(days=delta),
                                'name':f'SQL budget {i} v{j}','amount_limit':999000000-j*1000000,'warning_percent':80,'is_active':active})
    bulk(Budget,budgets);bulk(BudgetChange,changes)
    bulk(AuditLog,({'user_id':users[i%count],'action':['BAN_USER','GET /api/v1/bookkeeping','SUPPORT_CASE_RESOLVED','UPDATE_SMTP_SETTINGS'][i%4],
                    'entity_type':['user','transaction','support_case','settings'][i%4],
                    'entity_id':users[(i+3)%count],'http_method':'PATCH' if i%4!=1 else 'GET',
                    'route':['/api/v1/admin/users','/api/v1/bookkeeping','/api/v1/admin/support-cases','/api/v1/admin/email/settings'][i%4],
                    'status_code':403 if i%7==0 else 200,'created_at':stamp(i),
                    'old_values_json':json.dumps({'fixture':'x'*200}),'new_values_json':json.dumps({'fixture':'y'*200})} for i in range(audit_count)))
    bulk(EmailLog,({'id':uid('email-'+str(i)),'user_id':users[i%count],'recipient':f'sql{i%count}@example.com',
                    'subject':f'SQL QA message {i}','email_type':'TEST_EMAIL' if i%5==0 else 'WELCOME',
                    'status':['SENT','FAILED','UNKNOWN','SENDING','LOGGED_DEV'][i%5],
                    'error_message':'QA_FAILURE' if i%5 in (1,2) else None,'created_at':stamp(i)} for i in range(email_count)))
    cipher=Fernet(settings.job_encryption_key.encode())
    processing=[(i,row) for i,row in enumerate(invoices) if row['status']=='PROCESSING']
    expense_by_owner={row['user_id']:row['id'] for row in txs if row['type']=='EXPENSE'}
    def job_payload(i):
        person=owner(i);kind=['EMAIL','BUDGET','OCR','FILE_DELETE'][i%4]
        if kind=='EMAIL':payload={'function':'send_test_email','args':[f'sql{person}@example.com'],'kwargs':{}}
        elif kind=='BUDGET':payload={'user_id':str(users[person]),'transaction_id':str(expense_by_owner[users[person]])}
        elif kind=='OCR':
            index,row=processing[i%len(processing)];person=invoice_owners[index]
            payload={'user_id':str(row['user_id']),'invoice_id':str(row['id']),'ocr_job_id':str(uid(f'ocr-{index}-1')),'invoice_revision':1}
        else:payload={'storage_key':f'sql-deleted-{i}.jpg'}
        return kind,person,cipher.encrypt(json.dumps(payload).encode()).decode()
    jobs=[job_payload(i) for i in range(job_count)]
    bulk(BackgroundJob,({'id':uid('job-'+str(i)),'kind':jobs[i][0],
                         'status':'DONE' if i%100<90 else 'DEAD' if i%100<98 else 'PENDING' if i%2 else 'RUNNING',
                         'payload':'' if i%100<98 else jobs[i][2],'dedupe_key':'sql-fixture-'+str(i),'attempts':1,
                         'available_at':instant+timedelta(days=10),'lease_until':instant+timedelta(days=20) if i%2==0 else None,
                         'lease_token':uid('lease-'+str(i)) if i%2==0 else None,'owner_user_id':users[jobs[i][1]],'created_at':stamp(i)} for i in range(job_count)))
    bulk(Notification,({'id':uid('notification-'+str(i)),'user_id':users[owner(i)],'kind':'ACCOUNT','severity':'INFO',
                        'title':'SQL QA notification','message':'Synthetic notification','read_at':None if i%3==0 else instant,
                        'created_at':stamp(i)} for i in range(count*100)))
    bulk(AccountSupportCase,({'id':uid('support-'+str(i)),'account_email':f'sqlcase{i}@example.com',
                              'contact_email':'contact@example.com' if i%2 else None,'source':'USER',
                              'issue':'NO_EMAIL' if i%2 else 'LOCKED','status':['OPEN','ESCALATED','RESOLVED'][i%3],
                              'created_at':stamp(i)} for i in range(count*10)))
    with engine.connect() as db:
        assert db.scalar(select(func.count()).select_from(Transaction))==tx_count
        assert all(v>=0 for v in balances.values())
        assert sum(balances.values())+sum(bank_balances.values())==Decimal(count*500000000)-sum(-e['amount'] for e in entries if e['kind']=='PAYMENT')
    return {'dataset':dataset,'users':[str(x) for x in users],'heavy_index':3,'password':PASSWORD,
            'wallets':{str(i):str(wallets[i,0]) for i in range(count)},'categories':[str(x) for x in cats],
            'invoice_id':str(next(row['id'] for row in invoices if row['user_id']==users[3] and row['status']=='REVIEW_REQUIRED' and not row['deleted_at'])),
            'confirmed_invoice_id':str(next(row['id'] for row in invoices if row['user_id']==users[3] and row['status']=='CONFIRMED')),
            'budgets':{str(p):[str(b['id']) for b in budgets if b['user_id']==users[p]] for p in [3,4,5]},
            'counts':{'users':count,'transactions':tx_count,'invoices':invoice_count,'invoice_items':invoice_count*5,
                      'budgets':budget_count,'audit_logs':audit_count,'email_logs':email_count,'background_jobs':job_count},
            'seed_date':today.isoformat(),'financial_seed_consistent':True}
