import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const store = getStore({ name: 'pixzin-shared', consistency: 'strong' });
const STATE_KEY = 'accounts-state-v1';
const LOCK_KEY = 'accounts-operation-lock-v1';
const MAX_ACCOUNTS = 10;
const LOCK_MS = 12000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const cleanName = v => String(v || '').normalize('NFC').trim().replace(/\s+/g, ' ').slice(0, 18);
const nameKey = v => cleanName(v).toLocaleLowerCase('pt-BR');
const json = (statusCode, data) => ({ statusCode, headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type,authorization', 'access-control-allow-methods':'GET,POST,OPTIONS' }, body: JSON.stringify(data) });
async function getState(){ return await store.get(STATE_KEY, { type:'json' }) || {version:1,users:[],sessions:[],transactions:[]}; }
async function withSoftLock(fn){
  const id = crypto.randomUUID();
  // Best-effort lease + bounded retry. The UI countdown is helpful, but Blobs is not a transactional lock.
  for(let attempt=0; attempt<8; attempt++){
    const current = await store.get(LOCK_KEY, {type:'json'});
    if(!current || current.until < Date.now()){
      await store.setJSON(LOCK_KEY,{id,until:Date.now()+LOCK_MS});
      await sleep(180 + Math.random()*220);
      const check = await store.get(LOCK_KEY,{type:'json'});
      if(check?.id === id){
        try { return await fn(); }
        finally { const latest=await store.get(LOCK_KEY,{type:'json'}); if(latest?.id===id) await store.delete(LOCK_KEY); }
      }
    }
    await sleep(350 + attempt*180);
  }
  const e = new Error('O sistema está ocupado. Aguarde alguns segundos e tente novamente.'); e.status=429; throw e;
}
async function tokenUser(event, state){
  const token = String(event.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return null;
  const session=state.sessions.find(s=>s.tokenHash===hash(token)&&s.expiresAt>Date.now());
  return session ? state.users.find(u=>u.id===session.userId) || null : null;
}
const publicUser = u => ({id:u.id,username:u.username,points:u.points,credits:u.credits,wins:u.wins,inventory:u.inventory||[],createdAt:u.createdAt});
const issueToken = () => crypto.randomBytes(32).toString('base64url');
const derive = (password,salt) => crypto.scryptSync(password,salt,64).toString('hex');
export default async (event) => {
  if(event.httpMethod==='OPTIONS') return json(204,{});
  const path = new URL(event.rawUrl || `https://netlify.local${event.path}`).pathname;
  const action = event.queryStringParameters?.action || path.split('/').pop();
  let body={}; try{body=event.body?JSON.parse(event.body):{};}catch{return json(400,{error:'JSON inválido.'});}
  try {
    return await withSoftLock(async()=>{
      const state=await getState();
      if(event.httpMethod==='POST' && action === 'register'){
        const username=cleanName(body.username), key=nameKey(username), password=body.password;
        if(username.length<3 || !/^[\p{L}\p{N}_ -]+$/u.test(username)) return json(400,{error:'Use de 3 a 18 caracteres: letras, números, espaço, hífen ou sublinhado.'});
        if(typeof password!=='string'||password.length<10||password.length>128) return json(400,{error:'A senha deve ter de 10 a 128 caracteres.'});
        if(state.users.some(u=>u.nameKey===key)) return json(409,{error:'Esse nome já existe. Escolha outro ou entre na conta.'});
        if(state.users.length>=MAX_ACCOUNTS) return json(507,{error:'O limite de 10 contas foi atingido.'});
        const id=crypto.randomUUID(), salt=crypto.randomBytes(16).toString('hex'), token=issueToken(), now=new Date().toISOString();
        const user={id,username,nameKey:key,salt,passwordHash:derive(password,salt),points:0,credits:1000,wins:0,inventory:[],createdAt:now,updatedAt:now};
        state.users.push(user); state.sessions=state.sessions.filter(s=>s.expiresAt>Date.now()); state.sessions.push({tokenHash:hash(token),userId:id,expiresAt:Date.now()+30*86400000});
        state.transactions.push({id:crypto.randomUUID(),userId:id,kind:'welcome',amount:1000,createdAt:now}); await store.setJSON(STATE_KEY,state);
        return json(201,{token,user:publicUser(user),accountCount:state.users.length,accountLimit:MAX_ACCOUNTS});
      }
      if(event.httpMethod==='POST' && action === 'login'){
        const key=nameKey(body.username), user=state.users.find(u=>u.nameKey===key);
        if(!user||typeof body.password!=='string'||derive(body.password,user.salt)!==user.passwordHash) return json(401,{error:'Usuário ou senha incorretos.'});
        const token=issueToken(); state.sessions=state.sessions.filter(s=>s.expiresAt>Date.now()); state.sessions.push({tokenHash:hash(token),userId:user.id,expiresAt:Date.now()+30*86400000}); await store.setJSON(STATE_KEY,state);
        return json(200,{token,user:publicUser(user),accountCount:state.users.length,accountLimit:MAX_ACCOUNTS});
      }
      const user=await tokenUser(event,state);
      if(action === 'me'&&event.httpMethod==='GET') return user?json(200,{user:publicUser(user),accountCount:state.users.length,accountLimit:MAX_ACCOUNTS}):json(401,{error:'Sessão expirada. Entre novamente.'});
      if(!user) return json(401,{error:'Faça login novamente.'});
      if(action === 'logout'&&event.httpMethod==='POST'){const token=String(event.headers.authorization||'').replace(/^Bearer\s+/i,'');state.sessions=state.sessions.filter(s=>s.tokenHash!==hash(token));await store.setJSON(STATE_KEY,state);return json(200,{ok:true});}
      if(action === 'profile'&&event.httpMethod==='POST'){
        user.points=Math.max(0,Math.min(1e9,Math.floor(Number(body.points)||0))); user.wins=Math.max(0,Math.min(1e7,Math.floor(Number(body.wins)||0))); user.credits=Math.max(0,Math.min(1e9,Math.floor(Number(body.credits)||0))); user.inventory=Array.isArray(body.inventory)?body.inventory.slice(0,100):user.inventory; user.updatedAt=new Date().toISOString(); await store.setJSON(STATE_KEY,state);return json(200,{user:publicUser(user)});
      }
      if(action === 'ranking'&&event.httpMethod==='GET') return json(200,{ranking:state.users.map(publicUser).sort((a,b)=>b.points-a.points||b.wins-a.wins).slice(0,50)});
      return json(404,{error:'Endpoint não encontrado.'});
    });
  } catch(e){ return json(e.status||500,{error:e.message||'Erro interno.'}); }
};
