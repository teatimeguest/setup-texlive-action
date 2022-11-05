export interface Texmf extends SystemTrees, UserTrees {}

export interface SystemTrees {
  readonly TEXDIR: string;
  readonly TEXMFLOCAL: string;
  readonly TEXMFSYSCONFIG: string;
  readonly TEXMFSYSVAR: string;
}

export interface UserTrees {
  readonly TEXMFHOME: string;
  readonly TEXMFCONFIG: string;
  readonly TEXMFVAR: string;
}
