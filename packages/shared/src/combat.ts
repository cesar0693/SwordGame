import type { ItemStatBonus } from './items.js';
import type { ResourceType } from './resources.js';

export type CombatActorSide = 'HERO' | 'ENEMY';

export type CombatActionType =
  | 'ATTACK'
  | 'CRIT'
  | 'CRIT_FAIL'
  | 'DODGE'
  | 'HEAL'
  | 'BUFF'
  | 'DEFEAT';

export interface CombatAction {
  turn: number;
  side: CombatActorSide;
  type: CombatActionType;
  targetSide: CombatActorSide;
  damage?: number;
  heal?: number;
  buff?: { stat: string; amount: number; durationTurns: number };
  message: string;
}

export type CombatOutcome = 'VICTORY' | 'DEFEAT';

export interface CombatRewardItem {
  id: string;
  name: string;
  rarity: string;
  slot: string | null;
  bonuses: ItemStatBonus;
}

export interface CombatRewards {
  xp: number;
  gold: number;
  levelUps: number;
  resources: Array<{ type: ResourceType; amount: number }>;
  items: CombatRewardItem[];
}

export interface CombatReport {
  seed: string;
  outcome: CombatOutcome;
  turns: number;
  heroHpLeft: number;
  enemyHpLeft: number;
  actions: CombatAction[];
  rewards: CombatRewards | null; // null on defeat
}
