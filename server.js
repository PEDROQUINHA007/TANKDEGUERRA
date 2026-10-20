const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const MAX_ROOM_PLAYERS = 12;
const MAX_MESSAGE_BYTES = 4096;
const rooms = new Map();

function validRoom(room) {
  return typeof room === 'string' && room.length >= 1 && room.length <= 48 &&
    /^[a-z0-9._-]+$/.test(room);
}
function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}
function roomBroadcast(room, obj, except = null) {
  for (const peer of room.peers.values()) if (peer.ws !== except) send(peer.ws, obj);
}
function leave(ws) {
  const room = ws.room;
  if (!room) return;
  const peer = room.peers.get(ws.peerId);
  if (peer) {
    room.peers.delete(ws.peerId);
    roomBroadcast(room, { t: 'leave', peer: ws.peerId });
  }
  if (room.peers.size === 0) rooms.delete(room.name);
  ws.room = null;
}
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    return res.end('ok');
  }
  if (pathname === '/' || pathname === '/index.html') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) { res.writeHead(500); return res.end('index.html unavailable'); }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(data);
    });
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
});
const wss = new WebSocket.Server({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://localhost').pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
wss.on('connection', ws => {
  ws.on('message', raw => {
    if (Buffer.byteLength(raw) > MAX_MESSAGE_BYTES) return ws.close(1009, 'message too large');
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'join') {
      if (ws.room) leave(ws);
      const name = msg.room;
      if (!validRoom(name)) return send(ws, { t: 'error', error: 'Nome de sala inválido.' });
      let room = rooms.get(name);
      if (!room) { room = { name, peers: new Map() }; rooms.set(name, room); }
      if (room.peers.size >= MAX_ROOM_PLAYERS) return send(ws, { t: 'error', error: 'Sala cheia (máximo 12 jogadores).' });
      const peerId = Math.random().toString(36).slice(2, 10);
      const peer = { id: peerId, ws };
      ws.peerId = peerId; ws.room = room;
      room.peers.set(peerId, peer);
      send(ws, { t: 'welcome', peer: peerId, peers: [...room.peers.keys()].filter(id => id !== peerId) });
      roomBroadcast(room, { t: 'join', peer: peerId }, ws);
      return;
    }
    if (!ws.room || !ws.peerId) return;
    if (msg.t === 'pres') {
      if (!msg.presence || typeof msg.presence !== 'object') return;
      // Presence is only relayed; clients throttle and send only changes.
      roomBroadcast(ws.room, { t: 'pres', peer: ws.peerId, presence: msg.presence }, ws);
      return;
    }
    if (msg.t === 'ev') {
      if (typeof msg.topic !== 'string' || msg.topic.length > 32 || !msg.data || typeof msg.data !== 'object') return;
      roomBroadcast(ws.room, { t: 'ev', peer: ws.peerId, topic: msg.topic, data: msg.data }, ws);
    }
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});
server.listen(PORT, '0.0.0.0', () => console.log(`Tank Arena listening on ${PORT}`));
