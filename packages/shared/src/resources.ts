export const RESOURCE_TYPES = [
  'WOOD',
  'IRON',
  'LEATHER',
  'HERB',
  'GOLD',
  'GEM',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type ResourceBag = Record<ResourceType, number>;

export function emptyBag(): ResourceBag {
  return { WOOD: 0, IRON: 0, LEATHER: 0, HERB: 0, GOLD: 0, GEM: 0 };
}
