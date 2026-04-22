export type CombatActorSide = 'HERO' | 'ENEMY';

export type CombatActionType =
  | 'ATTACK'
  | 'CRIT'
  | 'CRIT_FAIL'
  | 'DODGE'
  | 'SPELL'
  | 'DEFEAT';

export interface CombatAction {
  turn: number;
  side: CombatActorSide;
  type: CombatActionType;
  targetSide: CombatActorSide;
  damage?: number;
  spellId?: string;
  message: string;
}

export type CombatOutcome = 'VICTORY' | 'DEFEAT';

export interface CombatReport {
  seed: string;
  outcome: CombatOutcome;
  turns: number;
  heroHpLeft: number;
  enemyHpLeft: number;
  actions: CombatAction[];
}
