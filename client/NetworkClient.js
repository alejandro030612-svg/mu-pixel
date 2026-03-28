'use strict';

/**
 * NetworkClient.js - Gestiona la conexión Socket.io con el servidor.
 */
class NetworkClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.ping = 0;
    this._pingInterval = null;
    this._handlers = {};
  }

  // ─── Conexión ─────────────────────────────────────────────────────────────

  connect(host, port) {
    return new Promise((resolve, reject) => {
      const url = `http://${host}:${port}`;
      const timeout = setTimeout(() => {
        reject(new Error('Tiempo de espera agotado (5s)'));
      }, 5000);

      try {
        this.socket = io(url, {
          transports: ['websocket', 'polling'],
          timeout: 5000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
        return;
      }

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.connected = true;
        this._startPing();
        console.log('[NET] Conectado al servidor');
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        this.connected = false;
        reject(new Error(`Error de conexión: ${err.message}`));
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        console.log(`[NET] Desconectado: ${reason}`);
        this._emit('disconnect', reason);
      });

      // ── Eventos del servidor ──────────────────────────────────────────────

      const events = [
        'gameState', 'playerJoined', 'playerLeft', 'playerMoved',
        'playerUpdate', 'playerDied', 'respawn',
        'monsterDied', 'monsterSpawned', 'worldUpdate',
        'damage', 'expGain', 'levelUp',
        'itemsDropped', 'itemPickedUp', 'itemRemoved',
        'chatMessage', 'broadcast'
      ];

      events.forEach(ev => {
        this.socket.on(ev, (data) => this._emit(ev, data));
      });
    });
  }

  disconnect() {
    if (this._pingInterval) clearInterval(this._pingInterval);
    if (this.socket) this.socket.disconnect();
    this.connected = false;
  }

  // ─── Enviar acciones ─────────────────────────────────────────────────────

  createCharacter(name, charClass) {
    this._send('characterCreate', { name, charClass });
  }

  move(x, y) {
    this._send('move', { x, y });
  }

  attack(targetId) {
    this._send('attack', { targetId });
  }

  pickupItem(itemId) {
    this._send('pickupItem', { itemId });
  }

  useItem(type) {
    this._send('useItem', { type });
  }

  chat(message) {
    this._send('chat', { message });
  }

  // ─── Sistema de eventos ───────────────────────────────────────────────────

  on(event, handler) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
  }

  off(event, handler) {
    if (!this._handlers[event]) return;
    this._handlers[event] = this._handlers[event].filter(h => h !== handler);
  }

  _emit(event, data) {
    const handlers = this._handlers[event];
    if (handlers) handlers.forEach(h => h(data));
  }

  // ─── Internos ─────────────────────────────────────────────────────────────

  _send(event, data) {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    }
  }

  _startPing() {
    if (this._pingInterval) clearInterval(this._pingInterval);
    this._pingInterval = setInterval(() => {
      const t0 = Date.now();
      this.socket.emit('ping', (serverTime) => {
        this.ping = Date.now() - t0;
        this._emit('pingUpdate', this.ping);
      });
    }, 3000);
  }
}

window.NetworkClient = NetworkClient;
