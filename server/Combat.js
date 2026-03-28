'use strict';

/**
 * Combat.js - Cálculo de daño con tipos, miss/dodge, bloqueo y veneno.
 *
 * Tipos de daño:
 *   physical  → DK y monstruos  (STR bonus, puede ser bloqueado)
 *   magic     → DW              (ENE bonus, ignora 50% defensa)
 *   ranged    → ELF             (AGI+STR, mayor chance de crit)
 *
 * Mecánicas adicionales:
 *   Miss      → basado en diferencia de AGI (máx 15%)
 *   Block     → DK con VIT alto (máx 25% chance, reduce a 25% del daño)
 *   Veneno    → Spider (applyPoison / updatePoison)
 */
class Combat {

  static getDamageType(entity) {
    if (entity.class === 'DW') return 'magic';
    if (entity.class === 'ELF') return 'ranged';
    return 'physical';
  }

  /**
   * Calcula el daño de un atacante sobre un objetivo.
   * @returns {{ damage, isCrit, isBlocked, isMiss, dmgType }}
   */
  static calculateDamage(attacker, target) {
    const dmgType = this.getDamageType(attacker);
    const base    = attacker.attack || 5;

    // ── Bono por stat principal ────────────────────────────────────────────────
    let statBonus;
    if (dmgType === 'magic') {
      statBonus = 1 + (attacker.ene || 0) * 0.005;         // DW: ENE
    } else if (dmgType === 'ranged') {
      statBonus = 1 + (attacker.agi || 0) * 0.003
                    + (attacker.str || 0) * 0.002;          // ELF: AGI + STR
    } else {
      statBonus = 1 + (attacker.str || 0) * 0.004;         // DK / monstruos: STR
    }

    // ── Varianza ───────────────────────────────────────────────────────────────
    const variance = dmgType === 'ranged'
      ? 0.85 + Math.random() * 0.30   // ELF: más consistente
      : 0.75 + Math.random() * 0.50;  // Resto: más variable

    // ── Crítico ────────────────────────────────────────────────────────────────
    const critChance = dmgType === 'ranged'
      ? 0.10 + (attacker.agi || 0) * 0.001   // ELF: AGI mejora crits
      : 0.08;
    const isCrit = Math.random() < critChance;

    let damage = Math.floor(base * statBonus * variance);
    if (isCrit) damage = Math.floor(damage * 2.0);

    // ── Reducción por defensa ──────────────────────────────────────────────────
    const def = target.defense || 0;
    const defReduction = dmgType === 'magic'
      ? Math.floor(def * 0.5)   // magia ignora 50% de armadura
      : def;
    damage = Math.max(1, damage - defReduction);

    // ── Bloqueo (DK físico) ────────────────────────────────────────────────────
    let isBlocked = false;
    if (dmgType === 'physical' && (target.class === 'DK' || (target.vit && !target.class))) {
      const blockChance = Math.min(0.25, (target.vit || 0) / 400);
      if (Math.random() < blockChance) {
        damage = Math.max(1, Math.floor(damage * 0.25));
        isBlocked = true;
      }
    }

    // ── Miss basado en diferencia de AGI ──────────────────────────────────────
    const agiDiff   = (target.agi || 10) - (attacker.agi || 10);
    const missChance = Math.max(0, Math.min(0.15, agiDiff * 0.004));
    const isMiss     = Math.random() < missChance;

    return {
      damage: isMiss ? 0 : damage,
      isCrit,
      isBlocked,
      isMiss,
      dmgType
    };
  }

  /** Verifica si dos entidades están en rango. */
  static inRange(a, b, range) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return (dx * dx + dy * dy) <= (range * range);
  }

  /** Rango de ataque según clase. */
  static getAttackRange(entity) {
    if (entity.class === 'DW')  return 5;
    if (entity.class === 'ELF') return 5;
    return entity.attackRange || 1.5;
  }

  /** Cooldown de ataque ajustado por AGI. */
  static getAttackCooldown(entity) {
    const baseMs       = entity.attackCooldown || 1200;
    const agiReduction = (entity.agi || 0) * 5;
    return Math.max(400, baseMs - agiReduction);
  }

  // ─── Veneno ────────────────────────────────────────────────────────────────

  /**
   * Aplica veneno al objetivo.
   * @param {object} target  - jugador/entidad que recibe el veneno
   * @param {object} source  - monstruo que lo aplica
   */
  static applyPoison(target, source) {
    if (!target.statusEffects) target.statusEffects = {};
    if (target.statusEffects.poison?.active) return; // ya envenenado

    const poisonDmg = Math.max(2, Math.floor((source.poisonDamage || source.attack || 4) * 0.35));
    target.statusEffects.poison = {
      active:       true,
      damage:       poisonDmg,
      ticks:        5,          // 5 ticks = 10 segundos
      tickInterval: 2000,       // cada 2 segundos
      nextTick:     Date.now() + 2000,
      sourceId:     source.id
    };
  }

  /**
   * Procesa un tick de veneno (llamar en el game loop).
   * @returns {{ damage, finished }} | null
   */
  static updatePoison(entity, now) {
    const p = entity.statusEffects?.poison;
    if (!p?.active) return null;
    if (now < p.nextTick) return null;

    p.ticks--;
    p.nextTick = now + p.tickInterval;
    const dmg = p.damage;
    entity.hp -= dmg;

    const finished = p.ticks <= 0;
    if (finished) p.active = false;

    return { damage: dmg, finished };
  }
}

module.exports = Combat;
