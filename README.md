<!--
  Zero-width spaces (`#x200B;`) are used for word breaks
  or for workarounds against `dprint`.
-->

# setup-texlive-action

> A GitHub Action to set up TeX Live

[![Marketplace][marketplace-badge]][marketplace]
[![CI][ci-badge]][ci]
[![Codecov][codecov-badge]][codecov]

This action provides the following functionality:

- Installing and setting up a specific version of [TeX Live][texlive];
- Caching and restoring [`TEXDIR`][texdir] by default
  to improve workflow execution time;
- Optionally configuring an additional package repository
  and installing TeX packages.

Linux, Windows, and macOS are supported.

## Breaking Changes in V3

- Use Node.js v20 as runtime.

  With Node.js v16 having reached its [end-of-life][node16-eol] and
  GitHub Actions beginning the [transition to Node.js v20][actions-node20],
  the action has upgraded its default runtime to Node.js v20.

- Change the default installation prefix to `$RUNNER_TEMP/setup-texlive-action`.
- Change the environment variable for updating cache to
  `SETUP_TEXLIVE_ACTION_FORCE_UPDATE_CACHE`.

  Actions published on [GitHub Marketplace][github-marketplace] have
  unique names defined in the metadata file `action.yml`.
  To minimize conflicts with other actions,
  the action name (`setup-texlive-action`) is now used for the following things:

  - Directory name of the default installation prefix:

    ```diff
    - $RUNNER_TEMP/setup-texlive
    + $RUNNER_TEMP/setup-texlive-action
    ```

  - Environment variable name:

    ```diff
    - SETUP_TEXLIVE_FORCE_UPDATE_CACHE
    + SETUP_TEXLIVE_ACTION_FORCE_UPDATE_CACHE
    ```

  - Cache keys.

## Table of Contents

- [Usage](#usage)
  - [Basic Usage](#basic-usage)
  - [Historic Versions](#historic-versions)
  - [Caching](#caching)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Environment Variables](#environment-variables)
- [Permissions](#permissions)
- [Changelog](#changelog)
- [License](#license)

## Usage

### Basic Usage

```yaml
- name: Setup TeX Live
  uses: teatimeguest/setup-texlive-action@v3
  with:
    packages: scheme-basic

- name: Check `tlmgr` version
  run: tlmgr --version
```

By default,
the action will only set up `tlmgr` and will not install any packages.
If you want to install additional packages, you can use `packages` input:

```yaml
- name: Setup TeX Live
  uses: teatimeguest/setup-texlive-action@v3
  with:
    packages: >-
      scheme-basic
      cleveref
      hyperref
```

If you don't know exactly all the packages you need,
it is recommended to install `scheme-basic`,
which contains fundamental packages such as `latex` and `amsmath`.

You can also specify packages by file using [`package-file`](#inputs) input.

### Historic Versions

You can use an older version of TeX Live by setting `version`:

```yaml
- name: Setup TeX Live 2008
  uses: teatimeguest/setup-texlive-action@v3
  with:
    version: 2008
```

The action will install it by using [historic archive][historic].
Supported versions are `2008` to `2023` for Linux and Windows,
and `2013` to `2023` for macOS.

> [!NOTE]\
> Versions `2008`–`2012` do not work on `macos-latest`
> because the `kpsewhich` for those versions is a 32-bit executable
> and crashes with _<q>Bad CPU type in executable.</q>_

### Caching

By default, the action will save `TEXDIR` to cache
using [`@actions/cache`][actions-cache] after the workflow job completes.
If you want to disable caching, you can use `cache` input:

```yaml
- name: Setup TeX Live
  uses: teatimeguest/setup-texlive-action@v3
  with:
    cache: false
```

The `packages` input will affect which cache will be restored
because its hash will be used as part of the cache key.

> [!NOTE]\
> If you have problems due to a corrupt cache entry,
> you can delete it from the [web interface][deleting-cache-entries],
> [GitHub CLI][gh-actions-cache], or [REST API][cache-api].

## Inputs

All inputs are optional.

| Name                  | Type   | Description                                                                                                                                                                                          |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cache`               | Bool   | <p>Enable caching for [`TEXDIR`][texdir].</p> **Default:**&ensp;`true`                                                                                                                               |
| `package-file`        | String | File containing the names of TeX packages to be installed, delimited by whitespaces. Everything after a `#` is treated as a comment. The [`DEPENDS.txt`][depends-txt] format is also supported.      |
| `packages`            | String | Whitespace-delimited TeX package names to be installed. Schemes and collections are also acceptable.                                                                                                 |
| `prefix`              | String | <p>TeX Live installation prefix. This has the same effect as [`TEXLIVE_INSTALL_PREFIX`][install-tl-env].</p> **Default:**&ensp;<code>&#x200B;[$RUNNER_TEMP][actions-env]/setup-texlive-action</code> |
| `texdir`              | String | TeX Live system directory. This has the same effect as the installer's [`-texdir`][install-tl-texdir] option and takes precedence over the `prefix` input and related environment variables.         |
| `tlcontrib`           | Bool   | <p>Set up [TLContrib][tlcontrib] as an additional TeX package repository. This input will be ignored for older versions.</p> **Default:**&ensp;`false`                                               |
| `update-all-packages` | Bool   | <p>Update all TeX packages when cache restored. Defaults to `false`, and the action will update only `tlmgr`.</p> **Default:**&ensp;`false`                                                          |
| `version`             | String | <p>TeX Live version to install. Supported values are `2008` to `2023`, and `latest`.</p> **Default:**&ensp;`latest`                                                                                  |

## Outputs

| Name        | Type   | Description                                     |
| ----------- | ------ | ----------------------------------------------- |
| `cache-hit` | Bool   | A boolean value to indicate if a cache was hit. |
| `version`   | String | The installed TeX Live version.                 |

## Environment Variables

The action reads the following environment variable:

<table>
  <tr>
    <th>Name</th>
    <th>Type</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>
      <code>SETUP_TEXLIVE_ACTION_&#x200B;FORCE_UPDATE_CACHE</code>
    </td>
    <td>String</td>
    <td>
      <div>

Setting this to anything other than `0`, the action will use
[a unique cache key each time][update-cache] to keep the cache up-to-date.

> [!WARNING]\
> Enabling this will consume more [cache space][cache-limits].

</div>
      <strong>Default:&ensp;</strong><var>unset</var>
    </td>
  </tr>
</table>

In addition,
the following [official environment variables][install-tl-env] are supported:

| Name                               | Default                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| `TEXLIVE_DOWNLOADER`               |                                                                       |
| `TL_DOWNLOAD_PROGRAM`              |                                                                       |
| `TL_DOWNLOAD_ARGS`                 |                                                                       |
| `TEXLIVE_INSTALL_ENV_NOCHECK`      | `1`                                                                   |
| `TEXLIVE_INSTALL_NO_CONTEXT_CACHE` |                                                                       |
| `TEXLIVE_INSTALL_NO_DISKCHECK`     |                                                                       |
| `TEXLIVE_INSTALL_NO_RESUME`        |                                                                       |
| `TEXLIVE_INSTALL_NO_WELCOME`       | `1`                                                                   |
| `TEXLIVE_INSTALL_PAPER`            |                                                                       |
| `TEXLIVE_INSTALL_PREFIX`           | <code>&#x200B;[$RUNNER_TEMP][actions-env]/setup-texlive-action</code> |
| `TEXLIVE_INSTALL_TEXMFLOCAL`       |                                                                       |
| `TEXLIVE_INSTALL_TEXMFHOME`        | `~/texmf`                                                             |
| `TEXLIVE_INSTALL_TEXMFCONFIG`      | `~/.local/texlive/<version>/texmf-config`                             |
| `TEXLIVE_INSTALL_TEXMFVAR`         | `~/.local/texlive/<version>/texmf-var`                                |
| `NOPERLDOC`                        |                                                                       |

If `prefix` and `TEXLIVE_INSTALL_PREFIX` are both set, `prefix` will be used.

## Permissions

This action does not use `GITHUB_TOKEN` and does not require any permissions.

## Changelog

See the [releases page][releases].

## License

[MIT License](./LICENSE)

[actions-cache]: https://github.com/actions/toolkit/tree/main/packages/cache
[actions-env]: https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
[actions-node20]: https://github.blog/changelog/2023-09-22-github-actions-transitioning-from-node-16-to-node-20/
[cache-api]: https://docs.github.com/en/rest/actions/cache?apiVersion=2022-11-28#delete-github-actions-caches-for-a-repository-using-a-cache-key
[cache-limits]: https://github.com/actions/cache#cache-limits
[ci-badge]: https://github.com/teatimeguest/setup-texlive-action/actions/workflows/ci.yml/badge.svg
[ci]: https://github.com/teatimeguest/setup-texlive-action/actions/workflows/ci.yml
[codecov-badge]: https://codecov.io/gh/teatimeguest/setup-texlive-action/branch/main/graph/badge.svg?token=97878QAWCF
[codecov]: https://codecov.io/gh/teatimeguest/setup-texlive-action
[deleting-cache-entries]: https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#deleting-cache-entries
[depends-txt]: https://tug.org/texlive/pkgcontrib.html#deps
[gh-actions-cache]: https://github.com/actions/gh-actions-cache
[github-marketplace]: https://github.com/marketplace?type=actions
[historic]: https://tug.org/historic/
[install-tl-env]: https://tug.org/texlive/doc/install-tl.html#ENVIRONMENT-VARIABLES
[install-tl-texdir]: https://tug.org/texlive/doc/install-tl.html#texdir-dir
[marketplace-badge]: https://img.shields.io/github/v/release/teatimeguest/setup-texlive-action?label=Marketplace&logo=github
[marketplace]: https://github.com/marketplace/actions/setup-texlive-action
[node16-eol]: https://nodejs.org/en/blog/announcements/nodejs16-eol
[releases]: https://github.com/teatimeguest/setup-texlive-action/releases
[texdir]: https://tug.org/texlive/doc/texlive-en/texlive-en.html#x1-250003.2.3
[texlive]: https://tug.org/texlive/
[tlcontrib]: https://contrib.texlive.info
[update-cache]: https://github.com/actions/cache/blob/main/tips-and-workarounds.md#update-a-cache
