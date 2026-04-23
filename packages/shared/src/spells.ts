import type { HeroClass, HeroStats } from './hero.js';

export type SpellEffectType = 'DAMAGE' | 'HEAL' | 'BUFF';

export interface SpellEffect {
  type: SpellEffectType;
  /** DAMAGE: multiplier applied to attacker's effective attack. */
  attackMultiplier?: number;
  /** DAMAGE: flat damage added on top (fire/ice/etc). */
  flatDamage?: number;
  /** DAMAGE: number of hits (multi-shot). */
  hits?: number;
  /** DAMAGE: extra crit chance for this spell (additive). */
  critBonus?: number;
  /** HEAL: HP restored. */
  healHp?: number;
  /** BUFF: stat to boost. */
  stat?: keyof Omit<HeroStats, 'critFailChance'>;
  /** BUFF: amount added. */
  amount?: number;
  /** BUFF: turns the buff lasts. */
  durationTurns?: number;
}

export interface SpellDef {
  code: string;
  name: string;
  description: string;
  classLock: HeroClass;
  learnAtLevel: number;
  mpCost: number;
  cooldownTurns: number;
  effect: SpellEffect;
}

export const MAX_EQUIPPED_SPELLS = 3;

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

function s(
  code: string,
  classLock: HeroClass,
  learnAtLevel: number,
  name: string,
  description: string,
  mpCost: number,
  cooldownTurns: number,
  effect: SpellEffect,
): SpellDef {
  return { code, name, description, classLock, learnAtLevel, mpCost, cooldownTurns, effect };
}

export const SPELL_CATALOG: SpellDef[] = [
  // ------ WARRIOR ------
  s('SLASH', 'WARRIOR', 1,
    'Entaille', 'Frappe puissante — 150 % ATQ.',
    5, 2, { type: 'DAMAGE', attackMultiplier: 1.5 }),
  s('SHIELD_WALL', 'WARRIOR', 3,
    'Mur de boucliers', '+10 DEF pendant 3 tours.',
    10, 4, { type: 'BUFF', stat: 'defense', amount: 10, durationTurns: 3 }),
  s('HEROIC_STRIKE', 'WARRIOR', 5,
    'Frappe héroïque', '250 % ATQ + 20 % crit.',
    15, 3, { type: 'DAMAGE', attackMultiplier: 2.5, critBonus: 0.2 }),
  s('BATTLE_CRY', 'WARRIOR', 7,
    'Cri de guerre', '+8 ATQ pendant 4 tours.',
    20, 5, { type: 'BUFF', stat: 'attack', amount: 8, durationTurns: 4 }),

  // ------ MAGE ------
  s('FIREBALL', 'MAGE', 1,
    'Boule de feu', '200 % ATQ + 10 dégâts de feu.',
    8, 2, { type: 'DAMAGE', attackMultiplier: 2, flatDamage: 10 }),
  s('ARCANE_SHIELD', 'MAGE', 3,
    'Bouclier arcanique', '+6 DEF et +10 % esquive pendant 3 tours.',
    12, 4, { type: 'BUFF', stat: 'dodgeChance', amount: 0.1, durationTurns: 3 }),
  s('LIGHTNING', 'MAGE', 5,
    'Éclair', '300 % ATQ + 30 % crit.',
    20, 3, { type: 'DAMAGE', attackMultiplier: 3, critBonus: 0.3 }),
  s('REGENERATION', 'MAGE', 7,
    'Régénération', 'Restaure 50 PV.',
    25, 5, { type: 'HEAL', healHp: 50 }),

  // ------ RANGER ------
  s('POISON_ARROW', 'RANGER', 1,
    'Flèche empoisonnée', '180 % ATQ.',
    6, 2, { type: 'DAMAGE', attackMultiplier: 1.8 }),
  s('EVASION', 'RANGER', 3,
    'Esquive', '+20 % esquive pendant 3 tours.',
    10, 4, { type: 'BUFF', stat: 'dodgeChance', amount: 0.2, durationTurns: 3 }),
  s('MULTI_SHOT', 'RANGER', 5,
    'Tir multiple', '2 tirs à 120 % ATQ.',
    18, 3, { type: 'DAMAGE', attackMultiplier: 1.2, hits: 2 }),
  s('HUNTERS_FOCUS', 'RANGER', 7,
    'Concentration', '+25 % crit pendant 4 tours.',
    22, 5, { type: 'BUFF', stat: 'critChance', amount: 0.25, durationTurns: 4 }),
];

export function spellByCode(code: string): SpellDef | null {
  return SPELL_CATALOG.find((s) => s.code === code) ?? null;
}

export function spellsForClass(cls: HeroClass): SpellDef[] {
  return SPELL_CATALOG.filter((s) => s.classLock === cls);
}

/** Spells that a hero of the given class/level should know. */
export function learnableSpells(cls: HeroClass, heroLevel: number): SpellDef[] {
  return spellsForClass(cls).filter((s) => s.learnAtLevel <= heroLevel);
}

export interface HeroSpell {
  code: string;
  equipped: boolean;
  learnedAt: string;
}
