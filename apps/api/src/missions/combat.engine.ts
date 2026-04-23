import type {
  CombatAction,
  CombatActorSide,
  CombatReport,
  ConsumableEffect,
  EnemyStats,
  HeroStats,
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
  remaining: number; // turns left
}

interface ConsumablePlan {
  effect: ConsumableEffect;
  name: string;
}

const MAX_TURNS = 60;

export function simulateCombat(
  hero: HeroStats & { name: string },
  enemy: EnemyStats,
  consumables: ConsumablePlan[],
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

  // Turn 1: apply all BUFF-type consumables (queued in order)
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

  // Heals are queued for auto-use when HP drops below 50%.
  const healQueue: ConsumablePlan[] = consumables.filter(
    (c) => c.effect.type === 'HEAL_HP' || c.effect.type === 'HEAL_MP',
  );

  while (turn <= MAX_TURNS) {
    // Hero considers a heal if HP < 50%
    if (heroC.hp / heroC.maxHp < 0.5 && healQueue.length) {
      const pick = healQueue.shift()!;
      if (pick.effect.type === 'HEAL_HP' && pick.effect.hp) {
        const healed = Math.min(pick.effect.hp, heroC.maxHp - heroC.hp);
        heroC.hp += healed;
        actions.push({
          turn,
          side: 'HERO',
          type: 'HEAL',
          targetSide: 'HERO',
          heal: healed,
          message: `${heroC.name} utilise ${pick.name} : +${healed} PV.`,
        });
      } else if (pick.effect.type === 'HEAL_MP' && pick.effect.mp) {
        const healed = Math.min(pick.effect.mp, heroC.maxMp - heroC.mp);
        heroC.mp += healed;
        actions.push({
          turn,
          side: 'HERO',
          type: 'HEAL',
          targetSide: 'HERO',
          heal: healed,
          message: `${heroC.name} utilise ${pick.name} : +${healed} PM.`,
        });
      }
    }

    // Compute turn order by effective speed (hero + buffs)
    const heroEffSpeed = heroC.speed + sumBuffs(heroBuffs, 'speed');
    const first: Combatant = heroEffSpeed >= enemyC.speed ? heroC : enemyC;
    const second: Combatant = first === heroC ? enemyC : heroC;

    for (const attacker of [first, second]) {
      if (heroC.hp <= 0 || enemyC.hp <= 0) break;
      const defender = attacker === heroC ? enemyC : heroC;
      applyAttack(attacker, defender, turn, actions, rng, heroBuffs);
    }

    // Tick buff durations at end of turn
    for (const b of heroBuffs) b.remaining -= 1;
    for (let i = heroBuffs.length - 1; i >= 0; i -= 1) {
      if (heroBuffs[i]!.remaining <= 0) heroBuffs.splice(i, 1);
    }

    if (heroC.hp <= 0 || enemyC.hp <= 0) break;
    turn += 1;
  }

  const outcome = enemyC.hp <= 0 ? 'VICTORY' : 'DEFEAT';
  if (outcome === 'DEFEAT') {
    actions.push({
      turn,
      side: 'ENEMY',
      type: 'DEFEAT',
      targetSide: 'HERO',
      message: `${heroC.name} est vaincu.`,
    });
  } else {
    actions.push({
      turn,
      side: 'HERO',
      type: 'DEFEAT',
      targetSide: 'ENEMY',
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
    rewards: null, // filled by the mission service on victory
  };
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

  // Crit-fail check first (whiff)
  if (rng.next() < attacker.critFailChance) {
    log.push({
      turn,
      side: atkSide,
      type: 'CRIT_FAIL',
      targetSide: defSide,
      damage: 0,
      message: `${attacker.name} glisse et rate son attaque.`,
    });
    return;
  }

  // Dodge check
  if (rng.next() < effDodge) {
    log.push({
      turn,
      side: atkSide,
      type: 'DODGE',
      targetSide: defSide,
      damage: 0,
      message: `${defender.name} esquive.`,
    });
    return;
  }

  const baseDmg = Math.max(1, effAttack - Math.floor(effDefense / 2));
  const variance = 0.85 + rng.next() * 0.3; // 0.85..1.15
  let dmg = Math.max(1, Math.round(baseDmg * variance));
  let crit = false;
  if (rng.next() < effCrit) {
    dmg = Math.round(dmg * 2);
    crit = true;
  }

  defender.hp -= dmg;
  log.push({
    turn,
    side: atkSide,
    type: crit ? 'CRIT' : 'ATTACK',
    targetSide: defSide,
    damage: dmg,
    message: crit
      ? `${attacker.name} frappe CRITIQUE pour ${dmg} dégâts !`
      : `${attacker.name} inflige ${dmg} dégâts à ${defender.name}.`,
  });
}

function sumBuffs(buffs: ActiveBuff[], stat: keyof HeroStats): number {
  return buffs.filter((b) => b.stat === stat).reduce((a, b) => a + b.amount, 0);
}
