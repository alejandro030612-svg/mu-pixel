'use strict';

/**
 * InputHandler.js - Coordina entrada táctil y de teclado.
 * Traduce inputs a acciones del juego.
 */
class InputHandler {
  constructor(touchControls, renderer, game) {
    this.tc       = touchControls;
    this.renderer = renderer;
    this.game     = game;

    // Estado de movimiento continuo por joystick
    this._moveDir  = { x: 0, y: 0 };
    this._moveMag  = 0;
    this._moveAccum = { x: 0, y: 0 }; // acumulador para envío al servidor

    // Autoataque al objetivo seleccionado
    this._autoAttack = false;
    this._autoAttackTimer = 0;

    // Target seleccionado
    this.selectedTargetId = null;

    this._setupTouchCallbacks();
    this._setupKeyboard();
  }

  _setupTouchCallbacks() {
    // Joystick
    this.tc.onMove = (dx, dy, mag) => {
      this._moveDir = { x: dx, y: dy };
      this._moveMag = mag;
    };

    // Botones
    this.tc.onButton = (name) => {
      switch (name) {
        case 'ATK':
          if (this.selectedTargetId) {
            this.game.playerAttack(this.selectedTargetId);
            this._autoAttack = true;
          }
          break;
        case 'PICK':
          this.game.pickupNearestItem();
          break;
        case 'POT':
          this.game.useItem('hp_potion');
          break;
        case 'SKL':
          this.game.useSkill();
          break;
      }
    };

    // Tap en mundo
    this.tc.onTap = (screenX, screenY) => {
      this._handleTap(screenX, screenY);
    };

    // Long press
    this.tc.onLongPress = (screenX, screenY) => {
      this._handleLongPress(screenX, screenY);
    };

    // Pinch zoom
    this.tc.onPinch = (delta) => {
      const zoomSpeed = 0.005;
      this.renderer.zoom = Math.max(0.5, Math.min(2.0, this.renderer.zoom + delta * zoomSpeed));
    };
  }

  _handleTap(domX, domY) {
    // Convertir posición DOM a posición lógica del canvas del juego
    const gc = this.renderer.canvas;
    const rect = gc.getBoundingClientRect();
    const lx = (domX - rect.left) * (this.renderer.logicalW / rect.width);
    const ly = (domY - rect.top)  * (this.renderer.logicalH / rect.height);

    // ¿Tap en monstruo?
    const monster = this._hitTestMonsters(lx, ly);
    if (monster) {
      this.selectedTargetId = monster.id;
      this._autoAttack = true;
      this.game.playerAttack(monster.id);
      return;
    }

    // ¿Tap en jugador?
    const otherPlayer = this._hitTestPlayers(lx, ly);
    if (otherPlayer) {
      this.game.ui.showPlayerInfo(otherPlayer);
      return;
    }

    // ¿Tap en item?
    const item = this._hitTestItems(lx, ly);
    if (item) {
      this.game.net.pickupItem(item.id);
      return;
    }

    // Tap en tile: mover
    const worldPos = this.renderer.screenToWorld(lx, ly);
    this.selectedTargetId = null;
    this._autoAttack = false;
    this.game.moveToPosition(worldPos.x + 0.5, worldPos.y + 0.5);
  }

  _handleLongPress(domX, domY) {
    const gc = this.renderer.canvas;
    const rect = gc.getBoundingClientRect();
    const lx = (domX - rect.left) * (this.renderer.logicalW / rect.width);
    const ly = (domY - rect.top)  * (this.renderer.logicalH / rect.height);
    const worldPos = this.renderer.screenToWorld(lx, ly);
    this.game.ui.showContextMenu(worldPos.x, worldPos.y);
  }

  // ─── Hit testing contra entidades ─────────────────────────────────────────

  _hitTestMonsters(lx, ly) {
    const state = this.game.state;
    if (!state.monsters) return null;
    for (const m of state.monsters) {
      if (m.state === 'dead') continue;
      const sc = this.renderer.worldToScreen(m.x, m.y);
      const dx = lx - sc.x, dy = ly - sc.y;
      const r = 12 * this.renderer.zoom;
      if (dx*dx + dy*dy < r*r) return m;
    }
    return null;
  }

  _hitTestPlayers(lx, ly) {
    const state = this.game.state;
    if (!state.players) return null;
    for (const p of state.players) {
      if (p.id === this.game.playerId) continue;
      const sc = this.renderer.worldToScreen(p.x, p.y);
      const dx = lx - sc.x, dy = ly - sc.y;
      const r = 12 * this.renderer.zoom;
      if (dx*dx + dy*dy < r*r) return p;
    }
    return null;
  }

  _hitTestItems(lx, ly) {
    const state = this.game.state;
    if (!state.items) return null;
    for (const item of state.items) {
      const sc = this.renderer.worldToScreen(item.x, item.y);
      const dx = lx - sc.x, dy = ly - sc.y;
      const r = 10 * this.renderer.zoom;
      if (dx*dx + dy*dy < r*r) return item;
    }
    return null;
  }

  // ─── Teclado (para debug en PC) ───────────────────────────────────────────

  _setupKeyboard() {
    const keys = new Set();
    window.addEventListener('keydown', e => keys.add(e.code));
    window.addEventListener('keyup',   e => keys.delete(e.code));
    this._keys = keys;
  }

  _getKeyboardDir() {
    let x = 0, y = 0;
    if (this._keys.has('ArrowUp')    || this._keys.has('KeyW')) y -= 1;
    if (this._keys.has('ArrowDown')  || this._keys.has('KeyS')) y += 1;
    if (this._keys.has('ArrowLeft')  || this._keys.has('KeyA')) x -= 1;
    if (this._keys.has('ArrowRight') || this._keys.has('KeyD')) x += 1;
    if (x !== 0 || y !== 0) {
      const len = Math.sqrt(x*x + y*y);
      return { x: x/len, y: y/len, mag: 1 };
    }
    return null;
  }

  // ─── Update (llamado cada frame) ──────────────────────────────────────────

  update(dt) {
    // Teclado override
    const kDir = this._getKeyboardDir();
    if (kDir) {
      this._moveDir = { x: kDir.x, y: kDir.y };
      this._moveMag = kDir.mag;
    }

    // Movimiento por joystick / teclado
    if (this._moveMag > 0.15) {
      const player = this.game.selfPlayer;
      if (!player || player.state === 'dead') return;

      // Convertir dirección joystick a movimiento isométrico
      // El joystick apunta en pantalla; necesitamos mapearlo a coords de mundo
      const dx = this._moveDir.x;
      const dy = this._moveDir.y;
      // Rotación isométrica: 45 grados
      const speed = 3.5 * this._moveMag * dt;
      const isoX = (dx - dy) * speed;  // world X
      const isoY = (dx + dy) * speed;  // world Y (en isométrico Y sube a derecha)

      const newX = player.x + isoX;
      const newY = player.y + isoY;

      // Enviar posición al servidor con throttle (máx 15 veces/segundo)
      this._moveAccum.x += isoX;
      this._moveAccum.y += isoY;
      this._moveTimer = (this._moveTimer || 0) + dt;
      if (this._moveTimer >= 0.067) { // ~15 Hz
        this._moveTimer = 0;
        this.game.moveToPosition(newX, newY);
        this._moveAccum = { x: 0, y: 0 };
      }

      // Actualizar localmente para movimiento fluido
      player.x = newX;
      player.y = newY;
      player.state = 'moving';
    } else if (this._moveMag === 0) {
      if (this.game.selfPlayer) this.game.selfPlayer.state = 'idle';
    }

    // Autoataque
    if (this._autoAttack && this.selectedTargetId) {
      this._autoAttackTimer += dt;
      if (this._autoAttackTimer >= 1.0) {
        this._autoAttackTimer = 0;
        this.game.playerAttack(this.selectedTargetId);
      }
    }

    // Tecla espacio = atacar
    if (this._keys.has('Space') && this.selectedTargetId) {
      this.game.playerAttack(this.selectedTargetId);
    }
    // Tecla F = poción
    if (this._keys.has('KeyF')) {
      this.game.useItem('hp_potion');
    }
  }
}

window.InputHandler = InputHandler;
