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
  uses: teatimeguest/setup-texlive-action@v1

- name: Check `tlmgr` version
  run: tlmgr --version
```

The action will install TeX Live with
`scheme-infraonly` for versions `2016` and later, and
`scheme-minimal` for other versions.
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

### Historic versions

You can also use an older version of TeX Live by specifying the `version`:

```yaml
- name: Setup TeX Live 2008
  uses: teatimeguest/setup-texlive-action@v1
  with:
    version: 2008
```

The action will install it by
downloading the installation script from the [historic archives][historic] and
configuring the package repository appropriately.
Supported versions are `2008` to `2021` for Linux and Windows, and
`2013` to `2021` for macOS.

> Versions `2008` to `2012` can be installed on `macos-latest` but
> do not work
> because the `kpsewhich` for those versions is a 32-bit executable and
> crashes with "Bad CPU type in executable."

### Caching

By default,
the action will cache `TEXDIR` using [`@actions/cache`][actions-cache]
after the workflow job is completed.
If you want to disable caching, you can use the `cache` input:

```yaml
- name: Setup TeX Live
  uses: teatimeguest/setup-texlive-action@v1
  with:
    cache: false
```

The `packages` input will affect which cache will be restored
because its hash will be used as part of the cache key.

## Inputs

All inputs are optional.

|Name|Type|Description|
|---|---|---|
|`cache`|Bool|Enable caching for `TEXDIR`. The default is `true`.|
|`package-file`|String|File containing the whitespace-separated TeX package names to be installed. Schemes and collections can also be specified. Everything after a `#` is treated as a comment.|
|`packages`|String|Whitespace-separated TeX package names to be installed. Schemes and collections can also be specified.|
|`prefix`|String|TeX Live installation prefix. The default is `$RUNNER_TEMP/setup-texlive`.|
|`tlcontrib`|Bool|Set up [TLContrib][tlcontrib] as an additional TeX package repository. This input will be ignored if an older version is specified for `version`. The default is `false`.|
|`version`|String|TeX Live version to install. Supported values are `2008` to `2021`, and `latest`.|

## Outputs

|Name|Type|Description|
|---|---|---|
|`cache-hit`|Bool|A boolean value to indicate if a cache was hit.|

## Changelog

See the [releases page][releases].

## License

[MIT License](./LICENSE)

[actions-cache]: https://github.com/actions/toolkit/tree/main/packages/cache
[ci-badge]: https://github.com/teatimeguest/setup-texlive-action/actions/workflows/ci.yml/badge.svg
[ci]: https://github.com/teatimeguest/setup-texlive-action/actions/workflows/ci.yml
[codecov-badge]: https://codecov.io/gh/teatimeguest/setup-texlive-action/branch/main/graph/badge.svg?token=97878QAWCF
[codecov]: https://codecov.io/gh/teatimeguest/setup-texlive-action
[historic]: https://tug.org/historic/
[marketplace-badge]: https://img.shields.io/github/v/release/teatimeguest/setup-texlive-action?label=Marketplace&logo=github
[marketplace]: https://github.com/marketplace/actions/setup-texlive-action
[releases]: https://github.com/teatimeguest/setup-texlive-action/releases
[texlive]: https://tug.org/texlive/
[tlcontrib]: https://contrib.texlive.info
