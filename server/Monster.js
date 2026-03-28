'use strict';

/**
 * Monster.js - Definición de tipos de monstruo y clase Monster.
 *
 * Drops: cada monstruo genera una CAJA DE DROPS (drop_box) en lugar de items
 * sueltos, para acercar la experiencia al MU Online original.
 *
 * Spider: tipo mejorado con veneno (poisonOnHit 30%, 5 ticks × 2s).
 */

const MONSTER_TYPES = {

  // ─── Budge Dragon ────────────────────────────────────────────────────────────
  budge_dragon: {
    name:          'Budge Dragon',
    maxHp:         55,
    attack:        7,
    defense:       2,
    exp:           12,
    speed:         0.8,
    aggroRange:    6,
    attackRange:   1.5,
    attackCooldown: 1500,
    color:         '#e74c3c',
    poisonOnHit:   0,
    drops: [
      { type: 'gold',       minAmount: 8,  maxAmount: 25, chance: 1.00 },
      { type: 'hp_potion',                               chance: 0.35 },
      { type: 'equipment',                               chance: 0.06 }
    ]
  },

  // ─── Goblin ──────────────────────────────────────────────────────────────────
  goblin: {
    name:          'Goblin',
    maxHp:         85,
    attack:        11,
    defense:       3,
    exp:           18,
    speed:         1.0,
    aggroRange:    7,
    attackRange:   1.5,
    attackCooldown: 1200,
    color:         '#27ae60',
    poisonOnHit:   0,
    drops: [
      { type: 'gold',       minAmount: 12, maxAmount: 35, chance: 1.00 },
      { type: 'hp_potion',                               chance: 0.30 },
      { type: 'equipment',                               chance: 0.08 }
    ]
  },

  // ─── Spider ──────────────────────────────────────────────────────────────────
  // Araña mejorada: rápida, más HP, veneno en cada ataque con 30% de chance.
  spider: {
    name:          'Spider',
    maxHp:         65,
    attack:        5,
    defense:       1,
    exp:           10,
    speed:         1.4,            // más rápida que los demás
    aggroRange:    6,
    attackRange:   1.4,
    attackCooldown: 900,           // ataca rápido
    color:         '#8e44ad',
    poisonOnHit:   0.30,           // 30% de envenenar al golpear
    poisonDamage:  3,              // 3 HP por tick (5 ticks × 2s = 10s total)
    drops: [
      { type: 'gold',       minAmount: 5,  maxAmount: 18, chance: 1.00 },
      { type: 'hp_potion',                               chance: 0.40 },
      { type: 'equipment',                               chance: 0.04 }
    ]
  }
};

let nextMonsterId = 1;

class Monster {
  constructor(type, x, y) {
    if (!(type in MONSTER_TYPES)) throw new Error(`Tipo desconocido: ${type}`);

    this.id   = `m${nextMonsterId++}`;
    this.type = type;

    const t = MONSTER_TYPES[type];
    Object.assign(this, {
      name:          t.name,
      maxHp:         t.maxHp,
      hp:            t.maxHp,
      attack:        t.attack,
      defense:       t.defense,
      exp:           t.exp,
      speed:         t.speed,
      aggroRange:    t.aggroRange,
      attackRange:   t.attackRange,
      attackCooldown: t.attackCooldown,
      color:         t.color,
      drops:         t.drops,
      poisonOnHit:   t.poisonOnHit  || 0,
      poisonDamage:  t.poisonDamage || 0
    });

    this.x = x; this.y = y;
    this.spawnX = x; this.spawnY = y;
    this.dir = 'S';

    this.targetId   = null;
    this.lastAttack = 0;
    this.state      = 'idle';
    this.diedAt     = null;
    this.respawnDelay = 30000;

    this.wanderTimer    = 0;
    this.wanderInterval = 3000 + Math.random() * 4000;
    this.wanderTarget   = null;
  }

  /**
   * Genera los drops pre-rolados para la caja.
   * Siempre devuelve un array (puede ser vacío).
   */
  generateDrops() {
    const result = [];
    for (const drop of this.drops) {
      if (Math.random() < drop.chance) {
        if (drop.type === 'gold') {
          const amount = Math.floor(drop.minAmount + Math.random() * (drop.maxAmount - drop.minAmount));
          result.push({ type: 'gold', amount });
        } else {
          result.push({ type: drop.type, amount: 1 });
        }
      }
    }
    return result;
  }

  isDead()       { return this.hp <= 0; }
  canRespawn(n)  { return this.isDead() && this.diedAt && (n - this.diedAt >= this.respawnDelay); }

  respawn() {
    this.hp            = this.maxHp;
    this.x             = this.spawnX + (Math.random() * 2 - 1);
    this.y             = this.spawnY + (Math.random() * 2 - 1);
    this.state         = 'idle';
    this.targetId      = null;
    this.diedAt        = null;
    this.wanderTimer   = 0;
    this.wanderTarget  = null;
  }

  toJSON() {
    return {
      id:     this.id,
      type:   this.type,
      name:   this.name,
      x:      this.x,
      y:      this.y,
      dir:    this.dir,
      hp:     Math.max(0, Math.floor(this.hp)),
      maxHp:  this.maxHp,
      state:  this.state,
      color:  this.color,
      poisonOnHit: this.poisonOnHit   // el cliente lo puede mostrar (ícono)
    };
  }
}

Monster.TYPES = MONSTER_TYPES;
module.exports = Monster;
