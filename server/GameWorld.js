'use strict';

const Monster = require('./Monster');
const Combat  = require('./Combat');

// Tipos de tile
const TILE = {
  GRASS:    0,
  PATH:     1,
  WATER:    2,
  TREE:     3,
  BUILDING: 4,
  WALL:     5,
  STONE:    6
};

// ─── Generación del mapa de Lorencia ─────────────────────────────────────────

function generateLorenciaMap() {
  const SIZE = 50;
  const map  = [];

  for (let y = 0; y < SIZE; y++) {
    map[y] = [];
    for (let x = 0; x < SIZE; x++) {
      if (x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1) {
        map[y][x] = TILE.WALL; continue;
      }
      if (x < 5 || y < 5 || x > SIZE - 6 || y > SIZE - 6) {
        map[y][x] = Math.random() < 0.15 ? TILE.TREE : TILE.GRASS; continue;
      }
      map[y][x] = TILE.GRASS;
    }
  }

  // Cruz central
  for (let i = 5; i < SIZE - 5; i++) {
    map[25][i] = TILE.PATH;
    map[i][25] = TILE.PATH;
  }

  // Plaza central
  for (let y = 22; y <= 28; y++)
    for (let x = 22; x <= 28; x++)
      map[y][x] = TILE.STONE;

  // Edificios
  const buildings = [
    { x1:20, y1:8,  x2:24, y2:14 },   // Posada Norte
    { x1:26, y1:36, x2:30, y2:42 },   // Tienda Sur
    { x1:36, y1:22, x2:42, y2:28 },   // Almacén Este
    { x1:8,  y1:22, x2:14, y2:28 }    // Pociones Oeste
  ];
  buildings.forEach(({ x1, y1, x2, y2 }) => {
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++)
        map[y][x] = (y === y1 || y === y2 || x === x1 || x === x2)
          ? TILE.WALL : TILE.BUILDING;
  });

  // Lago noreste
  for (let y = 8; y <= 16; y++)
    for (let x = 32; x <= 38; x++)
      map[y][x] = TILE.WATER;

  // Árboles decorativos
  for (let y = 5; y < SIZE - 5; y++) {
    for (let x = 5; x < SIZE - 5; x++) {
      if (map[y][x] === TILE.GRASS && Math.random() < 0.04) {
        const dx = x - 25, dy = y - 25;
        if (Math.sqrt(dx * dx + dy * dy) > 8) map[y][x] = TILE.TREE;
      }
    }
  }

  return map;
}

// ─── Spawns de monstruos ──────────────────────────────────────────────────────

const MONSTER_SPAWNS = [
  // NW — Spiders (más numerosas, arden en veneno)
  { type: 'spider', x: 8,  y: 8  },
  { type: 'spider', x: 10, y: 6  },
  { type: 'spider', x: 6,  y: 12 },
  { type: 'spider', x: 12, y: 10 },
  { type: 'spider', x: 7,  y: 15 },
  // NE — Budge Dragons
  { type: 'budge_dragon', x: 40, y: 7  },
  { type: 'budge_dragon', x: 43, y: 10 },
  { type: 'budge_dragon', x: 38, y: 12 },
  // SW — Goblins
  { type: 'goblin', x: 8,  y: 40 },
  { type: 'goblin', x: 10, y: 43 },
  { type: 'goblin', x: 12, y: 38 },
  // SE — Mix
  { type: 'goblin',       x: 40, y: 40 },
  { type: 'budge_dragon', x: 43, y: 43 },
  { type: 'spider',       x: 38, y: 42 },
  // Extra
  { type: 'spider',       x: 5,  y: 25 },
  { type: 'budge_dragon', x: 45, y: 25 },
  { type: 'goblin',       x: 25, y: 5  },
  { type: 'spider',       x: 25, y: 45 }
];

let nextItemId = 1;

// ─── GameWorld ────────────────────────────────────────────────────────────────

class GameWorld {
  constructor(io) {
    this.io       = io;
    this.players  = new Map();
    this.monsters = new Map();
    this.items    = new Map();  // items sueltos + drop_boxes
    this.map      = generateLorenciaMap();
    this.mapSize  = 50;
    this.now      = Date.now();

    MONSTER_SPAWNS.forEach(s => {
      const m = new Monster(s.type, s.x + Math.random() - 0.5, s.y + Math.random() - 0.5);
      this.monsters.set(m.id, m);
    });
  }

  addPlayer(p)    { this.players.set(p.id, p); }
  removePlayer(id){ this.players.delete(id); }
  getPlayer(id)   { return this.players.get(id); }

  // ─── Update principal (50 ms / tick) ─────────────────────────────────────

  update() {
    this.now = Date.now();
    this._updateMonsters();
    this._updatePlayerStatuses();
    this._checkRespawns();
    this._cleanOldItems();
  }

  // ─── IA de monstruos ──────────────────────────────────────────────────────

  _updateMonsters() {
    for (const m of this.monsters.values()) {
      if (!m.isDead()) this._updateMonsterAI(m);
    }
  }

  _updateMonsterAI(monster) {
    const dt = 0.05;
    let closest = null, closestDist = Infinity;

    for (const player of this.players.values()) {
      if (player.isDead()) continue;
      const dx = player.x - monster.x, dy = player.y - monster.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < monster.aggroRange && d < closestDist) {
        closestDist = d;
        closest = player;
      }
    }

    if (!closest) {
      monster.targetId = null;
      this._monsterWander(monster, dt);
      return;
    }

    monster.targetId = closest.id;

    if (Combat.inRange(monster, closest, monster.attackRange)) {
      monster.state = 'attacking';
      this._monsterAttack(monster, closest);
    } else {
      monster.state = 'chasing';
      this._moveToward(monster, closest.x, closest.y, monster.speed * dt);
    }
  }

  _monsterWander(monster, dt) {
    monster.wanderTimer = (monster.wanderTimer || 0) + 50;
    if (!monster.wanderTarget || monster.wanderTimer >= monster.wanderInterval) {
      monster.wanderTimer    = 0;
      monster.wanderInterval = 3000 + Math.random() * 4000;
      monster.state          = 'idle';
      monster.wanderTarget   = Math.random() < 0.5
        ? { x: monster.spawnX + (Math.random() * 6 - 3),
            y: monster.spawnY + (Math.random() * 6 - 3) }
        : null;
    }
    if (monster.wanderTarget) {
      const dx = monster.wanderTarget.x - monster.x;
      const dy = monster.wanderTarget.y - monster.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.3) {
        monster.wanderTarget = null; monster.state = 'idle';
      } else {
        monster.state = 'moving';
        this._moveToward(monster, monster.wanderTarget.x, monster.wanderTarget.y, monster.speed * 0.5 * dt);
      }
    }
  }

  _monsterAttack(monster, target) {
    const now = this.now;
    if (now - monster.lastAttack < monster.attackCooldown) return;
    monster.lastAttack = now;

    const { damage, isCrit, isBlocked, isMiss, dmgType } = Combat.calculateDamage(monster, target);
    target.hp -= damage;

    this.io.emit('damage', {
      targetId:   target.id,
      attackerId: monster.id,
      damage, isCrit, isBlocked, isMiss, dmgType,
      targetHp:   Math.max(0, target.hp),
      targetMaxHp: target.maxHp
    });

    // ── Veneno de la araña ────────────────────────────────────────────────────
    if (!isMiss && monster.poisonOnHit > 0 && Math.random() < monster.poisonOnHit) {
      Combat.applyPoison(target, monster);
      // Notificar solo al jugador afectado
      this.io.to(target.id).emit('poisoned', {
        damage:   monster.poisonDamage || 3,
        duration: 10   // segundos
      });
    }

    // ── Muerte del jugador ────────────────────────────────────────────────────
    if (target.isDead()) {
      target.state = 'dead';
      target.hp    = 0;
      if (target.statusEffects?.poison) target.statusEffects.poison.active = false;
      this.io.emit('playerDied', { playerId: target.id });
      setTimeout(() => {
        if (this.players.has(target.id)) {
          target.hp    = target.maxHp;
          target.x     = 25; target.y = 25;
          target.state = 'idle';
          this.io.to(target.id).emit('respawn', target.toJSON());
          this.io.emit('playerUpdate', target.toJSON());
        }
      }, 5000);
    }
  }

  // ─── Efectos de estado de jugadores ──────────────────────────────────────

  _updatePlayerStatuses() {
    const now = this.now;
    for (const player of this.players.values()) {
      if (player.isDead()) continue;
      const tick = Combat.updatePoison(player, now);
      if (!tick) continue;

      // Emitir tick a todos (para mostrar número) y solo al jugador (para estado)
      this.io.emit('damage', {
        targetId:    player.id,
        attackerId:  null,
        damage:      tick.damage,
        isCrit:      false,
        isPoison:    true,
        targetHp:    Math.max(0, player.hp),
        targetMaxHp: player.maxHp
      });
      this.io.to(player.id).emit('poisonTick', {
        damage: tick.damage,
        hp:     Math.max(0, player.hp),
        finished: tick.finished
      });

      if (player.isDead()) {
        player.state = 'dead';
        player.hp    = 0;
        this.io.emit('playerDied', { playerId: player.id });
        setTimeout(() => {
          if (this.players.has(player.id)) {
            player.hp    = player.maxHp;
            player.x     = 25; player.y = 25;
            player.state = 'idle';
            this.io.to(player.id).emit('respawn', player.toJSON());
            this.io.emit('playerUpdate', player.toJSON());
          }
        }, 5000);
      }
    }
  }

  // ─── Acciones de jugador ──────────────────────────────────────────────────

  movePlayer(playerId, tx, ty) {
    const player = this.players.get(playerId);
    if (!player || player.isDead()) return null;

    tx = Math.max(1, Math.min(this.mapSize - 2, tx));
    ty = Math.max(1, Math.min(this.mapSize - 2, ty));
    if (!this._isWalkable(tx, ty)) return null;

    const dx = tx - player.x, dy = ty - player.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d > 0.1) {
      player.x   = tx; player.y = ty;
      player.dir = this._getDir(dx / d, dy / d);
      player.state = 'idle';
    }
    return player.toJSON();
  }

  playerAttack(playerId, targetId) {
    const player  = this.players.get(playerId);
    if (!player || player.isDead()) return null;

    const now      = this.now;
    const cooldown = Combat.getAttackCooldown(player);
    if (now - player.lastAttack < cooldown) return null;
    player.lastAttack = now;

    const monster = this.monsters.get(targetId);
    if (!monster || monster.isDead()) return null;

    const range = Combat.getAttackRange(player);
    if (!Combat.inRange(player, monster, range)) return null;

    const { damage, isCrit, isBlocked, isMiss, dmgType } = Combat.calculateDamage(player, monster);
    monster.hp -= damage;

    const result = {
      attackerId: playerId, targetId,
      damage, isCrit, isBlocked, isMiss, dmgType,
      targetHp:   Math.max(0, monster.hp),
      targetMaxHp: monster.maxHp
    };

    if (monster.isDead()) {
      monster.state  = 'dead';
      monster.hp     = 0;
      monster.diedAt = now;

      // ── Caja de drops ─────────────────────────────────────────────────────
      const contents = monster.generateDrops();
      let dropBox = null;

      if (contents.length > 0) {
        dropBox = {
          id:       `i${nextItemId++}`,
          type:     'drop_box',
          contents,
          x:        monster.x + (Math.random() * 0.8 - 0.4),
          y:        monster.y + (Math.random() * 0.8 - 0.4),
          createdAt: now,
          killerId: playerId   // quien lo mató tiene prioridad
        };
        this.items.set(dropBox.id, dropBox);
      }

      const leveledUp = player.gainExp(monster.exp);
      result.monsterDied = true;
      result.dropBox     = dropBox;
      result.exp         = monster.exp;
      result.leveledUp   = leveledUp;
      result.playerExp   = player.exp;
      result.playerExpToNext = player.expToNext;
      result.playerLevel = player.level;

      this.io.emit('monsterDied', {
        monsterId: targetId,
        dropBox,
        killerId: playerId,
        exp: monster.exp
      });
    }

    return result;
  }

  /**
   * Recoger item (incluyendo drop_box).
   * Si es drop_box, entrega todos los contenidos al jugador.
   */
  playerPickup(playerId, itemId) {
    const player = this.players.get(playerId);
    const item   = this.items.get(itemId);
    if (!player || !item) return null;

    const dx = player.x - item.x, dy = player.y - item.y;
    if (Math.sqrt(dx * dx + dy * dy) > 2.5) return null;

    this.items.delete(itemId);

    if (item.type === 'drop_box') {
      // Entregar todos los contenidos
      for (const c of (item.contents || [])) {
        if (c.type === 'gold') {
          player.gold += c.amount;
        } else {
          player.addItem(c);
        }
      }
    } else if (item.type === 'gold') {
      player.gold += item.amount;
    } else {
      player.addItem(item);
    }

    return { itemId, item, playerGold: player.gold, inventory: player.inventory };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _moveToward(entity, tx, ty, speed) {
    const dx = tx - entity.x, dy = ty - entity.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.1) return;
    const nx = dx / d, ny = dy / d;
    const nx2 = entity.x + nx * speed;
    const ny2 = entity.y + ny * speed;
    if (this._isWalkable(nx2, ny2)) {
      entity.x   = nx2; entity.y = ny2;
      entity.dir = this._getDir(nx, ny);
    }
  }

  _isWalkable(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.mapSize || ty >= this.mapSize) return false;
    const t = this.map[ty][tx];
    return t !== TILE.WALL && t !== TILE.TREE && t !== TILE.WATER && t !== TILE.BUILDING;
  }

  _getDir(nx, ny) {
    const a = Math.atan2(ny, nx) * 180 / Math.PI;
    if (a >= -22.5  && a <  22.5)  return 'E';
    if (a >=  22.5  && a <  67.5)  return 'SE';
    if (a >=  67.5  && a < 112.5)  return 'S';
    if (a >= 112.5  && a < 157.5)  return 'SW';
    if (a >= 157.5  || a < -157.5) return 'W';
    if (a >= -157.5 && a < -112.5) return 'NW';
    if (a >= -112.5 && a <  -67.5) return 'N';
    return 'NE';
  }

  _checkRespawns() {
    for (const m of this.monsters.values()) {
      if (m.canRespawn(this.now)) {
        m.respawn();
        this.io.emit('monsterSpawned', m.toJSON());
      }
    }
  }

  _cleanOldItems() {
    const MAX_AGE = 120000; // 2 minutos
    for (const [id, item] of this.items) {
      if (this.now - item.createdAt > MAX_AGE) {
        this.items.delete(id);
        this.io.emit('itemRemoved', { itemId: id });
      }
    }
  }

  getState() {
    return {
      players:  [...this.players.values()].map(p => p.toJSON()),
      monsters: [...this.monsters.values()].filter(m => !m.isDead()).map(m => m.toJSON()),
      items:    [...this.items.values()]
    };
  }

  getMap() {
    return { tiles: this.map, size: this.mapSize };
  }
}

GameWorld.TILE = TILE;
module.exports = GameWorld;
