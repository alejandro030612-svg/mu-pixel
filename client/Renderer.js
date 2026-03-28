'use strict';

/**
 * Renderer.js - Motor isométrico pixel art.
 *
 * Vista en tercera persona:
 *   - TH = 40 (tiles más planos, simula perspectiva de suelo)
 *   - El jugador se posiciona al 65 % de la pantalla (cámara arriba/atrás)
 *   - snapToPlayer() para primer frame sin frame negro
 *   - Gradiente de cielo oscuro como fondo
 *   - imageSmoothingEnabled = false siempre (pixel art nítido)
 *
 * Sistema de coordenadas:
 *   worldToScreen(wx, wy) → { x, y } en canvas lógico (mitad de resolución)
 *   screenToWorld(sx, sy) → { x, y } en tiles
 */
class Renderer {
  constructor(gameCanvas) {
    this.canvas = gameCanvas;
    this.ctx    = gameCanvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    // Resolución lógica (se establece en resize)
    this.logicalW = 0;
    this.logicalH = 0;

    // Tile size — TH=40 da más profundidad (apariencia de perspectiva)
    this.TW = 64;
    this.TH = 40;

    // Cámara (en coordenadas de pantalla lógica)
    this.camX = 0;
    this.camY = 0;

    // Zoom
    this.zoom = 1.0;

    // Animaciones
    this._animFrame  = 0;
    this._waterFrame = 0;
    this._waterTimer = 0;

    // Partículas (object pool)
    this._particles    = [];
    this._maxParticles = 50;

    // Números de daño flotantes
    this._damageNumbers = [];

    // Mapa (asignado desde Game.js después de recibir gameState)
    this.mapTiles = null;
    this.mapSize  = 50;
  }

  // ─── Resize ───────────────────────────────────────────────────────────────
  // Mitad de resolución CSS para pixel art nítido.

  resize(w, h) {
    this.logicalW = Math.max(1, Math.floor(w / 2));
    this.logicalH = Math.max(1, Math.floor(h / 2));
    this.canvas.width        = this.logicalW;
    this.canvas.height       = this.logicalH;
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    // Cambiar canvas.width resetea el contexto; re-aplicar pixel art
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
  }

  // ─── Proyección isométrica ────────────────────────────────────────────────

  worldToScreen(wx, wy) {
    const tw = this.TW / 2;
    const th = this.TH / 2;
    return {
      x: (wx - wy) * tw * this.zoom - this.camX + this.logicalW * 0.5,
      y: (wx + wy) * th * this.zoom - this.camY + this.logicalH * 0.65
      //                                                          ^^^^
      // jugador al 65% de la pantalla → cámara "arriba y detrás"
    };
  }

  screenToWorld(sx, sy) {
    const tw = this.TW / 2;
    const th = this.TH / 2;
    const rx = (sx - this.logicalW * 0.5  + this.camX) / this.zoom;
    const ry = (sy - this.logicalH * 0.65 + this.camY) / this.zoom;
    return {
      x: Math.floor((rx / tw + ry / th) / 2),
      y: Math.floor((ry / th - rx / tw) / 2)
    };
  }

  domToLogical(domX, domY) {
    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = this.logicalW / rect.width;
    const scaleY = this.logicalH / rect.height;
    return {
      x: (domX - rect.left) * scaleX,
      y: (domY - rect.top)  * scaleY
    };
  }

  // ─── Snap / Follow ────────────────────────────────────────────────────────

  /**
   * Coloca la cámara instantáneamente sobre el jugador (usar al inicio).
   */
  snapToPlayer(player) {
    const tw = this.TW / 2;
    const th = this.TH / 2;
    this.camX = (player.x - player.y) * tw * this.zoom;
    this.camY = (player.x + player.y) * th * this.zoom;
  }

  _followPlayer(player, dt) {
    const tw = this.TW / 2;
    const th = this.TH / 2;
    // Posición de cámara que centraría al jugador en (50%, 65%)
    const targetCamX = (player.x - player.y) * tw * this.zoom;
    const targetCamY = (player.x + player.y) * th * this.zoom;
    // Lerp suave — más rápido (10×/s) para sensación de control responsivo
    const alpha = Math.min(1, (dt || 0.016) * 10);
    this.camX += (targetCamX - this.camX) * alpha;
    this.camY += (targetCamY - this.camY) * alpha;
  }

  // ─── Frame principal ───────────────────────────────────────────────────────

  render(state, playerSelf, dt) {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;          // siempre por si se resetea
    ctx.clearRect(0, 0, this.logicalW, this.logicalH);

    // ── Fondo: gradiente de cielo oscuro (simula profundidad) ────────────────
    const sky = ctx.createLinearGradient(0, 0, 0, this.logicalH);
    sky.addColorStop(0,   '#06061A');
    sky.addColorStop(0.5, '#0A0A20');
    sky.addColorStop(1,   '#111128');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.logicalW, this.logicalH);

    if (!this.mapTiles) {
      // Mapa aún no llega — mostrar mensaje de espera
      ctx.font      = '12px "Courier New"';
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'center';
      ctx.fillText('Cargando mapa...', this.logicalW / 2, this.logicalH / 2);
      return;
    }

    this._updateAnimations(dt);

    // Seguir al jugador
    if (playerSelf) this._followPlayer(playerSelf, dt);

    // Culling: rango de tiles visibles
    const { minX, maxX, minY, maxY } = this._getVisibleRange();

    // ── Capa 0: Suelo ────────────────────────────────────────────────────────
    this._renderGround(ctx, minX, maxX, minY, maxY);

    // ── Capas 1-4: Entidades (painter's algorithm — ordenadas por Y) ─────────
    const renderables = [];

    if (state.items)    state.items.forEach(   i => renderables.push({ y: i.y, type: 'item',    data: i }));
    if (state.monsters) state.monsters.forEach(m => renderables.push({ y: m.y, type: 'monster', data: m }));
    if (state.players)  state.players.forEach( p => renderables.push({ y: p.y, type: 'player',  data: p }));

    if (playerSelf && !state.players?.find(p => p.id === playerSelf.id)) {
      renderables.push({ y: playerSelf.y, type: 'player', data: playerSelf });
    }

    renderables.sort((a, b) => a.y - b.y);
    renderables.forEach(r => {
      switch (r.type) {
        case 'item':    this._renderItem(ctx, r.data);               break;
        case 'monster': this._renderMonster(ctx, r.data);            break;
        case 'player':  this._renderPlayer(ctx, r.data, playerSelf); break;
      }
    });

    // ── Capa 5: Partículas ───────────────────────────────────────────────────
    this._renderParticles(ctx, dt);

    // ── Capa 6: Números de daño ───────────────────────────────────────────────
    this._renderDamageNumbers(ctx, dt);
  }

  // ─── Animaciones ──────────────────────────────────────────────────────────

  _updateAnimations(dt) {
    this._animFrame   = (this._animFrame + dt * 8) % 4;
    this._waterTimer += dt;
    if (this._waterTimer > 0.125) {
      this._waterTimer  = 0;
      this._waterFrame  = (this._waterFrame + 1) % 3;
    }
  }

  // ─── Culling ──────────────────────────────────────────────────────────────

  _getVisibleRange() {
    const margin  = 4;
    const corners = [
      this.screenToWorld(0,             0            ),
      this.screenToWorld(this.logicalW, 0            ),
      this.screenToWorld(0,             this.logicalH),
      this.screenToWorld(this.logicalW, this.logicalH)
    ];
    const xs = corners.map(c => c.x);
    const ys = corners.map(c => c.y);
    return {
      minX: Math.max(0,               Math.min(...xs) - margin),
      maxX: Math.min(this.mapSize - 1, Math.max(...xs) + margin),
      minY: Math.max(0,               Math.min(...ys) - margin),
      maxY: Math.min(this.mapSize - 1, Math.max(...ys) + margin)
    };
  }

  // ─── Render Ground ────────────────────────────────────────────────────────

  _renderGround(ctx, minX, maxX, minY, maxY) {
    const TW = this.TW * this.zoom;
    const TH = this.TH * this.zoom;

    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (!this.mapTiles[ty]) continue;
        const tileType = this.mapTiles[ty][tx];
        const def      = Sprites.TILE_DEFS[tileType];
        if (!def) continue;

        const sc = this.worldToScreen(tx, ty);

        let topColor = def.top;
        if (tileType === 2) {
          topColor = [Sprites.PAL.WATER, Sprites.PAL.WATER2, '#3498DB'][this._waterFrame];
        }
        if (tileType === 0 && ((tx + ty) % 3 === 0)) {
          topColor = Sprites.PAL.GRASS2;
        }

        const h = (def.h || 0) * this.zoom;
        Sprites.drawIsoTile(ctx, sc.x, sc.y, TW, TH, topColor, def.left, def.right, h);

        if (tileType === 3) this._renderTree(ctx, sc.x, sc.y);
      }
    }
  }

  _renderTree(ctx, sx, sy) {
    const z = this.zoom;
    ctx.fillStyle = Sprites.PAL.TREE_TRUNK;
    ctx.fillRect(sx - 3*z, sy - 26*z, 6*z, 10*z);
    ctx.fillStyle = Sprites.PAL.TREE_TR3;
    ctx.beginPath();
    ctx.moveTo(sx,        sy - 42*z);
    ctx.lineTo(sx + 14*z, sy - 22*z);
    ctx.lineTo(sx - 14*z, sy - 22*z);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = Sprites.PAL.TREE_TR;
    ctx.beginPath();
    ctx.moveTo(sx,        sy - 34*z);
    ctx.lineTo(sx + 10*z, sy - 18*z);
    ctx.lineTo(sx - 10*z, sy - 18*z);
    ctx.closePath();
    ctx.fill();
  }

  // ─── Render Player ────────────────────────────────────────────────────────

  _renderPlayer(ctx, player, selfPlayer) {
    const sc     = this.worldToScreen(player.x, player.y);
    const z      = this.zoom;
    const isSelf = selfPlayer && player.id === selfPlayer.id;
    const scale  = Math.max(1, Math.floor(z * 2));

    // Sombra
    Sprites.drawShadow(ctx, sc.x, sc.y, 12*z, 5*z);

    // Animación de movimiento
    const frame   = Math.floor(this._animFrame) % 2;
    const offsetY = player.state === 'moving' ? (frame === 0 ? -1 : 0) : 0;

    // Sprite
    const spriteData = Sprites.PLAYER[player.class] || Sprites.PLAYER.DK;
    const spriteW    = spriteData[0].length * scale;
    const spriteH    = spriteData.length    * scale;
    Sprites.draw(ctx, spriteData, sc.x - spriteW / 2, sc.y - spriteH + offsetY * z, scale);

    // Efecto de veneno — tinte púrpura pulsante
    if (player.poisoned) {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(Date.now() / 150) * 0.15;
      ctx.fillStyle   = '#8E44AD';
      ctx.fillRect(sc.x - spriteW / 2, sc.y - spriteH + offsetY * z, spriteW, spriteH);
      ctx.restore();
    }

    // Barra de HP
    this._drawHealthBar(ctx, sc.x, sc.y - spriteH - 4, player.hp, player.maxHp, 26, 3, z);

    // Nombre + nivel
    ctx.save();
    ctx.textAlign = 'center';
    if (player.level > 1) {
      ctx.font      = `${Math.max(7, 7*z)}px "Courier New"`;
      ctx.fillStyle = '#AAAAAA';
      ctx.fillText(`Lv${player.level}`, sc.x, sc.y - spriteH - 16);
    }
    ctx.font      = `${Math.max(8, 8*z)}px "Courier New"`;
    ctx.fillStyle = isSelf ? '#FFD700' : '#FFFFFF';
    ctx.fillText(player.name, sc.x, sc.y - spriteH - 6);
    ctx.restore();

    // Anillo de selección en el jugador propio
    if (isSelf) {
      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 300) * 0.3;
      ctx.beginPath();
      ctx.ellipse(sc.x, sc.y, 14*z, 6*z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ─── Render Monster ───────────────────────────────────────────────────────

  _renderMonster(ctx, monster) {
    if (monster.state === 'dead') return;
    const sc    = this.worldToScreen(monster.x, monster.y);
    const z     = this.zoom;
    const scale = Math.max(1, Math.floor(z * 1.8));

    Sprites.drawShadow(ctx, sc.x, sc.y, 10*z, 4*z);

    const frame   = Math.floor(this._animFrame) % 2;
    const offsetY = monster.state === 'chasing' ? (frame === 0 ? -1 : 0) : 0;

    const spriteData = Sprites.MONSTER[monster.type];
    if (spriteData) {
      const sw = spriteData[0].length * scale;
      const sh = spriteData.length    * scale;
      Sprites.draw(ctx, spriteData, sc.x - sw / 2, sc.y - sh + offsetY * z, scale);
      this._drawHealthBar(ctx, sc.x, sc.y - sh - 2, monster.hp, monster.maxHp, 22, 3, z);
      ctx.save();
      ctx.font      = `${Math.max(7, 7*z)}px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.fillStyle = monster.poisonOnHit > 0 ? '#C39BD3' : '#FF8888';
      ctx.fillText(monster.name, sc.x, sc.y - sh - 6);
      ctx.restore();
    } else {
      ctx.fillStyle = monster.color || '#E74C3C';
      ctx.fillRect(sc.x - 8*z, sc.y - 16*z, 16*z, 16*z);
    }
  }

  // ─── Render Item ──────────────────────────────────────────────────────────

  _renderItem(ctx, item) {
    const sc = this.worldToScreen(item.x, item.y);
    const z  = this.zoom;
    const t  = Date.now() / 1000;

    // ── Drop Box: cofre con brillo dorado pulsante ────────────────────────────
    if (item.type === 'drop_box') {
      const scale   = Math.max(1, Math.floor(z * 2));
      const pulse   = 0.45 + Math.sin(t * Math.PI * 2.5) * 0.30;
      const sprData = Sprites.ITEM.drop_box;
      if (!sprData) return;
      const sw = sprData[0].length * scale;
      const sh = sprData.length    * scale;

      ctx.save();
      ctx.globalAlpha = pulse * 0.55;
      ctx.fillStyle   = '#FFD700';
      ctx.beginPath();
      ctx.ellipse(sc.x, sc.y - sh * 0.4, sw * 0.7, sh * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      Sprites.draw(ctx, sprData, sc.x - sw / 2, sc.y - sh + 2 * z, scale);
      const count = (item.contents || []).length;
      if (count > 0) {
        ctx.font      = `bold ${Math.max(8, 9 * z)}px "Courier New"`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText(`★${count}`, sc.x + 1, sc.y - sh - 3 * z + 1);
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`★${count}`, sc.x,     sc.y - sh - 3 * z);
      }
      ctx.restore();
      return;
    }

    // ── Items normales ────────────────────────────────────────────────────────
    const alpha = 0.5 + Math.sin(t * Math.PI * 2) * 0.3;
    const scale = Math.max(1, Math.floor(z * 1.5));

    ctx.save();
    ctx.globalAlpha = alpha;

    const spriteData = Sprites.ITEM[item.type];
    if (spriteData) {
      const sw = spriteData[0].length * scale;
      const sh = spriteData.length    * scale;
      Sprites.draw(ctx, spriteData, sc.x - sw / 2, sc.y - sh / 2, scale);
    } else {
      ctx.fillStyle = item.type === 'gold' ? '#F1C40F' : '#E74C3C';
      ctx.fillRect(sc.x - 4*z, sc.y - 4*z, 8*z, 8*z);
    }

    ctx.font      = `${Math.max(7, 7 * z)}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = item.type === 'gold' ? '#FFD700' : '#FF6666';
    const label   = item.type === 'gold'      ? `${item.amount}G`
                  : item.type === 'hp_potion' ? 'POT'
                  : 'ITM';
    ctx.fillText(label, sc.x, sc.y - 8 * z);
    ctx.restore();
  }

  // ─── Health Bar ───────────────────────────────────────────────────────────

  _drawHealthBar(ctx, cx, cy, hp, maxHp, width, height, z) {
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const w = width * z, h = height * z;
    ctx.fillStyle = '#330000';
    ctx.fillRect(cx - w / 2, cy, w, h);
    ctx.fillStyle = ratio > 0.5 ? '#2ECC71' : ratio > 0.25 ? '#F39C12' : '#E74C3C';
    ctx.fillRect(cx - w / 2, cy, w * ratio, h);
  }

  // ─── Partículas ───────────────────────────────────────────────────────────

  spawnDeathParticles(wx, wy, color) {
    for (let i = 0; i < 12; i++) {
      if (this._particles.length >= this._maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 40;
      this._particles.push({
        wx, wy,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 30,
        color: color || '#E74C3C',
        life:  1.0,
        size:  2 + Math.random() * 3
      });
    }
  }

  _renderParticles(ctx, dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt * 1.5;
      if (p.life <= 0) { this._particles.splice(i, 1); continue; }
      p.wx += p.vx * dt;
      p.wy += p.vy * dt;
      p.vy += 60 * dt;
      const sc = this.worldToScreen(p.wx / this.TW, p.wy / this.TH);
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = p.color;
      ctx.fillRect(sc.x, sc.y, p.size * this.zoom, p.size * this.zoom);
      ctx.restore();
    }
  }

  // ─── Números de daño flotantes ────────────────────────────────────────────

  spawnDamageNumber(wx, wy, damage, isCrit, received, opts) {
    const o = opts || {};
    let text, color, size;

    if (o.isMiss) {
      text = 'MISS';           color = '#AAAAAA'; size = 9;
    } else if (o.isBlocked) {
      text = `${damage} BLK`;  color = '#70AEFF'; size = 9;
    } else if (o.isPoison) {
      text = `-${damage}☠`;    color = '#C39BD3'; size = 10;
    } else if (isCrit) {
      text = `${damage}!!`;    color = received ? '#FF6666' : '#FFD700'; size = 13;
    } else {
      text = `${damage}`;      color = received ? '#FF4444' : '#FFFFFF'; size = 10;
    }

    this._damageNumbers.push({ wx, wy, vy: -60, text, color, life: 1.5, size });
  }

  _renderDamageNumbers(ctx, dt) {
    for (let i = this._damageNumbers.length - 1; i >= 0; i--) {
      const n = this._damageNumbers[i];
      n.life -= dt;
      if (n.life <= 0) { this._damageNumbers.splice(i, 1); continue; }
      n.wy += n.vy * dt;
      n.vy += 20  * dt;
      const sc    = this.worldToScreen(n.wx, n.wy);
      const alpha = Math.min(1, n.life * 2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font        = `bold ${Math.floor(n.size * this.zoom)}px "Courier New"`;
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#000';
      ctx.fillText(n.text, sc.x + 1, sc.y + 1);
      ctx.fillStyle   = n.color;
      ctx.fillText(n.text, sc.x, sc.y);
      ctx.restore();
    }
  }

  // ─── Logo animado ─────────────────────────────────────────────────────────

  static drawLogo(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const w = canvas.width, h = canvas.height;

    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
    grad.addColorStop(0, '#1A0040');
    grad.addColorStop(1, '#000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const pixels = [
      [1,0,0,0,1, 0, 1,1,1,1,1],
      [1,1,0,1,1, 0, 1,0,0,0,0],
      [1,0,1,0,1, 0, 1,0,0,0,0],
      [1,0,0,0,1, 0, 1,1,1,1,0],
      [1,0,0,0,1, 0, 1,0,0,0,0],
      [1,0,0,0,1, 0, 1,0,0,0,0],
      [1,0,0,0,1, 0, 1,1,1,1,1],
    ];
    const ps     = 7;
    const startX = (w - pixels[0].length * ps) / 2;
    const startY = (h - pixels.length    * ps) / 2 - 10;
    pixels.forEach((row, ry) => {
      row.forEach((on, rx) => {
        if (on) {
          ctx.fillStyle = '#FFD700';
          ctx.fillRect(startX + rx*ps, startY + ry*ps, ps-1, ps-1);
        }
      });
    });

    ctx.font      = 'bold 9px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8888FF';
    ctx.fillText('PIXEL REALM', w/2, startY + pixels.length*ps + 14);
  }

  // ─── Preview de clase ─────────────────────────────────────────────────────

  static drawClassPreview(canvas, charClass) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0A0A14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sprite = Sprites.PLAYER[charClass] || Sprites.PLAYER.DK;
    const scale  = 4;
    const sw     = sprite[0].length * scale;
    const sh     = sprite.length    * scale;
    Sprites.draw(ctx, sprite, (canvas.width - sw) / 2, (canvas.height - sh) / 2, scale);
  }
}

window.Renderer = Renderer;
