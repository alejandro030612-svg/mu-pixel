'use strict';

/**
 * TouchControls.js - Joystick virtual + botones táctiles.
 * Se dibuja en el ui-canvas overlay (siempre sobre el juego).
 */
class TouchControls {
  constructor(uiCanvas, touchCanvas) {
    this.uiCanvas  = uiCanvas;
    this.uiCtx     = uiCanvas.getContext('2d');
    this.touchCanvas = touchCanvas;

    // Joystick
    this.joyBase   = { x: 0, y: 0 };  // se recalcula en resize
    this.joyKnob   = { x: 0, y: 0 };
    this.joyBaseR  = 55;
    this.joyKnobR  = 22;
    this.joyActive = false;
    this.joyTouchId = null;
    this.direction  = { x: 0, y: 0 };
    this.angle      = 0;
    this.magnitude  = 0;

    // Botones: [ATK, PICK, SKL, POT]
    this.buttons = {};
    this._pressedButtons = new Set();

    // Callbacks
    this.onMove    = null;  // (dx, dy, magnitude) → void
    this.onButton  = null;  // (name) → void
    this.onTap     = null;  // (logicalX, logicalY) → void  (tap en mundo)
    this.onPinch   = null;  // (delta) → void
    this.onLongPress = null; // (logicalX, logicalY) → void

    // Pinch
    this._activeTouches = new Map();
    this._lastPinchDist = 0;

    // Long press
    this._longPressTimer = null;
    this._longPressFired = false;
    this._tapStart       = null;

    this._setupEvents();
  }

  resize(w, h) {
    this.uiCanvas.width  = w;
    this.uiCanvas.height = h;
    this.uiCanvas.style.width  = w + 'px';
    this.uiCanvas.style.height = h + 'px';
    this.touchCanvas.width  = w;
    this.touchCanvas.height = h;
    this.touchCanvas.style.width  = w + 'px';
    this.touchCanvas.style.height = h + 'px';

    // Joystick: esquina inferior izquierda
    this.joyBase = { x: 90, y: h - 110 };
    this.joyKnob = { ...this.joyBase };

    // Botones: esquina inferior derecha
    const bRight = w - 60;
    const bBottom = h - 80;
    this.buttons = {
      ATK:  { x: bRight,      y: bBottom,       r: 28, color: '#C0392B', label: 'ATK' },
      PICK: { x: bRight - 65, y: bBottom,       r: 24, color: '#27AE60', label: 'PCK' },
      SKL:  { x: bRight,      y: bBottom - 65,  r: 24, color: '#8E44AD', label: 'SKL' },
      POT:  { x: bRight - 65, y: bBottom - 65,  r: 24, color: '#2E86C1', label: 'POT' },
    };

    this.draw();
  }

  // ─── Eventos de touch ─────────────────────────────────────────────────────

  _setupEvents() {
    const el = this.touchCanvas;
    el.style.touchAction = 'none';
    el.addEventListener('touchstart',  e => { e.preventDefault(); this._onTouchStart(e); }, { passive: false });
    el.addEventListener('touchmove',   e => { e.preventDefault(); this._onTouchMove(e);  }, { passive: false });
    el.addEventListener('touchend',    e => { e.preventDefault(); this._onTouchEnd(e);   }, { passive: false });
    el.addEventListener('touchcancel', e => { e.preventDefault(); this._onTouchEnd(e);   }, { passive: false });
    // Mouse fallback para desktop
    el.addEventListener('mousedown', e => this._onMouseDown(e));
    el.addEventListener('mousemove', e => this._onMouseMove(e));
    el.addEventListener('mouseup',   e => this._onMouseUp(e));
  }

  _onTouchStart(e) {
    Array.from(e.changedTouches).forEach(t => {
      const p = { x: t.clientX, y: t.clientY };
      this._activeTouches.set(t.identifier, p);

      // ¿Es un botón?
      const btn = this._hitButton(p.x, p.y);
      if (btn) {
        this._pressedButtons.add(btn);
        if (this.onButton) this.onButton(btn);
        this.draw();
        return;
      }

      // ¿Es zona del joystick?
      if (this._isJoyZone(p.x, p.y)) {
        this.joyActive = true;
        this.joyTouchId = t.identifier;
        this.joyBase = { x: p.x, y: p.y }; // joystick dinámico
        this.joyKnob = { x: p.x, y: p.y };
        this.draw();
        return;
      }

      // Tap en mundo
      this._tapStart = { x: p.x, y: p.y, id: t.identifier, time: Date.now() };
      this._longPressFired = false;
      this._longPressTimer = setTimeout(() => {
        this._longPressFired = true;
        if (this.onLongPress) this.onLongPress(p.x, p.y);
      }, 500);
    });

    // Pinch detection
    if (this._activeTouches.size === 2) {
      const pts = [...this._activeTouches.values()];
      this._lastPinchDist = this._dist(pts[0], pts[1]);
    }
  }

  _onTouchMove(e) {
    Array.from(e.changedTouches).forEach(t => {
      const p = { x: t.clientX, y: t.clientY };
      this._activeTouches.set(t.identifier, p);

      // Joystick
      if (this.joyActive && t.identifier === this.joyTouchId) {
        const dx = p.x - this.joyBase.x;
        const dy = p.y - this.joyBase.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        this.magnitude = Math.min(1, dist / this.joyBaseR);
        this.angle = Math.atan2(dy, dx);

        if (dist > this.joyBaseR) {
          this.joyKnob = {
            x: this.joyBase.x + Math.cos(this.angle) * this.joyBaseR,
            y: this.joyBase.y + Math.sin(this.angle) * this.joyBaseR
          };
        } else {
          this.joyKnob = { x: p.x, y: p.y };
        }

        this.direction = {
          x: Math.cos(this.angle) * this.magnitude,
          y: Math.sin(this.angle) * this.magnitude
        };

        if (this.onMove && this.magnitude > 0.15) {
          this.onMove(this.direction.x, this.direction.y, this.magnitude);
        }
        this.draw();
        return;
      }

      // Cancelar long press si se movió
      if (this._tapStart && t.identifier === this._tapStart.id) {
        const moved = this._dist(p, this._tapStart) > 10;
        if (moved && this._longPressTimer) {
          clearTimeout(this._longPressTimer);
          this._longPressTimer = null;
        }
      }
    });

    // Pinch
    if (this._activeTouches.size === 2) {
      const pts = [...this._activeTouches.values()];
      const newDist = this._dist(pts[0], pts[1]);
      if (this._lastPinchDist > 0 && this.onPinch) {
        this.onPinch(newDist - this._lastPinchDist);
      }
      this._lastPinchDist = newDist;
    }
  }

  _onTouchEnd(e) {
    Array.from(e.changedTouches).forEach(t => {
      const p = { x: t.clientX, y: t.clientY };

      // Liberar botón
      const btn = this._hitButton(p.x, p.y);
      if (btn) this._pressedButtons.delete(btn);

      // Tap en mundo
      if (this._tapStart && t.identifier === this._tapStart.id) {
        clearTimeout(this._longPressTimer);
        this._longPressTimer = null;
        const elapsed = Date.now() - this._tapStart.time;
        if (!this._longPressFired && elapsed < 400 && this._dist(p, this._tapStart) < 20) {
          if (this.onTap) this.onTap(p.x, p.y);
        }
        this._tapStart = null;
      }

      // Joystick
      if (t.identifier === this.joyTouchId) {
        this.joyActive = false;
        this.joyTouchId = null;
        this.joyKnob = { ...this.joyBase };
        this.direction = { x: 0, y: 0 };
        this.magnitude = 0;
        if (this.onMove) this.onMove(0, 0, 0);
      }

      this._activeTouches.delete(t.identifier);
    });

    this._lastPinchDist = 0;
    this.draw();
  }

  // ─── Mouse fallback ───────────────────────────────────────────────────────

  _onMouseDown(e) {
    const p = { x: e.clientX, y: e.clientY };
    const btn = this._hitButton(p.x, p.y);
    if (btn) {
      this._pressedButtons.add(btn);
      if (this.onButton) this.onButton(btn);
      this.draw();
      return;
    }
    if (this._isJoyZone(p.x, p.y)) {
      this.joyActive = true;
      this.joyBase = p;
      this.joyKnob = { ...p };
      this._mouseDown = true;
    } else {
      if (this.onTap) this.onTap(p.x, p.y);
    }
  }

  _onMouseMove(e) {
    if (!this.joyActive || !this._mouseDown) return;
    const p = { x: e.clientX, y: e.clientY };
    const dx = p.x - this.joyBase.x;
    const dy = p.y - this.joyBase.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    this.magnitude = Math.min(1, dist / this.joyBaseR);
    this.angle = Math.atan2(dy, dx);
    this.joyKnob = dist > this.joyBaseR
      ? { x: this.joyBase.x + Math.cos(this.angle)*this.joyBaseR, y: this.joyBase.y + Math.sin(this.angle)*this.joyBaseR }
      : { x: p.x, y: p.y };
    this.direction = { x: Math.cos(this.angle)*this.magnitude, y: Math.sin(this.angle)*this.magnitude };
    if (this.onMove && this.magnitude > 0.15) this.onMove(this.direction.x, this.direction.y, this.magnitude);
    this.draw();
  }

  _onMouseUp(e) {
    const p = { x: e.clientX, y: e.clientY };
    const btn = this._hitButton(p.x, p.y);
    if (btn) this._pressedButtons.delete(btn);
    if (this.joyActive) {
      this.joyActive = false;
      this._mouseDown = false;
      this.joyKnob = { ...this.joyBase };
      this.direction = { x: 0, y: 0 };
      this.magnitude = 0;
      if (this.onMove) this.onMove(0, 0, 0);
    }
    this.draw();
  }

  // ─── Hit testing ──────────────────────────────────────────────────────────

  _hitButton(x, y) {
    for (const [name, btn] of Object.entries(this.buttons)) {
      const dx = x - btn.x, dy = y - btn.y;
      if (Math.sqrt(dx*dx + dy*dy) <= btn.r + 8) return name;
    }
    return null;
  }

  _isJoyZone(x, y) {
    // Mitad izquierda de la pantalla, parte inferior
    return x < this.uiCanvas.width * 0.45 && y > this.uiCanvas.height * 0.45;
  }

  _dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx*dx + dy*dy);
  }

  // ─── Dibujo del HUD táctil ────────────────────────────────────────────────

  draw() {
    const ctx = this.uiCtx;
    const w = this.uiCanvas.width;
    const h = this.uiCanvas.height;
    ctx.clearRect(0, 0, w, h);

    this._drawJoystick(ctx);
    this._drawButtons(ctx);
  }

  _drawJoystick(ctx) {
    // Base
    ctx.save();
    ctx.globalAlpha = this.joyActive ? 0.55 : 0.35;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.joyBase.x, this.joyBase.y, this.joyBaseR, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    ctx.stroke();
    // Direcciones (puntos cardinales)
    const dirs = [0, Math.PI/2, Math.PI, Math.PI*3/2];
    dirs.forEach(a => {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(
        this.joyBase.x + Math.cos(a) * (this.joyBaseR - 12),
        this.joyBase.y + Math.sin(a) * (this.joyBaseR - 12),
        4, 0, Math.PI*2
      );
      ctx.fill();
    });
    // Knob
    ctx.globalAlpha = this.joyActive ? 0.85 : 0.55;
    const kGrad = ctx.createRadialGradient(
      this.joyKnob.x - 4, this.joyKnob.y - 4, 2,
      this.joyKnob.x, this.joyKnob.y, this.joyKnobR
    );
    kGrad.addColorStop(0, 'rgba(200,200,255,0.9)');
    kGrad.addColorStop(1, 'rgba(80,80,180,0.6)');
    ctx.fillStyle = kGrad;
    ctx.beginPath();
    ctx.arc(this.joyKnob.x, this.joyKnob.y, this.joyKnobR, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  _drawButtons(ctx) {
    for (const [name, btn] of Object.entries(this.buttons)) {
      const pressed = this._pressedButtons.has(name);
      ctx.save();
      ctx.globalAlpha = pressed ? 0.90 : 0.55;

      // Sombra
      ctx.shadowColor = btn.color;
      ctx.shadowBlur = pressed ? 12 : 4;

      // Círculo
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI*2);
      ctx.fillStyle = pressed ? btn.color : 'rgba(0,0,0,0.4)';
      ctx.fill();
      ctx.strokeStyle = btn.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.shadowBlur = 0;
      ctx.globalAlpha = pressed ? 1 : 0.8;
      ctx.font = `bold ${Math.floor(btn.r * 0.55)}px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFF';
      ctx.fillText(btn.label, btn.x, btn.y);

      ctx.restore();
    }
  }
}

window.TouchControls = TouchControls;
