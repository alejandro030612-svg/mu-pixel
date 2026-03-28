'use strict';

/**
 * Game.js - Orquestador principal del cliente.
 *
 * Flujo:
 *   init() → pantalla de conexión
 *   connect() → pantalla de login
 *   createCharacter() → loop de juego
 */
class Game {
  constructor() {
    this.net      = new NetworkClient();
    this.renderer = null;
    this.tc       = null;  // TouchControls
    this.input    = null;  // InputHandler
    this.ui       = null;  // UI

    this.playerId  = null;
    this.selfPlayer = null;  // datos del jugador local (actualizado por servidor + predicción)

    // Estado global del mundo
    this.state = {
      players:  [],
      monsters: [],
      items:    []
    };

    this._running   = false;
    this._lastTime  = 0;
    this._rafId     = null;

    // Audio (Web Audio API)
    this._audio = null;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  init() {
    // Ocultar loading
    setTimeout(() => {
      document.getElementById('loading').style.display = 'none';
      this._showConnectScreen();
    }, 800);
  }

  // ─── Pantalla de conexión ─────────────────────────────────────────────────

  _showConnectScreen() {
    const screen = document.getElementById('connect-screen');
    screen.style.display = 'flex';

    // Logo
    Renderer.drawLogo(document.getElementById('logo-canvas'));

    // Rellenar IP guardada
    const saved = localStorage.getItem('mu_server');
    if (saved) {
      try {
        const { host, port } = JSON.parse(saved);
        document.getElementById('server-ip').value = host;
        document.getElementById('server-port').value = port;
        const savedRow = document.getElementById('saved-ip-row');
        const savedVal = document.getElementById('saved-ip-val');
        savedRow.style.display = 'block';
        savedVal.textContent = `${host}:${port}`;
        savedVal.onclick = () => {
          document.getElementById('server-ip').value = host;
          document.getElementById('server-port').value = port;
        };
      } catch (_) {}
    }

    document.getElementById('connect-btn').onclick = () => this._doConnect();
    document.getElementById('server-ip').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._doConnect();
    });
  }

  async _doConnect() {
    const host = document.getElementById('server-ip').value.trim();
    const port = parseInt(document.getElementById('server-port').value) || 3000;
    const errEl = document.getElementById('connect-error');
    const btn   = document.getElementById('connect-btn');

    if (!host) { errEl.textContent = 'Ingresa la IP del servidor.'; return; }

    btn.textContent = 'Conectando...';
    btn.disabled = true;
    errEl.textContent = '';

    try {
      await this.net.connect(host, port);
      localStorage.setItem('mu_server', JSON.stringify({ host, port }));
      document.getElementById('connect-ping').textContent = `Conectado ✓`;
      this._setupNetworkEvents();
      this._showLoginScreen();
    } catch (err) {
      errEl.textContent = err.message || 'No se pudo conectar.';
    } finally {
      btn.textContent = 'CONECTAR';
      btn.disabled = false;
    }
  }

  // ─── Pantalla de login ────────────────────────────────────────────────────

  _showLoginScreen() {
    document.getElementById('connect-screen').style.display = 'none';
    const screen = document.getElementById('login-screen');
    screen.style.display = 'flex';

    let selectedClass = 'DK';
    const previewCanvas = document.getElementById('preview-canvas');
    Renderer.drawClassPreview(previewCanvas, selectedClass);

    // Botones de clase
    document.querySelectorAll('.class-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.class-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedClass = btn.dataset.class;
        Renderer.drawClassPreview(previewCanvas, selectedClass);
      });
    });

    document.getElementById('enter-btn').onclick = () => {
      const name = document.getElementById('char-name').value.trim() || 'Hero';
      this._createCharacter(name, selectedClass);
    };

    // Animar preview
    const animPreview = () => {
      Renderer.drawClassPreview(previewCanvas, selectedClass);
      if (screen.style.display !== 'none') requestAnimationFrame(animPreview);
    };
    animPreview();
  }

  _createCharacter(name, charClass) {
    this.net.createCharacter(name, charClass);
  }

  // ─── Setup red ────────────────────────────────────────────────────────────

  _setupNetworkEvents() {
    // Estado inicial del juego
    this.net.on('gameState', (data) => {
      this.playerId = data.playerId;
      this.selfPlayer = data.player;
      this.state.players  = data.players  || [];
      this.state.monsters = data.monsters || [];
      this.state.items    = data.items    || [];

      if (data.map) {
        if (this.renderer) {
          this.renderer.mapTiles = data.map.tiles;
          this.renderer.mapSize  = data.map.size;
        }
        if (this.ui) {
          this.ui.minimapTiles = data.map.tiles;
          this.ui.mapSize      = data.map.size;
        }
      }

      this._startGame();
    });

    // Actualizaciones del mundo
    this.net.on('worldUpdate', (data) => {
      if (data.monsters) this.state.monsters = data.monsters;
      if (data.items)    this.state.items    = data.items;
    });

    // Jugador se mueve
    this.net.on('playerMoved', (player) => {
      if (player.id === this.playerId) {
        // Solo actualizar si el servidor está muy desincronizado
        const self = this.selfPlayer;
        if (self) {
          const dx = self.x - player.x, dy = self.y - player.y;
          if (Math.sqrt(dx*dx + dy*dy) > 3) {
            this.selfPlayer.x = player.x;
            this.selfPlayer.y = player.y;
          }
        }
      } else {
        this._updatePlayerInState(player);
      }
    });

    // Actualización del jugador propio (HP, EXP, etc.)
    this.net.on('playerUpdate', (player) => {
      if (player.id === this.playerId) {
        Object.assign(this.selfPlayer, player);
        if (this.ui) this.ui.player = this.selfPlayer;
      } else {
        this._updatePlayerInState(player);
      }
    });

    // Otro jugador se une
    this.net.on('playerJoined', (player) => {
      this._updatePlayerInState(player);
      if (this.ui) this.ui.addChatMessage({ type: 'system', message: `${player.name} entró al mundo.` });
    });

    // Jugador se va
    this.net.on('playerLeft', ({ playerId }) => {
      const p = this.state.players.find(pl => pl.id === playerId);
      this.state.players = this.state.players.filter(pl => pl.id !== playerId);
      if (this.ui && p) this.ui.addChatMessage({ type: 'system', message: `${p.name} salió del juego.` });
    });

    // Daño (incluye miss, block, veneno)
    this.net.on('damage', (data) => {
      if (!this.renderer) return;
      let target = null;
      if (data.targetId === this.playerId) {
        target = this.selfPlayer;
      } else {
        target = this.state.monsters.find(m => m.id === data.targetId)
              || this.state.players.find(p => p.id === data.targetId);
      }
      if (target) {
        const received = data.targetId === this.playerId;
        this.renderer.spawnDamageNumber(
          target.x, target.y - 1, data.damage, data.isCrit, received,
          { isMiss: data.isMiss, isBlocked: data.isBlocked, isPoison: data.isPoison }
        );
        if (data.targetId === this.playerId && this.selfPlayer) {
          this.selfPlayer.hp = data.targetHp;
          if (this.ui) this.ui.player = this.selfPlayer;
        }
      }
    });

    // Envenenado
    this.net.on('poisoned', ({ damage, duration }) => {
      if (this.selfPlayer) {
        this.selfPlayer.poisoned = true;
        if (this.ui) this.ui.notify(`¡VENENO! -${damage} HP c/2s (${duration}s)`, 'warn');
      }
    });

    // Tick de veneno
    this.net.on('poisonTick', ({ damage, hp, finished }) => {
      if (!this.selfPlayer) return;
      this.selfPlayer.hp = hp;
      if (finished) this.selfPlayer.poisoned = false;
      if (this.ui) this.ui.player = this.selfPlayer;
    });

    // Monstruo muere
    this.net.on('monsterDied', ({ monsterId, dropBox, killerId, exp }) => {
      const m = this.state.monsters.find(mo => mo.id === monsterId);
      if (m && this.renderer) {
        this.renderer.spawnDeathParticles(m.x, m.y, m.color);
        this.audio('death');
      }
      this.state.monsters = this.state.monsters.filter(mo => mo.id !== monsterId);
      if (killerId === this.playerId && this.ui) {
        this.ui.notify(`+${exp} EXP`, 'info');
      }
      // La caja llega por 'itemsDropped'
    });

    // Monstruo reaparece
    this.net.on('monsterSpawned', (monster) => {
      this.state.monsters.push(monster);
    });

    // EXP
    this.net.on('expGain', ({ amount, currentExp, expToNext }) => {
      if (this.selfPlayer) {
        this.selfPlayer.exp = currentExp;
        this.selfPlayer.expToNext = expToNext;
        if (this.ui) this.ui.player = this.selfPlayer;
      }
    });

    // Level up
    this.net.on('levelUp', ({ level, player }) => {
      Object.assign(this.selfPlayer, player);
      if (this.ui) {
        this.ui.player = this.selfPlayer;
        this.ui.notify(`¡SUBISTE AL NIVEL ${level}!`, 'levelup');
        this.ui.addChatMessage({ type: 'levelup', message: `¡${this.selfPlayer.name} subió al nivel ${level}!` });
      }
      this.audio('levelup');
    });

    // Items droppeados
    this.net.on('itemsDropped', ({ drops }) => {
      drops.forEach(item => {
        if (!this.state.items.find(i => i.id === item.id)) {
          this.state.items.push(item);
        }
      });
    });

    // Item recogido (incluye drop_box)
    this.net.on('itemPickedUp', ({ itemId, item, gold, inventory }) => {
      this.state.items = this.state.items.filter(i => i.id !== itemId);
      if (this.selfPlayer) this.selfPlayer.gold = gold;
      if (this.ui) {
        this.ui.player = this.selfPlayer;
        if (item.type === 'drop_box') {
          const contents = item.contents || [];
          const goldAmt  = contents.filter(c => c.type === 'gold').reduce((s, c) => s + c.amount, 0);
          const others   = contents.filter(c => c.type !== 'gold');
          let label = `¡Cofre!`;
          if (goldAmt > 0) label += ` +${goldAmt}G`;
          others.forEach(c => { label += ` +${c.type}`; });
          this.ui.notify(label, 'item');
        } else {
          const label = item.type === 'gold' ? `+${item.amount} Gold`
                      : item.type === 'hp_potion' ? '+Poción HP'
                      : `+${item.type}`;
          this.ui.notify(label, 'item');
        }
      }
      this.audio('pickup');
    });

    // Item removido (venció o fue recogido por otro)
    this.net.on('itemRemoved', ({ itemId }) => {
      this.state.items = this.state.items.filter(i => i.id !== itemId);
    });

    // Chat
    this.net.on('chatMessage', (data) => {
      if (this.ui) this.ui.addChatMessage(data);
    });

    // Broadcast (sistema)
    this.net.on('broadcast', ({ msg, type }) => {
      if (this.ui) {
        this.ui.addChatMessage({ type: type || 'system', message: msg });
        this.ui.notify(msg, type === 'levelup' ? 'levelup' : 'info');
      }
    });

    // Jugador muere
    this.net.on('playerDied', ({ playerId }) => {
      if (playerId === this.playerId && this.ui) {
        this.ui.notify('Has muerto... reapareciendo en 5s', 'warn');
        if (this.selfPlayer) this.selfPlayer.state = 'dead';
      }
    });

    // Respawn
    this.net.on('respawn', (player) => {
      if (this.selfPlayer) Object.assign(this.selfPlayer, player);
      if (this.ui) {
        this.ui.player = this.selfPlayer;
        this.ui.notify('Has reaparecido en Lorencia', 'info');
      }
    });

    // Desconexión
    this.net.on('disconnect', () => {
      this._stopLoop();
      alert('Desconectado del servidor. Recarga para reconectar.');
    });

    // Ping
    this.net.on('pingUpdate', (ms) => {
      if (this.ui) this.ui.ping = ms;
    });
  }

  // ─── Iniciar juego ────────────────────────────────────────────────────────

  _startGame() {
    // Ocultar login
    document.getElementById('login-screen').style.display = 'none';

    // Mostrar canvases
    const gc = document.getElementById('game-canvas');
    const uc = document.getElementById('ui-canvas');
    const tc = document.getElementById('touch-canvas');
    gc.style.display = 'block';
    uc.style.display = 'block';
    tc.style.display = 'block';

    // Init renderer
    this.renderer = new Renderer(gc);
    this.renderer.mapTiles = null; // se asigna en gameState

    // Init touch controls
    this.tc = new TouchControls(uc, tc);

    // Init UI
    this.ui = new UI(uc);
    this.ui.init();
    this.ui.player = this.selfPlayer;
    this.ui.showChat();

    // Chat callback
    this.ui.onChat((msg) => this.net.chat(msg));

    // Init input
    this.input = new InputHandler(this.tc, this.renderer, this);

    // Resize
    this._handleResize();
    window.addEventListener('resize', () => this._handleResize());

    // Asignar mapa si ya fue recibido
    // (gameState ya lo asignó antes de llamar a _startGame)

    // Audio
    this._initAudio();

    // Iniciar loop
    this._running = true;
    this._lastTime = performance.now();
    this._loop();

    this.ui.notify('¡Bienvenido a Lorencia!', 'info');
  }

  _handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.renderer) this.renderer.resize(w, h);
    if (this.tc)       this.tc.resize(w, h);
    if (this.ui)       this.ui.canvas.width = w; // ya redimensionado por tc
  }

  // ─── Game Loop ────────────────────────────────────────────────────────────

  _loop(now) {
    if (!this._running) return;
    this._rafId = requestAnimationFrame((t) => this._loop(t));

    const dt = Math.min(0.1, (now - this._lastTime) / 1000);
    this._lastTime = now || performance.now();

    // Actualizar input (movimiento del joystick)
    if (this.input) this.input.update(dt);

    // Construir estado completo incluyendo jugador propio
    const fullState = {
      players:  this._getAllPlayers(),
      monsters: this.state.monsters,
      items:    this.state.items
    };

    // Renderizar mundo
    if (this.renderer) this.renderer.render(fullState, this.selfPlayer, dt);

    // Dibujar TouchControls
    if (this.tc) this.tc.draw();

    // Dibujar HUD (sobre TouchControls)
    if (this.ui) this.ui.draw(fullState);

    // Visibilidad API: pausar si la app va a background
    if (document.hidden) return;
  }

  _getAllPlayers() {
    const others = this.state.players.filter(p => p.id !== this.playerId);
    return this.selfPlayer ? [this.selfPlayer, ...others] : others;
  }

  _stopLoop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  // ─── Acciones del jugador ─────────────────────────────────────────────────

  moveToPosition(x, y) {
    if (!this.selfPlayer || this.selfPlayer.state === 'dead') return;
    this.net.move(x, y);
    // Predicción local inmediata
    this.selfPlayer.x = x;
    this.selfPlayer.y = y;
  }

  playerAttack(targetId) {
    if (!this.selfPlayer || this.selfPlayer.state === 'dead') return;
    this.net.attack(targetId);
    this.audio('swing');
  }

  pickupNearestItem() {
    if (!this.selfPlayer) return;
    let closest = null, closestDist = Infinity;
    this.state.items.forEach(item => {
      const dx = this.selfPlayer.x - item.x;
      const dy = this.selfPlayer.y - item.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < closestDist && d < 2.5) { closest = item; closestDist = d; }
    });
    if (closest) this.net.pickupItem(closest.id);
  }

  useItem(type) {
    this.net.useItem(type);
  }

  useSkill() {
    // Habilidad básica: ataque en área al objetivo
    if (this.input && this.input.selectedTargetId) {
      this.playerAttack(this.input.selectedTargetId);
    } else {
      this.ui && this.ui.notify('Selecciona un objetivo primero', 'warn');
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _updatePlayerInState(player) {
    const idx = this.state.players.findIndex(p => p.id === player.id);
    if (idx >= 0) this.state.players[idx] = player;
    else           this.state.players.push(player);
  }

  // ─── Audio procedural ─────────────────────────────────────────────────────

  _initAudio() {
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      this._audioCtx = null;
    }
  }

  audio(type) {
    if (!this._audioCtx) return;
    const ctx = this._audioCtx;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      switch (type) {
        case 'swing':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.start(now); osc.stop(now + 0.13);
          break;

        case 'pickup':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(900, now + 0.1);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.start(now); osc.stop(now + 0.16);
          break;

        case 'levelup': {
          const notes = [523, 659, 784, 1047];
          notes.forEach((freq, i) => {
            const o2 = ctx.createOscillator();
            const g2 = ctx.createGain();
            o2.connect(g2); g2.connect(ctx.destination);
            o2.type = 'sine';
            o2.frequency.value = freq;
            g2.gain.setValueAtTime(0.2, now + i*0.1);
            g2.gain.exponentialRampToValueAtTime(0.001, now + i*0.1 + 0.2);
            o2.start(now + i*0.1); o2.stop(now + i*0.1 + 0.21);
          });
          return;
        }

        case 'death':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(300, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.start(now); osc.stop(now + 0.46);
          break;

        default: return;
      }
    } catch (_) {}
  }
}

window.Game = Game;
