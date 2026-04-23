import type {
  CombatAction,
  CombatActorSide,
  CombatReport,
  ConsumableEffect,
  EnemyStats,
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

interface ConsumablePlan {
  effect: ConsumableEffect;
  name: string;
}

interface SpellSlot {
  spell: SpellDef;
  cooldownLeft: number;
}

const MAX_TURNS = 60;

export function simulateCombat(
  hero: HeroStats & { name: string },
  enemy: EnemyStats,
  consumables: ConsumablePlan[],
  spells: SpellDef[],
  seed: string,
): CombatReport {
  const rng = new SeededRNG(seed);

  const heroC: Combatant = {
    side: 'HERO',
    name: hero.name,
    hp: hero.hp,
    maxHp: hero.hp,
    mp: hero.mp,
    maxMp: hero.mp,
    attack: hero.attack,
    defense: hero.defense,
    speed: hero.speed,
    critChance: hero.critChance,
    critFailChance: hero.critFailChance,
    dodgeChance: hero.dodgeChance,
  };
  const enemyC: Combatant = {
    side: 'ENEMY',
    name: enemy.name,
    hp: enemy.hp,
    maxHp: enemy.hp,
    mp: enemy.mp,
    maxMp: enemy.mp,
    attack: enemy.attack,
    defense: enemy.defense,
    speed: enemy.speed,
    critChance: enemy.critChance,
    critFailChance: enemy.critFailChance,
    dodgeChance: enemy.dodgeChance,
  };

  const actions: CombatAction[] = [];
  const heroBuffs: ActiveBuff[] = [];
  const spellSlots: SpellSlot[] = spells.map((s) => ({ spell: s, cooldownLeft: 0 }));

  // Turn 1: apply all BUFF consumables (queued in order)
  let turn = 1;
  for (const c of consumables) {
    if (c.effect.type === 'BUFF' && c.effect.stat && c.effect.amount) {
      heroBuffs.push({
        stat: c.effect.stat,
        amount: c.effect.amount,
        remaining: c.effect.durationTurns ?? 3,
      });
      actions.push({
        turn,
        side: 'HERO',
        type: 'BUFF',
        targetSide: 'HERO',
        buff: {
          stat: c.effect.stat,
          amount: c.effect.amount,
          durationTurns: c.effect.durationTurns ?? 3,
        },
        message: `${heroC.name} boit ${c.name} : +${c.effect.amount} ${c.effect.stat} pour ${c.effect.durationTurns ?? 3} tours.`,
      });
    }
  }

  const healQueue: ConsumablePlan[] = consumables.filter(
    (c) => c.effect.type === 'HEAL_HP' || c.effect.type === 'HEAL_MP',
  );

  while (turn <= MAX_TURNS) {
    // --- Hero's reactive consumable: heal if HP < 50% ---
    if (heroC.hp / heroC.maxHp < 0.5 && healQueue.length) {
      const pick = healQueue.shift()!;
      if (pick.effect.type === 'HEAL_HP' && pick.effect.hp) {
        const healed = Math.min(pick.effect.hp, heroC.maxHp - heroC.hp);
        heroC.hp += healed;
        actions.push({
          turn, side: 'HERO', type: 'HEAL', targetSide: 'HERO', heal: healed,
          message: `${heroC.name} utilise ${pick.name} : +${healed} PV.`,
        });
      } else if (pick.effect.type === 'HEAL_MP' && pick.effect.mp) {
        const healed = Math.min(pick.effect.mp, heroC.maxMp - heroC.mp);
        heroC.mp += healed;
        actions.push({
          turn, side: 'HERO', type: 'HEAL', targetSide: 'HERO', heal: healed,
          message: `${heroC.name} utilise ${pick.name} : +${healed} PM.`,
        });
      }
    }

    const heroEffSpeed = heroC.speed + sumBuffs(heroBuffs, 'speed');
    const first: Combatant = heroEffSpeed >= enemyC.speed ? heroC : enemyC;
    const second: Combatant = first === heroC ? enemyC : heroC;

    for (const attacker of [first, second]) {
      if (heroC.hp <= 0 || enemyC.hp <= 0) break;
      const defender = attacker === heroC ? enemyC : heroC;

      if (attacker.side === 'HERO') {
        const cast = pickSpellToCast(heroC, enemyC, spellSlots, heroBuffs, turn);
        if (cast) {
          castSpell(heroC, enemyC, cast, turn, actions, rng, heroBuffs);
          continue;
        }
      }
      applyAttack(attacker, defender, turn, actions, rng, heroBuffs);
    }

    // End of turn: tick buffs + cooldowns
    for (const b of heroBuffs) b.remaining -= 1;
    for (let i = heroBuffs.length - 1; i >= 0; i -= 1) {
      if (heroBuffs[i]!.remaining <= 0) heroBuffs.splice(i, 1);
    }
    for (const slot of spellSlots) {
      if (slot.cooldownLeft > 0) slot.cooldownLeft -= 1;
    }

    if (heroC.hp <= 0 || enemyC.hp <= 0) break;
    turn += 1;
  }

  const outcome = enemyC.hp <= 0 ? 'VICTORY' : 'DEFEAT';
  if (outcome === 'DEFEAT') {
    actions.push({
      turn, side: 'ENEMY', type: 'DEFEAT', targetSide: 'HERO',
      message: `${heroC.name} est vaincu.`,
    });
  } else {
    actions.push({
      turn, side: 'HERO', type: 'DEFEAT', targetSide: 'ENEMY',
      message: `${enemyC.name} s'effondre.`,
    });
  }

  return {
    seed,
    outcome,
    turns: turn,
    heroHpLeft: Math.max(0, heroC.hp),
    enemyHpLeft: Math.max(0, enemyC.hp),
    actions,
    rewards: null,
  };
}

// ---------------------------------------------------------------------------
// Spell picking priority:
//   1. HEAL if HP < 40 % and spell ready + MP ok
//   2. BUFF ready + MP ok, if no buff for that stat active yet
//   3. DAMAGE ready + MP ok (highest expected damage first)
// ---------------------------------------------------------------------------
function pickSpellToCast(
  hero: Combatant,
  enemy: Combatant,
  slots: SpellSlot[],
  buffs: ActiveBuff[],
  _turn: number,
): SpellSlot | null {
  const ready = slots.filter((s) => s.cooldownLeft <= 0 && hero.mp >= s.spell.mpCost);

  // Heal if low HP
  if (hero.hp / hero.maxHp < 0.4) {
    const heal = ready.find((s) => s.spell.effect.type === 'HEAL');
    if (heal) return heal;
  }

  // Buff if not already active
  const buff = ready.find((s) => {
    if (s.spell.effect.type !== 'BUFF' || !s.spell.effect.stat) return false;
    return !buffs.some((b) => b.stat === s.spell.effect.stat);
  });
  if (buff) return buff;

  // Damage: pick the one with highest raw expected damage
  const damage = ready
    .filter((s) => s.spell.effect.type === 'DAMAGE')
    .sort((a, b) => estimateDamage(hero, enemy, b.spell) - estimateDamage(hero, enemy, a.spell));
  if (damage.length > 0) return damage[0]!;

  return null;
}

function estimateDamage(hero: Combatant, enemy: Combatant, spell: SpellDef): number {
  const mult = spell.effect.attackMultiplier ?? 1;
  const flat = spell.effect.flatDamage ?? 0;
  const hits = spell.effect.hits ?? 1;
  const base = Math.max(1, hero.attack * mult - enemy.defense / 2) + flat;
  return base * hits;
}

function castSpell(
  hero: Combatant,
  enemy: Combatant,
  slot: SpellSlot,
  turn: number,
  log: CombatAction[],
  rng: SeededRNG,
  heroBuffs: ActiveBuff[],
): void {
  const spell = slot.spell;
  hero.mp = Math.max(0, hero.mp - spell.mpCost);
  slot.cooldownLeft = spell.cooldownTurns;

  switch (spell.effect.type) {
    case 'HEAL': {
      const amount = spell.effect.healHp ?? 0;
      const healed = Math.min(amount, hero.maxHp - hero.hp);
      hero.hp += healed;
      log.push({
        turn, side: 'HERO', type: 'SPELL', targetSide: 'HERO',
        heal: healed, spellCode: spell.code, spellName: spell.name,
        message: `${hero.name} lance ${spell.name} : +${healed} PV.`,
      });
      return;
    }
    case 'BUFF': {
      applyBuff(hero, heroBuffs, spell.effect, turn, log, spell);
      return;
    }
    case 'DAMAGE': {
      applySpellDamage(hero, enemy, spell, turn, log, rng, heroBuffs);
      return;
    }
  }
}

function applyBuff(
  hero: Combatant,
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
    side: 'HERO',
    type: 'SPELL',
    targetSide: 'HERO',
    buff: { stat: eff.stat, amount: eff.amount, durationTurns: eff.durationTurns ?? 3 },
    spellCode: spell.code,
    spellName: spell.name,
    message: `${hero.name} lance ${spell.name} : +${eff.amount} ${eff.stat} pour ${eff.durationTurns ?? 3} tours.`,
  });
}

function applySpellDamage(
  hero: Combatant,
  enemy: Combatant,
  spell: SpellDef,
  turn: number,
  log: CombatAction[],
  rng: SeededRNG,
  heroBuffs: ActiveBuff[],
): void {
  const eff = spell.effect;
  const hits = eff.hits ?? 1;
  const effAttack = hero.attack + sumBuffs(heroBuffs, 'attack');
  const effCrit = Math.min(
    0.95,
    hero.critChance + sumBuffs(heroBuffs, 'critChance') + (eff.critBonus ?? 0),
  );
  for (let i = 0; i < hits; i += 1) {
    if (enemy.hp <= 0) break;
    const base = Math.max(1, effAttack * (eff.attackMultiplier ?? 1) - Math.floor(enemy.defense / 2));
    const variance = 0.9 + rng.next() * 0.2;
    let dmg = Math.max(1, Math.round(base * variance + (eff.flatDamage ?? 0)));
    const crit = rng.next() < effCrit;
    if (crit) dmg = Math.round(dmg * 2);
    enemy.hp -= dmg;
    log.push({
      turn, side: 'HERO', type: 'SPELL', targetSide: 'ENEMY',
      damage: dmg, spellCode: spell.code, spellName: spell.name,
      message: crit
        ? `${hero.name} lance ${spell.name} : CRITIQUE ${dmg} dégâts !`
        : `${hero.name} lance ${spell.name} : ${dmg} dégâts.`,
    });
  }
}

function applyAttack(
  attacker: Combatant,
  defender: Combatant,
  turn: number,
  log: CombatAction[],
  rng: SeededRNG,
  heroBuffs: ActiveBuff[],
): void {
  const atkSide = attacker.side;
  const defSide = defender.side;

  const effAttack =
    attacker.side === 'HERO'
      ? attacker.attack + sumBuffs(heroBuffs, 'attack')
      : attacker.attack;
  const effDefense =
    defender.side === 'HERO'
      ? defender.defense + sumBuffs(heroBuffs, 'defense')
      : defender.defense;
  const effDodge =
    defender.side === 'HERO'
      ? Math.min(0.8, defender.dodgeChance + sumBuffs(heroBuffs, 'dodgeChance'))
      : defender.dodgeChance;
  const effCrit =
    attacker.side === 'HERO'
      ? Math.min(0.9, attacker.critChance + sumBuffs(heroBuffs, 'critChance'))
      : attacker.critChance;

  if (rng.next() < attacker.critFailChance) {
    log.push({
      turn, side: atkSide, type: 'CRIT_FAIL', targetSide: defSide, damage: 0,
      message: `${attacker.name} glisse et rate son attaque.`,
    });
    return;
  }
  if (rng.next() < effDodge) {
    log.push({
      turn, side: atkSide, type: 'DODGE', targetSide: defSide, damage: 0,
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
    turn, side: atkSide,
    type: crit ? 'CRIT' : 'ATTACK',
    targetSide: defSide, damage: dmg,
    message: crit
      ? `${attacker.name} frappe CRITIQUE pour ${dmg} dégâts !`
      : `${attacker.name} inflige ${dmg} dégâts à ${defender.name}.`,
  });
}

function sumBuffs(buffs: ActiveBuff[], stat: keyof HeroStats): number {
  return buffs.filter((b) => b.stat === stat).reduce((a, b) => a + b.amount, 0);
}
