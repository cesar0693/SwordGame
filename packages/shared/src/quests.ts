import type { ResourceType } from './resources.js';

export type QuestEventType =
  | 'MISSION_WIN'
  | 'PVP_WIN'
  | 'PVP_CHALLENGE'
  | 'COMPANION_CLAIM'
  | 'FORGE_CRAFT'
  | 'FORGE_UPGRADE_SUCCESS'
  | 'MARKET_SALE'
  | 'MINIGAME_PLAY';

export interface QuestReward {
  xp: number;
  gold: number;
  resources?: Partial<Record<ResourceType, number>>;
}

export interface QuestDef {
  code: string;
  name: string;
  description: string;
  event: QuestEventType;
  target: number;
  reward: QuestReward;
}

export const QUESTS_PER_DAY = 3;

export const QUEST_CATALOG: QuestDef[] = [
  {
    code: 'BOUNTY_HUNTER',
    name: 'Chasseur de primes',
    description: 'Remporte 3 missions PvE.',
    event: 'MISSION_WIN',
    target: 3,
    reward: { xp: 80, gold: 150 },
  },
  {
    code: 'GLADIATOR',
    name: 'Gladiateur',
    description: 'Gagne 2 combats dans l\'Arène.',
    event: 'PVP_WIN',
    target: 2,
    reward: { xp: 120, gold: 200 },
  },
  {
    code: 'ARENA_CONTENDER',
    name: 'Compétiteur',
    description: 'Lance 3 défis en Arène, peu importe l\'issue.',
    event: 'PVP_CHALLENGE',
    target: 3,
    reward: { xp: 50, gold: 90 },
  },
  {
    code: 'TIRELESS_WORKER',
    name: 'Infatigable',
    description: 'Fais travailler tes compagnons : 10 cycles récupérés.',
    event: 'COMPANION_CLAIM',
    target: 10,
    reward: { xp: 40, gold: 100, resources: { WOOD: 15, IRON: 10 } },
  },
  {
    code: 'MASTER_CRAFTER',
    name: 'Maître forgeron',
    description: 'Crafte 2 recettes à la Forge.',
    event: 'FORGE_CRAFT',
    target: 2,
    reward: { xp: 60, gold: 150, resources: { GEM: 1 } },
  },
  {
    code: 'ENHANCER',
    name: 'Enchanteur',
    description: 'Réussis 1 amélioration d\'équipement.',
    event: 'FORGE_UPGRADE_SUCCESS',
    target: 1,
    reward: { xp: 70, gold: 100, resources: { GEM: 2 } },
  },
  {
    code: 'MERCHANT',
    name: 'Marchand',
    description: 'Vends 1 offre sur le marché.',
    event: 'MARKET_SALE',
    target: 1,
    reward: { xp: 30, gold: 120 },
  },
  {
    code: 'GAMBLER',
    name: 'Joueur',
    description: 'Joue 3 parties de mini-jeux.',
    event: 'MINIGAME_PLAY',
    target: 3,
    reward: { xp: 25, gold: 60 },
  },
];

export function questByCode(code: string): QuestDef | null {
  return QUEST_CATALOG.find((q) => q.code === code) ?? null;
}

export interface DailyQuestState {
  code: string;
  event: QuestEventType;
  name: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  reward: QuestReward;
}
