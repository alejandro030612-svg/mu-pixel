'use strict';

/**
 * UI.js - HUD: barras de HP/MP/EXP, minimap, chat, inventario, notificaciones.
 * Se dibuja en el ui-canvas overlay junto con TouchControls.
 */
class UI {
  constructor(uiCanvas) {
    this.canvas = uiCanvas;
    this.ctx    = uiCanvas.getContext('2d');
    this.player = null;  // dato del jugador propio
    this.ping   = 0;

    // Minimap
    this.minimapSize  = 100;
    this.minimapOpen  = false;
    this.minimapTiles = null;
    this.mapSize      = 50;

    // Notificaciones
    this._notifications = [];
    this._maxNotif = 4;

    // Chat
    this._chatMessages = [];
    this._maxChat = 30;
    this.chatPanelEl  = null;
    this.chatInputEl  = null;
    this.chatMsgsEl   = null;

    // Context menu
    this._contextMenu = null;
  }

  init() {
    this.chatPanelEl = document.getElementById('chat-panel');
    this.chatInputEl = document.getElementById('chat-input');
    this.chatMsgsEl  = document.getElementById('chat-messages');
    const sendBtn    = document.getElementById('chat-send');

    sendBtn.addEventListener('click', () => this._sendChat());
    this.chatInputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._sendChat();
    });
  }

  _sendChat() {
    const msg = this.chatInputEl.value.trim();
    if (!msg) return;
    this.chatInputEl.value = '';
    if (this._onChat) this._onChat(msg);
  }

  onChat(fn) { this._onChat = fn; }

  // ─── Dibujar HUD completo (llamado cada frame, después de TouchControls) ──

  draw(state) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    if (!this.player) return;

    // ── Barras HP / MP / EXP ─────────────────────────────────────────────────
    this._drawStatusBars(ctx, W, H);

    // ── Minimap ───────────────────────────────────────────────────────────────
    this._drawMinimap(ctx, state);

    // ── Ping ──────────────────────────────────────────────────────────────────
    ctx.save();
    ctx.font = '9px "Courier New"';
    ctx.fillStyle = this.ping < 80 ? '#2ECC71' : this.ping < 200 ? '#F39C12' : '#E74C3C';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.ping}ms`, W - 8, 14);
    ctx.restore();

    // ── Notificaciones ────────────────────────────────────────────────────────
    this._drawNotifications(ctx, W, H);
  }

  // ─── Status bars ──────────────────────────────────────────────────────────

  _drawStatusBars(ctx, W, H) {
    const p = this.player;
    const barW = Math.min(200, W * 0.4);
    const barH = 10;
    const bx = (W - barW) / 2;
    const by = H - 38;

    // EXP bar (delgada, abajo de todo)
    this._bar(ctx, bx, by + 22, barW, 5, '#1A1A00', '#F1C40F', p.exp / p.expToNext, `EXP Lv${p.level}`);

    // HP bar
    this._bar(ctx, bx, by, barW, barH, '#330000', '#2ECC71', p.hp / p.maxHp,
      `HP ${p.hp}/${p.maxHp}`, '#E74C3C');

    // MP bar (a la derecha de HP si hay espacio, o debajo)
    const mpX = bx + barW + 8;
    const mpW = Math.min(100, W * 0.18);
    if (mpX + mpW < W - 80) {
      this._bar(ctx, mpX, by, mpW, barH, '#001133', '#3498DB', p.mp / p.maxMp,
        `MP ${p.mp}/${p.maxMp}`);
    }

    // Nombre + nivel arriba de las barras
    ctx.save();
    ctx.font = 'bold 10px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`${p.name}  Lv${p.level}`, W / 2, by - 6);
    ctx.restore();
  }

  _bar(ctx, x, y, w, h, bgColor, fillColor, ratio, label, altColor) {
    ratio = Math.max(0, Math.min(1, ratio));
    // Fondo
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);
    // Fill
    let color = fillColor;
    if (altColor && ratio < 0.25) color = altColor;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * ratio, h);
    // Borde
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    // Label
    if (label) {
      ctx.save();
      ctx.font = '8px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(label, x + w/2, y + h - 1);
      ctx.restore();
    }
  }

  // ─── Minimap ───────────────────────────────────────────────────────────────

  _drawMinimap(ctx, state) {
    if (!this.minimapTiles) return;
    const S = this.minimapSize;
    const mx = 8, my = 8;
    const tileS = S / this.mapSize;

    ctx.save();
    ctx.globalAlpha = 0.8;

    // Fondo
    ctx.fillStyle = '#000';
    ctx.fillRect(mx, my, S, S);

    // Tiles
    const TILE_COLORS = {
      0: '#2E7D32', 1: '#8D6E63', 2: '#1565C0',
      3: '#1B5E20', 4: '#757575', 5: '#424242', 6: '#546E7A'
    };
    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const t = this.minimapTiles[y] && this.minimapTiles[y][x];
        if (t !== undefined) {
          ctx.fillStyle = TILE_COLORS[t] || '#2E7D32';
          ctx.fillRect(mx + x*tileS, my + y*tileS, Math.ceil(tileS), Math.ceil(tileS));
        }
      }
    }

    // Monstruos (rojo)
    if (state && state.monsters) {
      ctx.fillStyle = '#E74C3C';
      state.monsters.forEach(m => {
        if (m.state !== 'dead') {
          ctx.fillRect(mx + m.x*tileS - 1, my + m.y*tileS - 1, 2, 2);
        }
      });
    }

    // Otros jugadores (blanco)
    if (state && state.players) {
      ctx.fillStyle = '#FFF';
      state.players.forEach(p => {
        if (!this.player || p.id !== this.player.id) {
          ctx.fillRect(mx + p.x*tileS - 1, my + p.y*tileS - 1, 2, 2);
        }
      });
    }

    // Jugador propio (amarillo, parpadeante)
    if (this.player) {
      ctx.fillStyle = `rgba(255,215,0,${0.7 + Math.sin(Date.now()/250)*0.3})`;
      ctx.fillRect(mx + this.player.x*tileS - 2, my + this.player.y*tileS - 2, 4, 4);
    }

    // Borde
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, S, S);

    ctx.restore();
  }

  // ─── Notificaciones ───────────────────────────────────────────────────────

  notify(msg, type) {
    // type: 'info' | 'warn' | 'levelup' | 'item'
    this._notifications.push({
      msg, type: type || 'info',
      life: 3.0,
      maxLife: 3.0
    });
    if (this._notifications.length > this._maxNotif) {
      this._notifications.shift();
    }
  }

  _drawNotifications(ctx, W, H) {
    let y = H / 2 - 60;
    for (let i = this._notifications.length - 1; i >= 0; i--) {
      const n = this._notifications[i];
      n.life -= 0.016; // ~60fps
      if (n.life <= 0) { this._notifications.splice(i, 1); continue; }

      const alpha = Math.min(1, n.life * 2);
      const colors = {
        info: '#FFFFFF', warn: '#E74C3C', levelup: '#FFD700', item: '#2ECC71'
      };
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 11px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(n.msg, W/2 + 1, y + 1);
      ctx.fillStyle = colors[n.type] || '#FFF';
      ctx.fillText(n.msg, W/2, y);
      ctx.restore();
      y -= 16;
    }
  }

  // ─── Chat (HTML) ───────────────────────────────────────────────────────────

  showChat() {
    if (this.chatPanelEl) this.chatPanelEl.style.display = 'flex';
  }

  addChatMessage(data) {
    if (!this.chatMsgsEl) return;
    const div = document.createElement('div');
    div.className = 'msg';

    if (data.type === 'system') {
      div.innerHTML = `<span class="sys">${this._esc(data.message)}</span>`;
    } else if (data.type === 'levelup') {
      div.innerHTML = `<span class="lvlup">★ ${this._esc(data.message)}</span>`;
    } else {
      div.innerHTML = `<span class="name">[${this._esc(data.name || '?')}]</span> ${this._esc(data.message)}`;
    }

    this.chatMsgsEl.appendChild(div);
    this._chatMessages.push(data);
    if (this._chatMessages.length > this._maxChat) this._chatMessages.shift();

    // Auto-scroll
    this.chatMsgsEl.scrollTop = this.chatMsgsEl.scrollHeight;
  }

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─── Info jugador ──────────────────────────────────────────────────────────

  showPlayerInfo(player) {
    this.notify(`${player.name} | Lv${player.level} ${player.class}`, 'info');
  }

  // ─── Context menu ──────────────────────────────────────────────────────────

  showContextMenu(wx, wy) {
    // Simple: solo una notificación por ahora
    this.notify(`[${Math.floor(wx)},${Math.floor(wy)}]`, 'info');
  }
}

window.UI = UI;
