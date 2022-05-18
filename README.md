# setup-texlive-action

> A GitHub Action to set up TeX Live

[![Marketplace][marketplace-badge]][marketplace]
[![CI][ci-badge]][ci]
[![Codecov][codecov-badge]][codecov]

This action provides the following functionality:

* Installing and setting up a specific version of [TeX Live][texlive];
* Optionally caching and restoring `TEXDIR` to improve workflow execution time;
* Optionally configuring a package repository and installing additional TeX packages.

Linux, Windows, and macOS are supported.

## Usage

### Basic usage

```yaml
- name: Setup TeX Live
  uses: teatimeguest/setup-texlive-action@v2

- name: Check `tlmgr` version
  run: tlmgr --version
```

The action will install TeX Live with
`scheme-infraonly` for versions `2016` and later, and
`scheme-minimal` for other versions.
If you want to install additional packages, you can use the `packages` input:

```yaml
- name: Setup TeX Live
  uses: teatimeguest/setup-texlive-action@v2
  with:
    packages: >-
      scheme-basic
      cleveref
      hyperref
```

You can also specify packages by file using [`package-file`][inputs] input.

### Historic versions

You can use an older version of TeX Live by specifying the `version`:

```yaml
- name: Setup TeX Live 2008
  uses: teatimeguest/setup-texlive-action@v2
  with:
    version: 2008
```

The action will install it by
downloading the installation script from the [historic archives][historic] and
configuring the package repository appropriately.

Supported versions are `2008` to `2022` for Linux and Windows, and
`2013` to `2022` for macOS.

> **Remark.**
> Versions `2008` to `2012` can be installed on `macos-latest` but
> do not work
> because the `kpsewhich` for those versions is a 32-bit executable and
> crashes with "Bad CPU type in executable."

### Caching

By default,
the action will save `TEXDIR` to cache using [`@actions/cache`][actions-cache]
after the workflow job completes.
If you want to disable caching, you can use the `cache` input:

```yaml
- name: Setup TeX Live
  uses: teatimeguest/setup-texlive-action@v2
  with:
    cache: false
```

The `packages` input will affect which cache will be restored
because its hash will be used as part of the cache key.

## Inputs

All inputs are optional.

|Name|Type|Description|
|---|---|---|
|`cache`|Bool|Enable caching for [`TEXDIR`][texdir]. The default is `true`.|
|`package-file`|String|File containing TeX package names to be installed. The file format is whitespace-delimited, and everything after a `#` is treated as a comment[^1]. [`DEPENDS.txt`][depends-txt] format is also acceptable.|
|`packages`|String|Whitespace-delimited TeX package names to be installed. Schemes and collections can also be specified.|
|`prefix`|String|TeX Live installation prefix. This has the same effect as [`TEXLIVE_INSTALL_PREFIX`][install-tl-environment-variables]. The default is <code>[$RUNNER_TEMP][actions-environment-variables]/setup-texlive</code>.|
|`tlcontrib`|Bool|Set up [TLContrib][tlcontrib] as an additional TeX package repository. This input will be ignored if an older version is specified for `version`. The default is `false`.|
|`version`|String|TeX Live version to install. Supported values are `2008` to `2022`, and `latest`.|

## Outputs

|Name|Type|Description|
|---|---|---|
|`cache-hit`|Bool|A boolean value to indicate if a cache was hit.|

## Environment variables

The following [official environment variables][install-tl-environment-variables]
are supported:

|Name|Default|
|---|---|
|`TEXLIVE_DOWNLOADER`||
|`TL_DOWNLOAD_PROGRAM`||
|`TL_DOWNLOAD_ARGS`||
|`TEXLIVE_INSTALL_ENV_NOCHECK`|`1`|
|`TEXLIVE_INSTALL_NO_CONTEXT_CACHE`||
|`TEXLIVE_INSTALL_NO_DISKCHECK`||
|`TEXLIVE_INSTALL_NO_RESUME`||
|`TEXLIVE_INSTALL_NO_WELCOME`|`1`|
|`TEXLIVE_INSTALL_PAPER`||
|`TEXLIVE_INSTALL_PREFIX`|<code>[$RUNNER_TEMP][actions-environment-variables]/setup-texlive</code>|
|`TEXLIVE_INSTALL_TEXMFHOME`|`~/texmf`|
|`TEXLIVE_INSTALL_TEXMFCONFIG`|`~/.local/texlive/<version>/texmf-config`|
|`TEXLIVE_INSTALL_TEXMFVAR`|`~/.local/texlive/<version>/texmf-var`|
|`NOPERLDOC`||

If `prefix` and `TEXLIVE_INSTALL_PREFIX` are both specified,
`prefix` will be used.

## Changelog

See the [releases page][releases].

## License

[MIT License](./LICENSE)

[^1]: Such a file is used in the [official LaTeX3 repository][latex3]
  with [`zauguin/install-texlive`][install-texlive] action
  (see [`.github/tl_packages`][tl_packages]).

[actions-cache]: https://github.com/actions/toolkit/tree/main/packages/cache
[actions-environment-variables]: https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
[ci-badge]: https://github.com/teatimeguest/setup-texlive-action/actions/workflows/ci.yml/badge.svg
[ci]: https://github.com/teatimeguest/setup-texlive-action/actions/workflows/ci.yml
[codecov-badge]: https://codecov.io/gh/teatimeguest/setup-texlive-action/branch/main/graph/badge.svg?token=97878QAWCF
[codecov]: https://codecov.io/gh/teatimeguest/setup-texlive-action
[depends-txt]: https://tug.org/texlive/pkgcontrib.html#deps
[historic]: https://tug.org/historic/
[inputs]: https://github.com/teatimeguest/setup-texlive-action#inputs
[install-texlive]: https://github.com/zauguin/install-texlive
[install-tl-environment-variables]: https://tug.org/texlive/doc/install-tl.html#ENVIRONMENT-VARIABLES
[latex3]: https://github.com/latex3/latex3
[marketplace-badge]: https://img.shields.io/github/v/release/teatimeguest/setup-texlive-action?label=Marketplace&logo=github
[marketplace]: https://github.com/marketplace/actions/setup-texlive-action
[releases]: https://github.com/teatimeguest/setup-texlive-action/releases
[texdir]: https://tug.org/texlive/doc/texlive-en/texlive-en.html#x1-250003.2.3
[texlive]: https://tug.org/texlive/
[tl_packages]: https://github.com/latex3/latex3/blob/0f7a169811f327119c703eaa0231fd0e6123f267/.github/tl_packages
[tlcontrib]: https://contrib.texlive.info
