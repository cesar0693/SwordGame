import type { ResourceType } from './resources.js';

export const COMPANION_ROLES = [
  'MINER',
  'WOODCUTTER',
  'FARMER',
  'GATHERER',
  'ALCHEMIST',
  'BAKER',
  'BLACKSMITH',
] as const;
export type CompanionRole = (typeof COMPANION_ROLES)[number];

export type CompanionState = 'LOCKED' | 'IDLE' | 'WORKING';

/** A single perk option the player can pick at a given level. */
export interface PerkChoice {
  code: string;
  label: string;
  description: string;
  /** Short bullet for the tradeoff panel ("+25% quantité", "−20% temps"...) */
  tradeoff: string;
}

/** Set of mutually exclusive perk choices presented at a given level. */
export interface PerkTier {
  level: number;
  choices: PerkChoice[];
}

export interface CompanionSpec {
  role: CompanionRole;
  name: string;
  tagline: string;
  /** Hero level required to unlock this companion. */
  unlockHeroLevel: number;
  /** Gold + resources required to unlock. */
  unlockCost: Partial<Record<ResourceType, number>>;
  /** Base cycle duration (seconds). */
  baseCycleSeconds: number;
  /** Base output per cycle. */
  baseOutput: { type: ResourceType | 'POTION' | 'BREAD' | 'ITEM'; amount: number };
  /** Optional inputs consumed by each cycle (the Alchemist uses HERB etc.). */
  baseInputs?: Partial<Record<ResourceType, number>>;
  perkTiers: PerkTier[];
}

// ---------------------------------------------------------------------------
// Perk tiers: every companion exposes the SAME tradeoff structure to keep UI
// simple and choices legible. The actual effects differ per role at runtime.
// ---------------------------------------------------------------------------

function commonProducerTiers(): PerkTier[] {
  return [
    {
      level: 2,
      choices: [
        {
          code: 'QUANTITY_25',
          label: 'Main leste',
          tradeoff: '+25 % quantité par cycle',
          description: 'Produit plus à chaque cycle, mais garde le même tempo.',
        },
        {
          code: 'SPEED_20',
          label: 'Efficacité',
          tradeoff: '−20 % durée de cycle',
          description: 'Cycles plus rapides, même quantité par cycle.',
        },
        {
          code: 'NEW_RESOURCE',
          label: 'Exploration',
          tradeoff: 'Débloque une 2ᵉ ressource rare',
          description: 'Ajoute un drop secondaire, sans accélérer la cadence.',
        },
      ],
    },
    {
      level: 4,
      choices: [
        {
          code: 'TOOL_DURABILITY',
          label: 'Main sûre',
          tradeoff: 'Usure des outils −50 %',
          description: 'Les outils durent plus longtemps.',
        },
        {
          code: 'BATCH_YIELD',
          label: 'Récolte en lot',
          tradeoff: 'Tous les 4 cycles : +100 %',
          description: 'Bonus explosif mais espacé.',
        },
        {
          code: 'CRIT_RARE',
          label: 'Coup de chance',
          tradeoff: '+10 % de drop rare',
          description: 'Petite chance de ressource de valeur à chaque cycle.',
        },
      ],
    },
    {
      level: 6,
      choices: [
        {
          code: 'AUTO_RESTART',
          label: 'Infatigable',
          tradeoff: 'Relance auto des cycles',
          description: 'Plus besoin de claim : le compagnon relance tout seul.',
        },
        {
          code: 'STORAGE_BOOST',
          label: 'Sac-à-dos',
          tradeoff: '+50 % capacité de stockage',
          description: 'Peut accumuler plus avant d’être plein.',
        },
        {
          code: 'OVERTIME',
          label: 'Heures sup’',
          tradeoff: '+40 % quantité, −15 % durabilité',
          description: 'Produit beaucoup plus, mais consomme les outils plus vite.',
        },
      ],
    },
  ];
}

function commonCrafterTiers(): PerkTier[] {
  return [
    {
      level: 2,
      choices: [
        {
          code: 'RECIPE_UNLOCK',
          label: 'Carnet de recettes',
          tradeoff: 'Débloque une 2ᵉ recette',
          description: 'Deux produits différents disponibles.',
        },
        {
          code: 'SPEED_25',
          label: 'Mains rapides',
          tradeoff: '−25 % durée de craft',
          description: 'Craft plus rapide, même recette.',
        },
        {
          code: 'COST_REDUCTION',
          label: 'Économe',
          tradeoff: '−20 % coût en ingrédients',
          description: 'Moins d’inputs consommés par craft.',
        },
      ],
    },
    {
      level: 4,
      choices: [
        {
          code: 'POTENCY_25',
          label: 'Puissance',
          tradeoff: 'Effets +25 %',
          description: 'Les potions/objets craftés sont plus forts.',
        },
        {
          code: 'DURATION_50',
          label: 'Longue tenue',
          tradeoff: 'Buffs +50 % de durée',
          description: 'Les potions durent plus longtemps en combat.',
        },
        {
          code: 'DOUBLE_CRAFT',
          label: 'Main heureuse',
          tradeoff: '15 % de chance d’un craft double',
          description: 'Petite chance de produire deux à la fois.',
        },
      ],
    },
    {
      level: 6,
      choices: [
        {
          code: 'AUTO_QUEUE',
          label: 'Atelier automatique',
          tradeoff: 'Relance auto tant qu’il y a des inputs',
          description: 'L’atelier tourne tout seul.',
        },
        {
          code: 'RARE_PROC',
          label: 'Œil d’orfèvre',
          tradeoff: '+8 % rareté supérieure',
          description: 'Chance de produire une version améliorée.',
        },
        {
          code: 'SIGNATURE',
          label: 'Signature',
          tradeoff: 'Débloque une recette exclusive',
          description: 'Recette rare réservée à cette voie.',
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const COMPANION_CATALOG: Record<CompanionRole, CompanionSpec> = {
  MINER: {
    role: 'MINER',
    name: 'Mineur',
    tagline: 'Extrait les minerais des veines de la vallée.',
    unlockHeroLevel: 1,
    unlockCost: { GOLD: 0 },
    baseCycleSeconds: 60,
    baseOutput: { type: 'IRON', amount: 8 },
    perkTiers: commonProducerTiers(),
  },
  WOODCUTTER: {
    role: 'WOODCUTTER',
    name: 'Bûcheron',
    tagline: 'Abat les arbres autour du camp.',
    unlockHeroLevel: 1,
    unlockCost: { GOLD: 0 },
    baseCycleSeconds: 45,
    baseOutput: { type: 'WOOD', amount: 10 },
    perkTiers: commonProducerTiers(),
  },
  FARMER: {
    role: 'FARMER',
    name: 'Paysan',
    tagline: 'Cultive blé et légumes pour nourrir le camp.',
    unlockHeroLevel: 3,
    unlockCost: { GOLD: 50, WOOD: 40 },
    baseCycleSeconds: 90,
    baseOutput: { type: 'HERB', amount: 6 }, // placeholder: farmer produces herb/grain stand-in
    perkTiers: commonProducerTiers(),
  },
  GATHERER: {
    role: 'GATHERER',
    name: 'Récolteur',
    tagline: 'Cueille plantes et champignons dans la forêt.',
    unlockHeroLevel: 3,
    unlockCost: { GOLD: 50, LEATHER: 10 },
    baseCycleSeconds: 75,
    baseOutput: { type: 'HERB', amount: 7 },
    perkTiers: commonProducerTiers(),
  },
  ALCHEMIST: {
    role: 'ALCHEMIST',
    name: 'Alchimiste',
    tagline: 'Prépare des potions de soin, de mana ou de boost.',
    unlockHeroLevel: 5,
    unlockCost: { GOLD: 150, WOOD: 60, IRON: 20 },
    baseCycleSeconds: 120,
    baseOutput: { type: 'POTION', amount: 1 },
    baseInputs: { HERB: 4 },
    perkTiers: commonCrafterTiers(),
  },
  BAKER: {
    role: 'BAKER',
    name: 'Boulanger',
    tagline: 'Cuit le pain qui régénère la vie hors combat.',
    unlockHeroLevel: 5,
    unlockCost: { GOLD: 120, WOOD: 40 },
    baseCycleSeconds: 100,
    baseOutput: { type: 'BREAD', amount: 2 },
    baseInputs: { HERB: 2 }, // placeholder for flour
    perkTiers: commonCrafterTiers(),
  },
  BLACKSMITH: {
    role: 'BLACKSMITH',
    name: 'Forgeron',
    tagline: 'Forge et améliore armes et armures.',
    unlockHeroLevel: 7,
    unlockCost: { GOLD: 300, IRON: 80, WOOD: 60 },
    baseCycleSeconds: 180,
    baseOutput: { type: 'ITEM', amount: 1 },
    baseInputs: { IRON: 6, LEATHER: 3 },
    perkTiers: commonCrafterTiers(),
  },
};

// ---------------------------------------------------------------------------
// Runtime DTOs
// ---------------------------------------------------------------------------

export interface CompanionPerkPick {
  level: number;
  code: string;
}

export interface Companion {
  id: string;
  heroId: string;
  role: CompanionRole;
  state: CompanionState;
  level: number;
  toolDurability: number;         // 0..100
  cycleStartAt: string | null;
  cycleFinishAt: string | null;
  unlockedAt: string | null;
  perks: CompanionPerkPick[];
  /** Tier currently awaiting a choice (null if none). */
  pendingPerkLevel: number | null;
}

/** Offline production cap: how many full cycles can accumulate while offline. */
export const OFFLINE_CYCLE_CAP = 12; // e.g. 12 cycles = 12 min at 60s, 9h at baker 45min
