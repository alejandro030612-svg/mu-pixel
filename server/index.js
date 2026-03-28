'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');

const GameWorld = require('./GameWorld');
const Player = require('./Player');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Servir archivos estáticos del cliente (opcional, para debug en navegador)
app.use(express.static(path.join(__dirname, '..', 'client')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: gameWorld.players.size, uptime: process.uptime() });
});

// ─── GameWorld ───────────────────────────────────────────────────────────────

const gameWorld = new GameWorld(io);

// ─── Socket.io ───────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] Conectado: ${socket.id} | IP: ${socket.handshake.address}`);

  let currentPlayer = null;

  // ── Crear personaje ──────────────────────────────────────────────────────
  socket.on('characterCreate', ({ name, charClass }) => {
    if (currentPlayer) return;

    const cleanName = String(name || 'Hero').slice(0, 16).replace(/[^a-zA-Z0-9_\- ]/g, '');
    const validClasses = ['DK', 'DW', 'ELF'];
    const cls = validClasses.includes(charClass) ? charClass : 'DK';

    currentPlayer = new Player(socket.id, cleanName, cls);
    gameWorld.addPlayer(currentPlayer);

    // Enviar estado inicial al jugador que se une
    socket.emit('gameState', {
      playerId: socket.id,
      player: currentPlayer.toJSON(),
      map: gameWorld.getMap(),
      players: [...gameWorld.players.values()].map(p => p.toJSON()),
      monsters: [...gameWorld.monsters.values()].filter(m => !m.isDead()).map(m => m.toJSON()),
      items: [...gameWorld.items.values()]
    });

    // Notificar a los demás
    socket.broadcast.emit('playerJoined', currentPlayer.toJSON());
    console.log(`[*] Personaje creado: ${cleanName} (${cls})`);
  });

  // ── Movimiento ────────────────────────────────────────────────────────────
  socket.on('move', ({ x, y }) => {
    if (!currentPlayer) return;
    const updated = gameWorld.movePlayer(socket.id, x, y);
    if (updated) {
      io.emit('playerMoved', updated);
    }
  });

  // ── Ataque ────────────────────────────────────────────────────────────────
  socket.on('attack', ({ targetId }) => {
    if (!currentPlayer) return;
    const result = gameWorld.playerAttack(socket.id, targetId);
    if (!result) return;

    // Daño
    io.emit('damage', {
      attackerId: socket.id,
      targetId,
      damage:     result.damage,
      isCrit:     result.isCrit,
      isBlocked:  result.isBlocked,
      isMiss:     result.isMiss,
      dmgType:    result.dmgType,
      targetHp:   result.targetHp,
      targetMaxHp: result.targetMaxHp
    });

    // EXP al atacante
    if (result.monsterDied) {
      socket.emit('expGain', {
        amount:    result.exp,
        currentExp: result.playerExp,
        expToNext: result.playerExpToNext
      });

      if (result.leveledUp) {
        socket.emit('levelUp', {
          level:  result.playerLevel,
          player: currentPlayer.toJSON()
        });
        io.emit('broadcast', {
          msg:  `¡${currentPlayer.name} subió al nivel ${result.playerLevel}!`,
          type: 'levelup'
        });
      }

      // Caja de drops (reemplaza drops sueltos)
      if (result.dropBox) {
        io.emit('itemsDropped', { drops: [result.dropBox] });
      }
    }

    // Actualizar estado del jugador al atacante
    socket.emit('playerUpdate', currentPlayer.toJSON());
  });

  // ── Recoger item ──────────────────────────────────────────────────────────
  socket.on('pickupItem', ({ itemId }) => {
    if (!currentPlayer) return;
    const result = gameWorld.playerPickup(socket.id, itemId);
    if (!result) return;

    socket.emit('itemPickedUp', {
      itemId:    result.itemId,
      item:      result.item,
      gold:      result.playerGold,
      inventory: currentPlayer.inventory
    });
    // Actualizar stats del jugador (gold puede haber cambiado)
    socket.emit('playerUpdate', currentPlayer.toJSON());
    io.emit('itemRemoved', { itemId: result.itemId });
  });

  // ── Usar poción ───────────────────────────────────────────────────────────
  socket.on('useItem', ({ type }) => {
    if (!currentPlayer) return;
    if (type === 'hp_potion') {
      const idx = currentPlayer.inventory.findIndex(i => i.type === 'hp_potion');
      if (idx !== -1) {
        currentPlayer.inventory.splice(idx, 1);
        currentPlayer.useHpPotion(50);
        socket.emit('playerUpdate', currentPlayer.toJSON());
      }
    }
  });

  // ── Chat ──────────────────────────────────────────────────────────────────
  socket.on('chat', ({ message }) => {
    if (!currentPlayer) return;
    const clean = String(message || '').slice(0, 100);
    if (!clean.trim()) return;
    io.emit('chatMessage', {
      playerId: socket.id,
      name: currentPlayer.name,
      message: clean,
      ts: Date.now()
    });
  });

  // ── Ping ──────────────────────────────────────────────────────────────────
  socket.on('ping', (cb) => {
    if (typeof cb === 'function') cb(Date.now());
  });

  // ── Desconexión ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (currentPlayer) {
      console.log(`[-] Desconectado: ${currentPlayer.name}`);
      gameWorld.removePlayer(socket.id);
      io.emit('playerLeft', { playerId: socket.id });
      currentPlayer = null;
    }
  });
});

// ─── Game Loop (20 ticks/s) ───────────────────────────────────────────────────

let lastWorldBroadcast = 0;
setInterval(() => {
  gameWorld.update();
  const now = Date.now();
  // Enviar mundo completo cada 100ms (monsters + items)
  if (now - lastWorldBroadcast >= 100) {
    lastWorldBroadcast = now;
    io.emit('worldUpdate', {
      monsters: [...gameWorld.monsters.values()].filter(m => !m.isDead()).map(m => m.toJSON()),
      items: [...gameWorld.items.values()]
    });
  }
}, 50);

// ─── Iniciar servidor ────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║      MU PIXEL REALM  - SERVIDOR      ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Puerto: ${PORT}                          ║`);
  console.log('║  IPs disponibles:                    ║');
  Object.values(nets).flat()
    .filter(n => n && n.family === 'IPv4' && !n.internal)
    .forEach(n => {
      const url = `http://${n.address}:${PORT}`;
      console.log(`║  → ${url.padEnd(34)} ║`);
    });
  console.log(`║  → http://localhost:${PORT}               ║`);
  console.log('╠══════════════════════════════════════╣');
  console.log('║  Ctrl+C para detener                 ║');
  console.log('╚══════════════════════════════════════╝\n');
});

process.on('SIGTERM', () => { server.close(); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
