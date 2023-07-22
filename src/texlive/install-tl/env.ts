export const ENV_VARS = [
  'TEXLIVE_DOWNLOADER',
  'TL_DOWNLOAD_PROGRAM',
  'TL_DOWNLOAD_ARGS',
  'TEXLIVE_INSTALL_ENV_NOCHECK',
  'TEXLIVE_INSTALL_NO_CONTEXT_CACHE',
  'TEXLIVE_INSTALL_NO_DISKCHECK',
  'TEXLIVE_INSTALL_NO_RESUME',
  'TEXLIVE_INSTALL_NO_WELCOME',
  'TEXLIVE_INSTALL_PAPER',
  'TEXLIVE_INSTALL_PREFIX',
  'TEXLIVE_INSTALL_TEXDIR',
  'TEXLIVE_INSTALL_TEXMFLOCAL',
  'TEXLIVE_INSTALL_TEXMFSYSCONFIG',
  'TEXLIVE_INSTALL_TEXMFSYSVAR',
  'TEXLIVE_INSTALL_TEXMFHOME',
  'TEXLIVE_INSTALL_TEXMFCONFIG',
  'TEXLIVE_INSTALL_TEXMFVAR',
  'NOPERLDOC',
] as const;

export type Env = {
  [Key in typeof ENV_VARS[number]]?: string;
};

declare global {
  namespace NodeJS {
    interface ProcessEnv extends Env {}
  }
}
