/* Round 5B: real portal Axios interceptors with controlled HTTP/storage boundaries.
   These are client logic checks; they do not claim browser layout/GUI coverage. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(path.join(root,'frontend/user-web/package.json'));
const ts=require('typescript'), axios=require('axios');
class Storage {
  constructor(){this.values=new Map();}
  get length(){return this.values.size;}
  key(i){return [...this.values.keys()][i]??null;}
  getItem(k){return this.values.get(k)??null;}
  setItem(k,v){this.values.set(k,String(v));Object.defineProperty(this,k,{enumerable:true,configurable:true,value:String(v)});}
  removeItem(k){this.values.delete(k);delete this[k];}
}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
const uidA='11111111-1111-4111-8111-111111111111',uidB='22222222-2222-4222-8222-222222222222';
const jwt=(uid=uidA,suffix='old')=>'header.'+Buffer.from(JSON.stringify({sub:uid,sid:'family',suffix})).toString('base64url')+'.signature';
const response=(config,status=200,data={})=>({config,status,data,headers:{},statusText:''});
const failure=(config,status)=>new axios.AxiosError('Controlled transport failure',undefined,config,{},status?response(config,status):undefined);
const checks=[];
async function check(group,name,fn){try{await fn();checks.push({group,case:name,pass:true});}catch(e){checks.push({group,case:name,pass:false,error:e.message});}}
function environment(portal,handler,authPost=async()=>({data:{}}),shared={}){
  const sessionStorage=shared.sessionStorage??new Storage(),localStorage=shared.localStorage??new Storage();
  const location={href:'',replace(v){this.href=v;}},calls=[];
  const filename=path.join(root,`frontend/${portal}-web/src/dung-chung/connect-api/api.${portal==='user'?'ts':'js'}`);
  const module={exports:{}};
  const fakeAxios={...axios,create:()=>axios.create({adapter:async config=>{calls.push(config);return handler(config);}}),post:authPost};
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,allowJs:true}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:name=>{assert.equal(name,'axios');return fakeAxios;},
    sessionStorage,localStorage,window:{location},navigator:{locks:shared.locks??{request:async(_,fn)=>fn()}},
    crypto:webcrypto,TextEncoder,TextDecoder,atob,btoa,AbortController,setTimeout,clearTimeout,console},{filename});
  const env={...module.exports,sessionStorage,localStorage,location,calls};
  env.save=(uid=uidA,suffix='old',remember=false)=>{
    if(portal==='user')env.saveSession(jwt(uid,suffix),'refresh-'+suffix,remember);
    else{env.clearSession();sessionStorage.setItem('admin_access_token',jwt(uid,suffix));sessionStorage.setItem('admin_refresh_token','refresh-'+suffix);}
  };
  return env;
}

await check('5B-01','parallel clicks reuse one pending money key until completion',async()=>{
  const entered=deferred(),done=deferred();let count=0;
  const env=environment('user',async config=>{if(++count===2)entered.resolve();await done.promise;return response(config);});env.save();
  const body={qr_payload:'synthetic-signed-by-QA'},p=Promise.all([env.default.post('/wallets/qa/payments/create',body),env.default.post('/wallets/qa/payments/create',body)]);
  await entered.promise;assert.equal(new Set(env.calls.map(c=>c.headers['Idempotency-Key'])).size,1);
  done.resolve();await p;assert.equal([...env.sessionStorage.values.keys()].filter(k=>k.startsWith('cf-pending-money:')).length,0);
});
await check('5B-01','reload after lost response retains key, success then permits fresh intent',async()=>{
  const env=environment('user',config=>{throw failure(config,503);});env.save();const body={amount:'25000',link_id:'qa'};
  await assert.rejects(env.default.post('/wallets/qa/topup',body));const oldKey=env.calls[0].headers['Idempotency-Key'];
  const reloaded=environment('user',config=>response(config),undefined,{sessionStorage:env.sessionStorage,localStorage:env.localStorage});
  await reloaded.default.post('/wallets/qa/topup',body);assert.equal(reloaded.calls[0].headers['Idempotency-Key'],oldKey);
  await reloaded.default.post('/wallets/qa/topup',body);assert.notEqual(reloaded.calls[1].headers['Idempotency-Key'],oldKey);
});
for(const portal of ['user','admin']){
  await check('5B-02',`${portal}: concurrent expired requests share a single refresh`,async()=>{
    const refresh=deferred(),entered=deferred();let refreshCalls=0;
    const env=environment(portal,config=>{if(!config._retry)throw failure(config,401);assert.equal(config.headers.Authorization,'Bearer '+jwt(uidA,'new'));return response(config);},async()=>{refreshCalls++;entered.resolve();await refresh.promise;return {data:{access_token:jwt(uidA,'new'),refresh_token:'refresh-new'}};});env.save();
    const pending=Promise.all(Array.from({length:5},()=>env.default.get('/bookkeeping')));await entered.promise;await tick();assert.equal(refreshCalls,1);refresh.resolve();await pending;assert.equal(refreshCalls,1);
  });
  await check('5B-03',`${portal}: old success cannot enter a newly signed-in account`,async()=>{
    const entered=deferred(),done=deferred();const env=environment(portal,async config=>{entered.resolve();await done.promise;return response(config,200,{owner:'A'});});env.save();
    const old=env.default.get('/bookkeeping').then(()=>assert.fail('old response was accepted'),error=>assert.ok(axios.isCancel(error)));
    await entered.promise;env.save(uidB,'B');done.resolve();await old;assert.equal(env.sessionStorage.getItem(portal+'_access_token'),jwt(uidB,'B'));
  });
  await check('5B-03',`${portal}: late refresh cannot replace new credentials`,async()=>{
    const entered=deferred(),done=deferred();const posts=[];
    const env=environment(portal,config=>{throw failure(config,401);},async(url,body)=>{posts.push(url);if(url.endsWith('/logout'))return {data:{}};entered.resolve();await done.promise;return {data:{access_token:jwt(uidA,'late'),refresh_token:'refresh-late'}};});env.save();
    const old=env.default.get('/bookkeeping').then(()=>assert.fail('stale refresh accepted'),error=>assert.ok(axios.isCancel(error)));
    await entered.promise;env.save(uidB,'B');done.resolve();await old;await tick();assert.equal(env.sessionStorage.getItem(portal+'_access_token'),jwt(uidB,'B'));assert.ok(posts.some(p=>p.endsWith('/logout')));
  });
  for(const status of [undefined,429,503]){
    await check('5B-04',`${portal}: ${status??'network loss'} causes no blind retry/logout`,async()=>{
      const env=environment(portal,config=>{throw failure(config,status);});env.save();const body={amount:'25000',note:'Giữ dữ liệu nhập'};
      const route=portal==='user'?'/wallets/qa/topup':'/admin/users/qa/ban';
      await assert.rejects(env.default.post(route,body));assert.equal(env.calls.length,1);assert.equal(env.sessionStorage.getItem(portal+'_access_token'),jwt());assert.equal(env.location.href,'');assert.deepEqual(body,{amount:'25000',note:'Giữ dữ liệu nhập'});
      if(portal==='user')assert.ok([...env.sessionStorage.values.keys()].some(k=>k.startsWith('cf-pending-money:')));
    });
  }
}
await check('5B-02','two remembered user tabs coordinate refresh and adopt the rotated token',async()=>{
  const localStorage=new Storage();let last=Promise.resolve(),refreshCalls=0;
  const locks={request:(_,fn)=>{const work=last.then(fn);last=work.catch(()=>{});return work;}};
  const handler=config=>{if(!config._retry)throw failure(config,401);assert.equal(config.headers.Authorization,'Bearer '+jwt(uidA,'new'));return response(config);};
  const refresh=async()=>{refreshCalls++;await tick();return {data:{access_token:jwt(uidA,'new'),refresh_token:'refresh-new'}};};
  const one=environment('user',handler,refresh,{localStorage,locks});one.save(uidA,'old',true);
  const two=environment('user',handler,refresh,{localStorage,locks});two.restoreSession();
  await Promise.all([one.default.get('/bookkeeping'),two.default.get('/bookkeeping')]);assert.equal(refreshCalls,1);
  assert.equal(two.sessionStorage.getItem('user_access_token'),jwt(uidA,'new'));
});
await check('5B-03','two accounts never share unresolved money request keys',async()=>{
  const env=environment('user',config=>{throw failure(config,503);});env.save();const body={amount:'25000'};
  await assert.rejects(env.default.post('/wallets/qa/topup',body));const old=env.calls[0].headers['Idempotency-Key'];
  env.save(uidB,'B');await assert.rejects(env.default.post('/wallets/qa/topup',body));assert.notEqual(env.calls[1].headers['Idempotency-Key'],old);
});
const report={passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,scope:'Real Axios interceptor logic with simulated transport/storage; not GUI coverage',checks};
const out=path.join(root,'output/fault-concurrency-qa/5B-web-results.json');fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(report.failed)process.exitCode=1;
