export interface Texmf extends SystemTrees, UserTrees {}

export const SYSTEM_TREES = [
  'TEXDIR',
  'TEXMFLOCAL',
  'TEXMFSYSCONFIG',
  'TEXMFSYSVAR',
] as const;

export const USER_TREES = [
  'TEXMFHOME',
  'TEXMFCONFIG',
  'TEXMFVAR',
] as const;

export type SystemTrees = {
  readonly [Key in typeof SYSTEM_TREES[number]]: string;
};

export type UserTrees = {
  readonly [Key in typeof USER_TREES[number]]: string;
};
