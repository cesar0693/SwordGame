export const RESOURCE_TYPES = [
  // Currency
  'GOLD',

  // Miner tiers (easiest → rarest)
  'IRON',
  'COPPER',
  'SILVER',
  'GEM',

  // Woodcutter tiers
  'WOOD',
  'OAK',
  'IRONWOOD',

  // Farmer tiers
  'WHEAT',
  'CORN',

  // Gatherer tiers
  'HERB',
  'MUSHROOM',
  'FLOWER',

  // Hunter drops (also looted from missions later)
  'LEATHER',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type ResourceBag = Record<ResourceType, number>;

export function emptyBag(): ResourceBag {
  const bag = {} as ResourceBag;
  for (const t of RESOURCE_TYPES) bag[t] = 0;
  return bag;
}

/** Display label (FR). */
export const RESOURCE_LABELS: Record<ResourceType, string> = {
  GOLD: 'Or',
  IRON: 'Fer',
  COPPER: 'Cuivre',
  SILVER: 'Argent',
  GEM: 'Gemme',
  WOOD: 'Bois',
  OAK: 'Chêne',
  IRONWOOD: 'Bois de fer',
  WHEAT: 'Blé',
  CORN: 'Maïs',
  HERB: 'Herbe',
  MUSHROOM: 'Champignon',
  FLOWER: 'Fleur',
  LEATHER: 'Cuir',
};
