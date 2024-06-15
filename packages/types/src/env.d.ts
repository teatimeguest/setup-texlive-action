/* eslint-disable */

namespace NodeJS {
  interface ProcessEnv {
    /**
     * @see {@link https://no-color.org/}
     */
    NO_COLOR?: string;

    /**
     * @see {@link https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables}
     */
    GITHUB_ACTIONS?: string;
    GITHUB_ACTION_PATH?: string;
    GITHUB_WORKSPACE?: string;
    RUNNER_DEBUG?: string;
    RUNNER_TEMP?: string;

    /**
     * @see {@link https://tug.org/texlive/doc/install-tl.html#ENVIRONMENT-VARIABLES}
     */
    TEXLIVE_DOWNLOADER?: string;
    TL_DOWNLOAD_PROGRAM?: string;
    TL_DOWNLOAD_ARGS?: string;
    TEXLIVE_INSTALL_ENV_NOCHECK?: string;
    TEXLIVE_INSTALL_NO_CONTEXT_CACHE?: string;
    TEXLIVE_INSTALL_NO_DISKCHECK?: string;
    TEXLIVE_INSTALL_NO_RESUME?: string;
    TEXLIVE_INSTALL_NO_WELCOME?: string;
    TEXLIVE_INSTALL_PAPER?: string;
    TEXLIVE_INSTALL_PREFIX?: string;
    TEXLIVE_INSTALL_TEXDIR?: string;
    TEXLIVE_INSTALL_TEXMFLOCAL?: string;
    TEXLIVE_INSTALL_TEXMFSYSCONFIG?: string;
    TEXLIVE_INSTALL_TEXMFSYSVAR?: string;
    TEXLIVE_INSTALL_TEXMFHOME?: string;
    TEXLIVE_INSTALL_TEXMFCONFIG?: string;
    TEXLIVE_INSTALL_TEXMFVAR?: string;
    NOPERLDOC?: string;
  }
}
