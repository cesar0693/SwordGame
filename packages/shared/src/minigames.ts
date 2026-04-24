export type MinigameCode = 'COIN_FLIP' | 'DICE_ROLL';

export const MINIGAMES: MinigameCode[] = ['COIN_FLIP', 'DICE_ROLL'];

export interface MinigameDef {
  code: MinigameCode;
  name: string;
  description: string;
  minBet: number;
  maxBet: number;
  /** One free play per day means player only pays beyond the first daily spin. */
  dailyFree: boolean;
}

export const MINIGAME_CATALOG: Record<MinigameCode, MinigameDef> = {
  COIN_FLIP: {
    code: 'COIN_FLIP',
    name: 'Pile ou face',
    description:
      'Mise sur pile ou face. Tu doubles si tu as raison, tu perds ta mise sinon.',
    minBet: 10,
    maxBet: 500,
    dailyFree: true,
  },
  DICE_ROLL: {
    code: 'DICE_ROLL',
    name: 'Dé chanceux',
    description:
      'Trois dés à 6 faces. Somme ≥ 12 : tu gagnes 2.5× ta mise. Sinon tu la perds.',
    minBet: 20,
    maxBet: 500,
    dailyFree: true,
  },
};

export interface MinigamePlayResult {
  code: MinigameCode;
  betGold: number;
  wasFree: boolean;
  /** Chosen side for COIN_FLIP, ignored for DICE_ROLL. */
  choice?: 'HEADS' | 'TAILS';
  /** Server-rolled outcome for COIN_FLIP. */
  flipOutcome?: 'HEADS' | 'TAILS';
  /** Three 1-6 integers for DICE_ROLL. */
  diceRoll?: [number, number, number];
  diceSum?: number;
  win: boolean;
  /** Net gold movement: negative when a paid play is lost, positive when won. */
  netGold: number;
  newGold: number;
}

export interface MinigameState {
  code: MinigameCode;
  def: MinigameDef;
  freePlayAvailable: boolean;
}
