'use strict';
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { PeerServer } = require('peer');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_MESSAGE_BYTES = 8 * 1024;
const clients = new Map();            // ws -> session
const nicknames = new Map();          // normalized nick -> ws
const rooms = new Map();              // room code -> host metadata (memory only)
const queue = [];                     // temporary matchmaking queue (memory only)

function normalizeNick(value) {
  return String(value || '').normalize('NFC').trim().replace(/[<>]/g, '').replace(/\s+/g, ' ').slice(0, 18);
}
function nickKey(value) { return normalizeNick(value).toLocaleLowerCase('pt-BR'); }
function send(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}
function onlinePlayers() {
  return [...clients.values()].filter(s => s.authenticated).map(s => ({ name: s.name, points: Number(s.points) || 0, wins: Number(s.wins) || 0, credits: Number(s.credits) || 100 })).sort((a,b) => b.points-a.points || b.wins-a.wins).slice(0,50);
}
function broadcastPresence() {
  const onlineCount = nicknames.size;
  const players = onlinePlayers();
  for (const [ws, session] of clients) {
    if (session.authenticated) send(ws, { type: 'presence', onlineCount, players });
  }
}
function removeFromQueue(ws) {
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].ws === ws) queue.splice(i, 1);
}
function removeClient(ws) {
  const session = clients.get(ws);
  if (!session) return;
  removeFromQueue(ws);
  if (session.authenticated) {
    const key = nickKey(session.name);
    if (nicknames.get(key) === ws) nicknames.delete(key);
  }
  for (const [code, room] of rooms) if (room.ws === ws) rooms.delete(code);
  clients.delete(ws);
  broadcastPresence();
}
function tryMatch() {
  // Match only players with the same virtual table value. No persistent records.
  for (let i = 0; i < queue.length; i++) {
    const a = queue[i];
    if (!a.ws || a.ws.readyState !== WebSocket.OPEN || !clients.get(a.ws)?.authenticated) {
      queue.splice(i--, 1); continue;
    }
    const j = queue.findIndex((b, idx) => idx > i && b.ws !== a.ws && b.stake === a.stake && b.ws.readyState === WebSocket.OPEN && clients.get(b.ws)?.authenticated);
    if (j < 0) continue;
    const b = queue[j];
    queue.splice(j, 1); queue.splice(i, 1); i--;
    // First in queue hosts; the other player connects to its PeerJS id.
    send(a.ws, { type: 'match-found', role: 'host', peerId: a.peerId, roomCode: a.peerId, stake: a.stake });
    send(b.ws, { type: 'match-found', role: 'guest', peerId: a.peerId, roomCode: a.peerId, stake: b.stake });
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ service: 'pixzin-presence', status: 'ok', database: false, online: nicknames.size, waiting: queue.length }));
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});
// PeerJS signaling is self-hosted on the same service; the game data can still use WebRTC directly.
PeerServer({ server, path: '/peerjs', allow_discovery: false });
const wss = new WebSocketServer({ server, path: '/presence', maxPayload: MAX_MESSAGE_BYTES, perMessageDeflate: false });

wss.on('connection', (ws, req) => {
  // Optional origin restriction. Set SITE_ORIGIN to the deployed Netlify URL.
  const allowedOrigin = process.env.SITE_ORIGIN;
  const origin = req.headers.origin;
  if (allowedOrigin && origin && origin !== allowedOrigin) {
    ws.close(1008, 'Origin not allowed');
    return;
  }
  clients.set(ws, { authenticated: false, name: '', peerId: '', roomCode: '', points: 0, wins: 0, credits: 100 });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { send(ws, { type: 'error', message: 'Mensagem inválida.' }); return; }
    if (!msg || typeof msg.type !== 'string') return;
    const session = clients.get(ws);
    if (!session) return;

    if (msg.type === 'login') {
      if (session.authenticated) { send(ws, { type: 'login-error', message: 'Esta conexão já tem um nick reservado.' }); return; }
      const name = normalizeNick(msg.name);
      if (name.length < 3 || !/^[\p{L}\p{N}_ -]+$/u.test(name)) {
        send(ws, { type: 'login-error', message: 'Use de 3 a 18 caracteres: letras, números, espaço, hífen ou sublinhado.' }); return;
      }
      const key = nickKey(name);
      const occupied = nicknames.get(key);
      if (occupied && occupied !== ws) { send(ws, { type: 'login-error', message: 'Esse nick já está em uso por alguém online. Escolha outro.' }); return; }
      session.authenticated = true;
      session.name = name;
      nicknames.set(key, ws);
      send(ws, { type: 'login-ok', name, onlineCount: nicknames.size, players: onlinePlayers() });
      broadcastPresence();
      return;
    }

    if (!session.authenticated) { send(ws, { type: 'error', message: 'Entre com um nick antes de usar o serviço.' }); return; }
    if (msg.type === 'logout') { removeClient(ws); try { ws.close(1000, 'logout'); } catch {} return; }
    if (msg.type === 'ping') { send(ws, { type: 'pong', at: Date.now() }); return; }
    if (msg.type === 'score-update') {
      session.points = Math.max(0, Math.min(100000000, Math.floor(Number(msg.points) || 0)));
      session.wins = Math.max(0, Math.min(1000000, Math.floor(Number(msg.wins) || 0)));
      session.credits = Math.max(0, Math.min(100000000, Math.floor(Number(msg.credits) || 0)));
      broadcastPresence();
      return;
    }
    if (msg.type === 'room-register') {
      const code = String(msg.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
      const peerId = String(msg.peerId || '').trim().slice(0, 100);
      const stake = Number(msg.stake);
      if (!code || !peerId || ![5, 10, 25, 50, 100].includes(stake)) { send(ws, { type: 'room-error', message: 'Dados da sala inválidos.' }); return; }
      const existing = rooms.get(code);
      if (existing && existing.ws !== ws) { send(ws, { type: 'room-error', message: 'Esse código de sala já está registrado.' }); return; }
      rooms.set(code, { ws, peerId, stake, name: session.name, createdAt: Date.now() });
      session.roomCode = code;
      send(ws, { type: 'room-registered', code });
      return;
    }
    if (msg.type === 'room-unregister') {
      const code = String(msg.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (room && room.ws === ws) rooms.delete(code);
      if (session.roomCode === code) session.roomCode = '';
      return;
    }
    if (msg.type === 'queue-join') {
      removeFromQueue(ws);
      const peerId = String(msg.peerId || '').trim().slice(0, 100);
      const stake = Number(msg.stake);
      if (!peerId || ![5, 10, 25, 50, 100].includes(stake)) { send(ws, { type: 'queue-error', message: 'Código de conexão ou valor de mesa inválido.' }); return; }
      queue.push({ ws, peerId, stake, name: session.name, joinedAt: Date.now() });
      send(ws, { type: 'queue-waiting', onlineCount: nicknames.size });
      tryMatch();
      return;
    }
    if (msg.type === 'queue-leave') { removeFromQueue(ws); return; }
  });
  ws.on('close', () => removeClient(ws));
  ws.on('error', () => removeClient(ws));
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) { try { ws.ping(); } catch {} }
  }
  // Remove abandoned queue entries after 3 minutes.
  const cutoff = Date.now() - 3 * 60 * 1000;
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].joinedAt < cutoff || queue[i].ws.readyState !== WebSocket.OPEN) queue.splice(i, 1);
}, 30000);
server.on('close', () => clearInterval(heartbeat));
server.listen(PORT, HOST, () => console.log(`Pixzin presence server listening on ${HOST}:${PORT}`));
