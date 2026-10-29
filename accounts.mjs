import crypto from 'node:crypto';

const MAX_ACCOUNTS = 10;
const FILE_PATH = process.env.PIXZIN_DATA_PATH || 'data/pixzin-accounts.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const cleanName = v => String(v || '').normalize('NFC').trim().replace(/\s+/g, ' ').slice(0, 18);
const nameKey = v => cleanName(v).toLocaleLowerCase('pt-BR');
const json = (statusCode, data) => ({ statusCode, headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type,authorization', 'access-control-allow-methods':'GET,POST,OPTIONS' }, body: JSON.stringify(data) });
function config(){const owner=process.env.GITHUB_OWNER, repo=process.env.GITHUB_REPO, token=process.env.GITHUB_TOKEN, branch=process.env.GITHUB_BRANCH||'main'; if(!owner||!repo||!token) throw new Error('Falta configurar GITHUB_OWNER, GITHUB_REPO e GITHUB_TOKEN nas variáveis de ambiente do Netlify.'); return {owner,repo,token,branch};}
async function github(path, opts={}) {const c=config(); const sep=path.includes('?')?'&':'?'; const url=opts.method==='PUT'?`https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}`:`https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}${sep}ref=${encodeURIComponent(c.branch)}`; const r=await fetch(url,{...opts,headers:{'Accept':'application/vnd.github+json','Authorization':`Bearer ${c.token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'pixzin-vegas-netlify',...(opts.headers||{})}}); const d=await r.json().catch(()=>({})); if(!r.ok){const e=new Error(d.message||`GitHub respondeu ${r.status}`);e.status=r.status;e.data=d;throw e;}return d;}
async function readState(){const c=config();try{const d=await github(FILE_PATH);const decoded=Buffer.from(d.content||'','base64').toString('utf8');return {state:JSON.parse(decoded),sha:d.sha};}catch(e){if(e.status===404)return {state:{version:1,users:[],sessions:[],transactions:[]},sha:null};throw e;}}
async function writeState(state, sha){const c=config();const body={message:'Atualiza dados Pixzin Vegas',content:Buffer.from(JSON.stringify(state,null,2)).toString('base64'),branch:c.branch};if(sha)body.sha=sha;return github(FILE_PATH,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
async function mutate(fn){let last;for(let i=0;i<5;i++){const {state,sha}=await readState();const result=await fn(state);if(result && result.__noWrite && result.__response)return result.__response;try{await writeState(state,sha);return result && result.__response ? result.__response : result;}catch(e){last=e;if(e.status!==409&&e.status!==422)throw e;await sleep(200*(i+1));}}const e=new Error('Muitas ações ao mesmo tempo. Aguarde 3 segundos e tente novamente.');e.status=429;throw e;}
const issueToken=()=>crypto.randomBytes(32).toString('base64url');
const makeAccessKey=()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';let out='PZ-';for(let i=0;i<24;i++)out+=chars[crypto.randomInt(chars.length)];return out;};
const publicUser=u=>({id:u.id,username:u.username,points:u.points||0,credits:u.credits??1000,wins:u.wins||0,inventory:u.inventory||[],createdAt:u.createdAt});
async function getUserByAuth(event,state){const token=String(event.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!token)return null;const session=(state.sessions||[]).find(s=>s.tokenHash===sha256(token)&&s.expiresAt>Date.now());return session?(state.users||[]).find(u=>u.id===session.userId)||null:null;}
export default async event=>{
 if(event.httpMethod==='OPTIONS')return json(204,{});
 const path=new URL(event.rawUrl||`https://netlify.local${event.path}`).pathname;const action=event.queryStringParameters?.action||path.split('/').pop();let body={};try{body=event.body?JSON.parse(event.body):{};}catch{return json(400,{error:'Pedido inválido.'});}
 try{
  if(event.httpMethod==='POST'&&action==='register'){
   return await mutate(async state=>{const username=cleanName(body.username),key=nameKey(username);if(username.length<3||!/^[\p{L}\p{N}_ -]+$/u.test(username))return {__noWrite:true,__response:json(400,{error:'Use de 3 a 18 caracteres: letras, números, espaço, hífen ou sublinhado.'})};if((state.users||[]).some(u=>u.nameKey===key))return {__noWrite:true,__response:json(409,{error:'Esse nome já existe. Entre na conta ou escolha outro.'})};if((state.users||[]).length>=MAX_ACCOUNTS)return {__noWrite:true,__response:json(409,{error:'As 10 contas permanentes já foram ocupadas.'})};const accessKey=makeAccessKey(),token=issueToken(),now=new Date().toISOString(),id=crypto.randomUUID();const user={id,username,nameKey:key,accessKeyHash:sha256(accessKey),points:0,credits:1000,wins:0,inventory:[],createdAt:now,updatedAt:now};state.users.push(user);state.sessions=(state.sessions||[]).filter(s=>s.expiresAt>Date.now());state.sessions.push({tokenHash:sha256(token),userId:id,expiresAt:Date.now()+30*86400000});state.transactions=state.transactions||[];state.transactions.push({id:crypto.randomUUID(),userId:id,kind:'welcome',amount:1000,createdAt:now});return {__response:json(201,{token,accessKey,user:publicUser(user),accountCount:state.users.length,accountLimit:MAX_ACCOUNTS})};});
  }
  if(event.httpMethod==='POST'&&action==='login'){
   return await mutate(async state=>{const key=nameKey(body.username),user=(state.users||[]).find(u=>u.nameKey===key);if(!user||typeof body.accessKey!=='string'||sha256(body.accessKey.trim())!==user.accessKeyHash)return {__noWrite:true,__response:json(401,{error:'Nome de usuário ou chave de acesso incorretos.'})};const token=issueToken();state.sessions=(state.sessions||[]).filter(s=>s.expiresAt>Date.now());state.sessions.push({tokenHash:sha256(token),userId:user.id,expiresAt:Date.now()+30*86400000});return {__response:json(200,{token,user:publicUser(user),accountCount:state.users.length,accountLimit:MAX_ACCOUNTS})};});
  }
  const {state}=await readState();
  if(action==='health'&&event.httpMethod==='GET')return json(200,{ok:true,storage:'github-contents-api',accountLimit:MAX_ACCOUNTS});
  const user=await getUserByAuth(event,state);
  if(action==='me'&&event.httpMethod==='GET')return user?json(200,{user:publicUser(user),accountCount:state.users.length,accountLimit:MAX_ACCOUNTS}):json(401,{error:'Sessão expirada. Entre novamente.'});
  if(action==='ranking'&&event.httpMethod==='GET')return json(200,{ranking:state.users.map(publicUser).sort((a,b)=>b.points-a.points||b.wins-a.wins)});
  if(!user)return json(401,{error:'Faça login novamente.'});
  if(action==='logout'&&event.httpMethod==='POST'){return await mutate(async s=>{s.sessions=(s.sessions||[]).filter(x=>x.tokenHash!==sha256(String(event.headers.authorization||'').replace(/^Bearer\s+/i,'')));return {__response:json(200,{ok:true})};});}
  if(action==='profile'&&event.httpMethod==='POST'){
   return await mutate(async s=>{const u=(s.users||[]).find(x=>x.id===user.id);if(!u)return {__noWrite:true,__response:json(404,{error:'Conta não encontrada.'})};u.points=Math.max(0,Math.min(1e9,Math.floor(Number(body.points)||0)));u.wins=Math.max(0,Math.min(1e7,Math.floor(Number(body.wins)||0)));u.credits=Math.max(0,Math.min(1e9,Math.floor(Number(body.credits)||0)));if(Array.isArray(body.inventory))u.inventory=body.inventory.slice(0,100);u.updatedAt=new Date().toISOString();return {__response:json(200,{user:publicUser(u)})};});
  }
  return json(404,{error:'Função não encontrada.'});
 }catch(e){return json(e.status===401?401:e.status===404?500:e.status===409||e.status===422?429:e.status||500,{error:e.status===404?'Não foi possível ler o arquivo de dados no GitHub. Confira as variáveis e o caminho do repositório.':e.message||'Erro interno.'});}
};
