'use strict';

const CLASS_STATS = {
  DK: {
    label: 'Dark Knight',
    str: 28, agi: 20, vit: 25, ene: 10,
    hp: 110, mp: 60,
    attack: 15, defense: 5,
    attackCooldown: 1200,
    attackRange: 1.5
  },
  DW: {
    label: 'Dark Wizard',
    str: 15, agi: 15, vit: 15, ene: 40,
    hp: 80, mp: 150,
    attack: 22, defense: 2,
    attackCooldown: 1500,
    attackRange: 5
  },
  ELF: {
    label: 'Elf',
    str: 22, agi: 28, vit: 20, ene: 15,
    hp: 100, mp: 80,
    attack: 13, defense: 4,
    attackCooldown: 900,
    attackRange: 5
  }
};

class Player {
  constructor(id, name, charClass) {
    this.id = id;
    this.name = name;
    this.class = charClass in CLASS_STATS ? charClass : 'DK';

    const stats = CLASS_STATS[this.class];
    this.str = stats.str;
    this.agi = stats.agi;
    this.vit = stats.vit;
    this.ene = stats.ene;
    this.maxHp = stats.hp;
    this.hp = stats.hp;
    this.maxMp = stats.mp;
    this.mp = stats.mp;
    this.attack = stats.attack;
    this.defense = stats.defense;
    this.attackCooldown = stats.attackCooldown;
    this.attackRange = stats.attackRange;

    this.level = 1;
    this.exp = 0;
    this.expToNext = 100;
    this.gold = 0;

    // Spawn centro de Lorencia con algo de varianza
    this.x = 25 + (Math.random() * 4 - 2);
    this.y = 25 + (Math.random() * 4 - 2);
    this.dir = 'S';

    this.targetId = null;
    this.lastAttack = 0;
    this.inventory = [];
    this.state = 'idle'; // idle | moving | attacking | dead
    this.moveQueue = [];  // cola de posiciones de destino

    // Efectos de estado activos
    this.statusEffects = {};  // { poison: { active, damage, ticks, ... } }
  }

  gainExp(amount) {
    this.exp += amount;
    let leveledUp = false;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this._levelUp();
      leveledUp = true;
    }
    return leveledUp;
  }

  _levelUp() {
    this.level++;
    this.expToNext = Math.floor(this.expToNext * 1.5);
    this.maxHp += 10;
    this.hp = this.maxHp;
    this.maxMp += 5;
    this.mp = this.maxMp;
    this.str += 2;
    this.attack += 1;
    this.defense += 0.5;
  }

  useHpPotion(amount = 50) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addItem(item) {
    this.inventory.push(item);
  }

  isDead() {
    return this.hp <= 0;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      class: this.class,
      x: this.x,
      y: this.y,
      dir: this.dir,
      hp: Math.max(0, Math.floor(this.hp)),
      maxHp: this.maxHp,
      mp: Math.max(0, Math.floor(this.mp)),
      maxMp: this.maxMp,
      level: this.level,
      exp: this.exp,
      expToNext: this.expToNext,
      gold: this.gold,
      state: this.state,
      str: this.str,
      agi: this.agi,
      vit: this.vit,
      ene: this.ene,
      attack: Math.floor(this.attack),
      defense: Math.floor(this.defense)
    };
  }
}

Player.CLASS_STATS = CLASS_STATS;

module.exports = Player;
