# setup-texlive-action

[![Marketplace][marketplace-badge]][marketplace]
[![CI][ci-badge]][ci]
[![Codecov][codecov-badge]][codecov]

This action provides
the functionality of installing and caching [TeX Live][texlive].

Linux, Windows, and macOS are supported.

## Usage

Installing the latest version of TeX Live:

```yaml
- name: Setup TeX Live
  uses: teatimeguest/setup-texlive-action@v1

- name: Check `tlmgr` version
  run: tlmgr --version
```

The action installs TeX Live with
`scheme-infraonly` for `2016` or later versions, and
`scheme-minimal` for the other versions.
If you want to install additional packages, you can use the `packages` input:

```yaml
- name: Setup TeX Live
  uses: teatimeguest/setup-texlive-action@v1
  with:
    packages: >-
      scheme-basic
      cleveref
      hyperref
```

A legacy version of TeX Live is also available:

```yaml
- name: Setup TeX Live 2008
  uses: teatimeguest/setup-texlive-action@v1
  with:
    version: 2008
```

Supported versions are `2008` to `2021` for Linux and Windows, and
`2013` to `2021` for macOS.

## Caching

By default, the action caches `TEXDIR` using [`@actions/cache`][actions-cache]
to improve workflow execution time.
If you want to disable caching, you can use the `cache` input:

```yaml
- name: Setup TeX Live
  uses: teatimeguest/setup-texlive-action@v1
  with:
    cache: false
```

The value of the `packages` input is hashed and becomes part of the cache key,
so it affects which cache is restored.

## Inputs

All inputs are optional.

|Name|Type|Description|
|---|---|---|
|`cache`|Bool|Enable caching for `TEXDIR`. The default is `true`.|
|`packages`|String|Whitespace-separated list of TeX packages to install. Schemes and collections can also be specified.|
|`prefix`|String|TeX Live installation prefix. The default is `C:\TEMP\setup-texlive` on Windows, `/tmp/setup-texlive` on Linux and macOS.|
|`version`|String|Version of TeX Live to install. Supported values are `2008` to `2021`, and `latest`.|

## Outputs

|Name|Type|Description|
|---|---|---|
|`cache-hit`|Bool|A boolean value to indicate if a cache was hit.|

## License

[MIT License](./LICENSE)

[marketplace]: https://github.com/marketplace/actions/setup-tex-live-action
[marketplace-badge]: https://img.shields.io/github/v/release/teatimeguest/setup-texlive-action?label=Marketplace&logo=github
[ci]: ../../actions/workflows/ci.yml
[ci-badge]: ../../actions/workflows/ci.yml/badge.svg?branch=main
[codecov]: https://codecov.io/gh/teatimeguest/setup-texlive-action
[codecov-badge]: https://codecov.io/gh/teatimeguest/setup-texlive-action/branch/main/graph/badge.svg?token=97878QAWCF
[texlive]: https://tug.org/texlive/
[actions-cache]: https://github.com/actions/toolkit/tree/main/packages/cache
