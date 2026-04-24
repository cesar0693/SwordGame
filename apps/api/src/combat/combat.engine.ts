import type {
  CombatAction,
  CombatActorSide,
  CombatReport,
  ConsumableEffect,
  HeroStats,
  SpellDef,
  SpellEffect,
} from '@swordgame/shared';

/** xorshift32 RNG for deterministic replay. */
export class SeededRNG {
  private state: number;
  constructor(seedStr: string) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i += 1) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    this.state = (h | 0) || 0x9e3779b9;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x;
    return (x >>> 0) / 0xffffffff;
  }
}

export interface ConsumablePlan {
  effect: ConsumableEffect;
  name: string;
}

export interface CombatantInput {
  name: string;
  stats: HeroStats;
  spells?: SpellDef[];
  consumables?: ConsumablePlan[];
}

interface Combatant {
  side: CombatActorSide;
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;
  critFailChance: number;
  dodgeChance: number;
}

interface ActiveBuff {
  stat: keyof HeroStats;
  amount: number;
  remaining: number;
}

interface SpellSlot {
  spell: SpellDef;
  cooldownLeft: number;
}

const MAX_TURNS = 60;

/**
 * simulateCombat — two-sided, deterministic.
 * In PvE: attacker = hero, defender = enemy (no spells/consumables on enemy).
 * In PvP: both sides carry their spells; defender has no consumables queued.
 */
export function simulateCombat(
  attacker: CombatantInput,
  defender: CombatantInput,
  seed: string,
): CombatReport {
  const rng = new SeededRNG(seed);
  const atkC = makeCombatant('HERO', attacker);
  const defC = makeCombatant('ENEMY', defender);

  const buffs: Record<CombatActorSide, ActiveBuff[]> = { HERO: [], ENEMY: [] };
  const slots: Record<CombatActorSide, SpellSlot[]> = {
    HERO: (attacker.spells ?? []).map((s) => ({ spell: s, cooldownLeft: 0 })),
    ENEMY: (defender.spells ?? []).map((s) => ({ spell: s, cooldownLeft: 0 })),
  };
  const healQueue: Record<CombatActorSide, ConsumablePlan[]> = {
    HERO: (attacker.consumables ?? []).filter(
      (c) => c.effect.type === 'HEAL_HP' || c.effect.type === 'HEAL_MP',
    ),
    ENEMY: (defender.consumables ?? []).filter(
      (c) => c.effect.type === 'HEAL_HP' || c.effect.type === 'HEAL_MP',
    ),
  };

  const actions: CombatAction[] = [];
  let turn = 1;

  // Turn 1: apply all BUFF consumables for both sides
  for (const plan of attacker.consumables ?? []) {
    applyConsumableBuffIfAny(plan, atkC, buffs.HERO, actions, turn);
  }
  for (const plan of defender.consumables ?? []) {
    applyConsumableBuffIfAny(plan, defC, buffs.ENEMY, actions, turn);
  }

  while (turn <= MAX_TURNS) {
    // Reactive heal consumable
    tryReactiveHeal(atkC, healQueue.HERO, actions, turn);
    tryReactiveHeal(defC, healQueue.ENEMY, actions, turn);

    const atkSpeed = atkC.speed + sumBuffs(buffs.HERO, 'speed');
    const defSpeed = defC.speed + sumBuffs(buffs.ENEMY, 'speed');
    const first: Combatant = atkSpeed >= defSpeed ? atkC : defC;
    const second: Combatant = first === atkC ? defC : atkC;

    for (const actor of [first, second]) {
      if (atkC.hp <= 0 || defC.hp <= 0) break;
      const target = actor === atkC ? defC : atkC;
      const actorBuffs = buffs[actor.side];
      const cast = pickSpellToCast(actor, target, slots[actor.side], actorBuffs);
      if (cast) {
        castSpell(actor, target, cast, turn, actions, rng, actorBuffs);
      } else {
        applyAttack(actor, target, turn, actions, rng, buffs);
      }
    }

    // End of turn: tick buffs + cooldowns on both sides
    tickBuffs(buffs.HERO);
    tickBuffs(buffs.ENEMY);
    for (const s of slots.HERO) if (s.cooldownLeft > 0) s.cooldownLeft -= 1;
    for (const s of slots.ENEMY) if (s.cooldownLeft > 0) s.cooldownLeft -= 1;

    if (atkC.hp <= 0 || defC.hp <= 0) break;
    turn += 1;
  }

  const outcome = defC.hp <= 0 ? 'VICTORY' : 'DEFEAT';
  if (outcome === 'DEFEAT') {
    actions.push({
      turn, side: 'ENEMY', type: 'DEFEAT', targetSide: 'HERO',
      message: `${atkC.name} est vaincu.`,
    });
  } else {
    actions.push({
      turn, side: 'HERO', type: 'DEFEAT', targetSide: 'ENEMY',
      message: `${defC.name} s'effondre.`,
    });
  }

  return {
    seed,
    outcome,
    turns: turn,
    heroHpLeft: Math.max(0, atkC.hp),
    enemyHpLeft: Math.max(0, defC.hp),
    actions,
    rewards: null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCombatant(side: CombatActorSide, input: CombatantInput): Combatant {
  const s = input.stats;
  return {
    side,
    name: input.name,
    hp: s.hp,
    maxHp: s.hp,
    mp: s.mp,
    maxMp: s.mp,
    attack: s.attack,
    defense: s.defense,
    speed: s.speed,
    critChance: s.critChance,
    critFailChance: s.critFailChance,
    dodgeChance: s.dodgeChance,
  };
}

function tickBuffs(list: ActiveBuff[]): void {
  for (const b of list) b.remaining -= 1;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]!.remaining <= 0) list.splice(i, 1);
  }
}

function applyConsumableBuffIfAny(
  plan: ConsumablePlan,
  c: Combatant,
  list: ActiveBuff[],
  log: CombatAction[],
  turn: number,
): void {
  if (plan.effect.type === 'BUFF' && plan.effect.stat && plan.effect.amount) {
    list.push({
      stat: plan.effect.stat,
      amount: plan.effect.amount,
      remaining: plan.effect.durationTurns ?? 3,
    });
    log.push({
      turn,
      side: c.side,
      type: 'BUFF',
      targetSide: c.side,
      buff: {
        stat: plan.effect.stat,
        amount: plan.effect.amount,
        durationTurns: plan.effect.durationTurns ?? 3,
      },
      message: `${c.name} boit ${plan.name} : +${plan.effect.amount} ${plan.effect.stat} pour ${plan.effect.durationTurns ?? 3} tours.`,
    });
  }
}

function tryReactiveHeal(
  c: Combatant,
  queue: ConsumablePlan[],
  log: CombatAction[],
  turn: number,
): void {
  if (c.hp / c.maxHp >= 0.5) return;
  if (queue.length === 0) return;
  const pick = queue.shift()!;
  if (pick.effect.type === 'HEAL_HP' && pick.effect.hp) {
    const healed = Math.min(pick.effect.hp, c.maxHp - c.hp);
    c.hp += healed;
    log.push({
      turn, side: c.side, type: 'HEAL', targetSide: c.side, heal: healed,
      message: `${c.name} utilise ${pick.name} : +${healed} PV.`,
    });
  } else if (pick.effect.type === 'HEAL_MP' && pick.effect.mp) {
    const healed = Math.min(pick.effect.mp, c.maxMp - c.mp);
    c.mp += healed;
    log.push({
      turn, side: c.side, type: 'HEAL', targetSide: c.side, heal: healed,
      message: `${c.name} utilise ${pick.name} : +${healed} PM.`,
    });
  }
}

function pickSpellToCast(
  self: Combatant,
  target: Combatant,
  slots: SpellSlot[],
  buffs: ActiveBuff[],
): SpellSlot | null {
  const ready = slots.filter((s) => s.cooldownLeft <= 0 && self.mp >= s.spell.mpCost);

  if (self.hp / self.maxHp < 0.4) {
    const heal = ready.find((s) => s.spell.effect.type === 'HEAL');
    if (heal) return heal;
  }

  const buff = ready.find((s) => {
    if (s.spell.effect.type !== 'BUFF' || !s.spell.effect.stat) return false;
    return !buffs.some((b) => b.stat === s.spell.effect.stat);
  });
  if (buff) return buff;

  const damage = ready
    .filter((s) => s.spell.effect.type === 'DAMAGE')
    .sort((a, b) => estimateDamage(self, target, b.spell) - estimateDamage(self, target, a.spell));
  if (damage.length > 0) return damage[0]!;

  return null;
}

function estimateDamage(self: Combatant, target: Combatant, spell: SpellDef): number {
  const mult = spell.effect.attackMultiplier ?? 1;
  const flat = spell.effect.flatDamage ?? 0;
  const hits = spell.effect.hits ?? 1;
  const base = Math.max(1, self.attack * mult - target.defense / 2) + flat;
  return base * hits;
}

function castSpell(
  self: Combatant,
  target: Combatant,
  slot: SpellSlot,
  turn: number,
  log: CombatAction[],
  rng: SeededRNG,
  selfBuffs: ActiveBuff[],
): void {
  const spell = slot.spell;
  self.mp = Math.max(0, self.mp - spell.mpCost);
  slot.cooldownLeft = spell.cooldownTurns;

  switch (spell.effect.type) {
    case 'HEAL': {
      const amount = spell.effect.healHp ?? 0;
      const healed = Math.min(amount, self.maxHp - self.hp);
      self.hp += healed;
      log.push({
        turn, side: self.side, type: 'SPELL', targetSide: self.side,
        heal: healed, spellCode: spell.code, spellName: spell.name,
        message: `${self.name} lance ${spell.name} : +${healed} PV.`,
      });
      return;
    }
    case 'BUFF': {
      applyBuff(self, selfBuffs, spell.effect, turn, log, spell);
      return;
    }
    case 'DAMAGE': {
      applySpellDamage(self, target, spell, turn, log, rng, selfBuffs);
      return;
    }
  }
}

function applyBuff(
  c: Combatant,
  buffs: ActiveBuff[],
  eff: SpellEffect,
  turn: number,
  log: CombatAction[],
  spell: SpellDef,
): void {
  if (!eff.stat || !eff.amount) return;
  buffs.push({
    stat: eff.stat,
    amount: eff.amount,
    remaining: eff.durationTurns ?? 3,
  });
  log.push({
    turn,
    side: c.side,
    type: 'SPELL',
    targetSide: c.side,
    buff: { stat: eff.stat, amount: eff.amount, durationTurns: eff.durationTurns ?? 3 },
    spellCode: spell.code,
    spellName: spell.name,
    message: `${c.name} lance ${spell.name} : +${eff.amount} ${eff.stat} pour ${eff.durationTurns ?? 3} tours.`,
  });
}

function applySpellDamage(
  self: Combatant,
  target: Combatant,
  spell: SpellDef,
  turn: number,
  log: CombatAction[],
  rng: SeededRNG,
  selfBuffs: ActiveBuff[],
): void {
  const eff = spell.effect;
  const hits = eff.hits ?? 1;
  const effAttack = self.attack + sumBuffs(selfBuffs, 'attack');
  const effCrit = Math.min(
    0.95,
    self.critChance + sumBuffs(selfBuffs, 'critChance') + (eff.critBonus ?? 0),
  );
  for (let i = 0; i < hits; i += 1) {
    if (target.hp <= 0) break;
    const base = Math.max(1, effAttack * (eff.attackMultiplier ?? 1) - Math.floor(target.defense / 2));
    const variance = 0.9 + rng.next() * 0.2;
    let dmg = Math.max(1, Math.round(base * variance + (eff.flatDamage ?? 0)));
    const crit = rng.next() < effCrit;
    if (crit) dmg = Math.round(dmg * 2);
    target.hp -= dmg;
    log.push({
      turn, side: self.side, type: 'SPELL', targetSide: target.side,
      damage: dmg, spellCode: spell.code, spellName: spell.name,
      message: crit
        ? `${self.name} lance ${spell.name} : CRITIQUE ${dmg} dégâts !`
        : `${self.name} lance ${spell.name} : ${dmg} dégâts.`,
    });
  }
}

function applyAttack(
  attacker: Combatant,
  defender: Combatant,
  turn: number,
  log: CombatAction[],
  rng: SeededRNG,
  buffsBySide: Record<CombatActorSide, ActiveBuff[]>,
): void {
  const atkBuffs = buffsBySide[attacker.side];
  const defBuffs = buffsBySide[defender.side];

  const effAttack = attacker.attack + sumBuffs(atkBuffs, 'attack');
  const effDefense = defender.defense + sumBuffs(defBuffs, 'defense');
  const effDodge = Math.min(
    0.8,
    defender.dodgeChance + sumBuffs(defBuffs, 'dodgeChance'),
  );
  const effCrit = Math.min(
    0.9,
    attacker.critChance + sumBuffs(atkBuffs, 'critChance'),
  );

  if (rng.next() < attacker.critFailChance) {
    log.push({
      turn, side: attacker.side, type: 'CRIT_FAIL',
      targetSide: defender.side, damage: 0,
      message: `${attacker.name} glisse et rate son attaque.`,
    });
    return;
  }
  if (rng.next() < effDodge) {
    log.push({
      turn, side: attacker.side, type: 'DODGE',
      targetSide: defender.side, damage: 0,
      message: `${defender.name} esquive.`,
    });
    return;
  }

  const baseDmg = Math.max(1, effAttack - Math.floor(effDefense / 2));
  const variance = 0.85 + rng.next() * 0.3;
  let dmg = Math.max(1, Math.round(baseDmg * variance));
  let crit = false;
  if (rng.next() < effCrit) {
    dmg = Math.round(dmg * 2);
    crit = true;
  }

  defender.hp -= dmg;
  log.push({
    turn, side: attacker.side,
    type: crit ? 'CRIT' : 'ATTACK',
    targetSide: defender.side, damage: dmg,
    message: crit
      ? `${attacker.name} frappe CRITIQUE pour ${dmg} dégâts !`
      : `${attacker.name} inflige ${dmg} dégâts à ${defender.name}.`,
  });
}

function sumBuffs(buffs: ActiveBuff[], stat: keyof HeroStats): number {
  return buffs.filter((b) => b.stat === stat).reduce((a, b) => a + b.amount, 0);
}
