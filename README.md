> TeX Live 2024 is scheduled for release on March 13.
> The action may not work properly for a few days after the release.
> If you have any problems, please feel free to open an issue.

# setup-texlive-action

> A GitHub Action to set up TeX Live

[![Marketplace][marketplace-badge]](https://github.com/marketplace/actions/setup-texlive-action)
[![CI][ci-badge]](https://github.com/teatimeguest/setup-texlive-action/actions/workflows/ci.yml)
[![Codecov][codecov-badge]](https://codecov.io/gh/teatimeguest/setup-texlive-action)

[ci-badge]: https://github.com/teatimeguest/setup-texlive-action/actions/workflows/ci.yml/badge.svg
[marketplace-badge]: https://img.shields.io/github/v/release/teatimeguest/setup-texlive-action?logo=github&logoColor=959da5&label=Marketplace&labelColor=2e353b
[codecov-badge]: https://codecov.io/gh/teatimeguest/setup-texlive-action/branch/main/graph/badge.svg?token=97878QAWCF

This action provides the following functionality:

- Installing and setting up
  a specific version of [TeX Live](https://tug.org/texlive/);
- Caching and restoring [`TEXDIR`] by default
  to improve workflow execution time;
- Optionally configuring an additional package repository
  and installing TeX packages.

Linux, Windows, and macOS are supported.

## Breaking Changes in V3

<details>
  <summary>
    Use Node.js v20 as runtime.
  </summary>
  <p>

With Node.js v16 having reached
its [end-of-life](https://nodejs.org/en/blog/announcements/nodejs16-eol) and
GitHub Actions beginning the [transition to Node.js v20](https://github.blog/changelog/2023-09-22-github-actions-transitioning-from-node-16-to-node-20/),
the action has upgraded its default runtime to Node.js v20.

If you are using a self-hosted runner, update it to
[v2.308.0](https://github.com/actions/runner/releases/tag/v2.308.0) or later
to ensure `node20` runtime functionality.

---

</p>
</details>
<details>
  <summary>
    Change the condition under which
    <code>cache-hit</code> is set to <code>true</code>.
  </summary>
  <p>

To be more consistent with official actions such as
[`actions/cache`](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#cache-hits-and-misses),
the `cache-hit` output is now set to `true` only if
a cache is found that exactly matches the specified version and package set.
To simply check if a cache was found, use `cache-restored` instead:

```yaml
- uses: teatimeguest/setup-texlive-action@v3
  id: setup

- if: fromJSON(steps.setup.outputs.cache-restored)
  run: echo 'A cache has been found'
```

---

</p>
</details>
<details>
  <summary>
    Change the default installation prefix,
    environment variable name, and
    cache key prefix.
  </summary>
  <p>

Actions published on [GitHub Marketplace](https://github.com/marketplace?type=actions)
have unique names defined in the metadata file `action.yml`.
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

---

</p>
</details>
<details>
  <summary>
    Change the default texmf user directories.
  </summary>
  <p>

As with the [portable installation](https://tug.org/texlive/doc/texlive-en/texlive-en.html#tlportable)
of the official installer, `TEXMFHOME`, `TEXMFCONFIG`, and `TEXMFVAR`
are now set by default to be the same as
`TEXMFLOCAL`, `TEXMFSYSCONFIG`, and `TEXMFSYSVAR`, respectively.
To emulate the previous behavior,
use environment variables to explicitly specify the user directories:

```yaml
- uses: teatimeguest/setup-texlive-action@v3
  env:
    TEXLIVE_INSTALL_TEXMFHOME: >-
      ~/texmf
    TEXLIVE_INSTALL_TEXMFCONFIG: >-
      ~/.local/texlive/<version>/texmf-config
    TEXLIVE_INSTALL_TEXMFVAR: >-
      ~/.local/texlive/<version>/texmf-var
```

---

</p>
</details>
<details>
  <summary>
    The <code>package-file</code> input now accepts
    <a href="https://github.com/actions/toolkit/tree/main/packages/glob#patterns">
      glob patterns
    </a>
    for specifying multiple files.
  </summary>
  <p>

Since special characters such as `*` and `?` will need to be escaped,
this might break existing workflow behavior.

---

</p>
</details>

## Table of Contents

- [Usage](#usage)
  - [Basic Usage](#basic-usage)
  - [Caching](#caching)
  - [Historic Versions](#historic-versions)
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
the action will only set up `tlmgr` and _**will not install any packages**_.
If you want to install some packages, you can use the `packages` input:

```yaml
- uses: teatimeguest/setup-texlive-action@v3
  with:
    packages: >-
      scheme-basic
      cleveref
      hyperref
```

> [!NOTE]\
> If you are not sure which packages you need,
> it is recommended to install `scheme-basic`,
> which contains fundamental packages such as `latex` and `amsmath`.

You can also specify packages by file using the [`package-file`](#inputs) input:

```yaml
- uses: actins/checkout@v4
- uses: teatimeguest/setup-texlive-action@v3
  with:
    package-file: |
      .github/tl_packages
      **/DEPENDS.txt
```

### Caching

By default, the action will save `TEXDIR` to cache using
[`@actions/cache`](https://github.com/actions/toolkit/tree/main/packages/cache)
after the workflow job completes.
If you want to disable caching, set the `cache` input to `false`:

```yaml
- uses: teatimeguest/setup-texlive-action@v3
  with:
    cache: false
```

> [!NOTE]\
> If you have problems due to a corrupt cache entry, you can delete it from the
> [web interface](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#deleting-cache-entries),
> [GitHub CLI](https://github.com/actions/gh-actions-cache), or
> [REST API](https://docs.github.com/en/rest/actions/cache?apiVersion=2022-11-28#delete-github-actions-caches-for-a-repository-using-a-cache-key).

### Historic Versions

You can use an older version of TeX Live by setting the `version` input:

```yaml
- uses: teatimeguest/setup-texlive-action@v3
  with:
    version: 2008
```

The action uses [historic archive](https://tug.org/historic/)
to install older versions.
Supported TeX Live versions are as follows:

<table>
  <thead>
    <tr>
      <th>OS</th>
      <th>Runner</th>
      <th>Supported Versions</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="2">Linux</th>
      <td><code>ubuntu-22.04</code> (<code>ubuntu-latest</code>)</td>
      <td rowspan="4"><code>2008</code>&ndash;<code>2023</code></td>
    </tr>
    <tr><td><code>ubuntu-20.04</code></td></tr>
    <tr>
      <th rowspan="2">Windows</th>
      <td><code>windows-2022</code> (<code>windows-latest</code>)</td>
    </tr>
    <tr><td><code>windows-2019</code></td></tr>
    <tr>
      <th rowspan="4">macOS</th>
      <td><code>macos-14</code></td>
      <td rowspan="4">

`2013`&ndash;`2023`

> Versions `2008`–`2012` do not work
> because the `kpsewhich` for those versions is a 32-bit executable
> and crashes with _<q>Bad CPU type in executable.</q>_

</td>
    </tr>
    <tr><td><code>macos-13</code></td></tr>
    <tr><td><code>macos-12</code> (<code>macos-latest</code>)</td></tr>
    <tr><td><code>macos-11</code></td></tr>
  </tbody>
</table>

## Inputs

All inputs are optional.

| Name                  | Type   | Description                                                                                                                                                                                                                           |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cache`               | Bool   | <p>Enable caching for [`TEXDIR`].</p> **Default:**&ensp;`true`                                                                                                                                                                        |
| `package-file`        | String | [Glob patterns] for specifying files containing the names of TeX packages to be installed. The file format should be the same as the syntax for the `packages` input. The [`DEPENDS.txt`] format is also supported.                   |
| `packages`            | String | Specify the names of TeX packages to install, separated by whitespaces. Schemes and collections are also acceptable. Everything after `#` will be treated as a comment.                                                               |
| `prefix`              | String | <p>TeX Live installation prefix. This has the same effect as [`TEXLIVE_INSTALL_PREFIX`][install-tl-env].</p> **Default:**&ensp;<!-- dprint-ignore-start --><code>[$RUNNER_TEMP]/setup-texlive-action</code><!-- dprint-ignore-end --> |
| `texdir`              | String | TeX Live system installation directory. This has the same effect as the installer's [`-texdir`] option and takes precedence over the `prefix` input and related environment variables.                                                |
| `tlcontrib`           | Bool   | <p>Set up [TLContrib] as an additional TeX package repository. This input will be ignored for older versions.</p> **Default:**&ensp;`false`                                                                                           |
| `update-all-packages` | Bool   | <p>Update all TeX packages when cache restored. Defaults to `false`, and the action will update only `tlmgr`.</p> **Default:**&ensp;`false`                                                                                           |
| `version`             | String | <p>TeX Live version to install. Supported values are `2008` to `2023`, and `latest`.</p> **Default:**&ensp;`latest`                                                                                                                   |

[Glob patterns]: https://github.com/actions/toolkit/tree/main/packages/glob#patterns
[TLContrib]: https://contrib.texlive.info
[`-texdir`]: https://tug.org/texlive/doc/install-tl.html#texdir-dir
[`DEPENDS.txt`]: https://tug.org/texlive/pkgcontrib.html#deps

## Outputs

| Name             | Type   | Description                                                    |
| ---------------- | ------ | -------------------------------------------------------------- |
| `cache-hit`      | Bool   | A boolean value to indicate if an exact cache match was found. |
| `cache-restored` | Bool   | A boolean value to indicate if a cache was found.              |
| `version`        | String | The installed TeX Live version.                                |

## Environment Variables

The action reads the following environment variable:

| Name                                                         | Type   | Description                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <code>SETUP_TEXLIVE_ACTION_&#x200B;FORCE_UPDATE_CACHE</code> | String | <p>Setting this to anything other than `0`, the action will use [a unique cache key each time][update-a-cache] to keep the cache up-to-date.</p><div><blockquote>:warning: **Warning**<br>Enabling this will consume more [cache space][cache-limits].</blockquote></div> **Default:**&ensp;<var>unset</var> |
| [`NO_COLOR`](https://no-color.org/)                          | String | Disable color output.                                                                                                                                                                                                                                                                                        |

[cache-limits]: https://github.com/actions/cache#cache-limits
[update-a-cache]: https://github.com/actions/cache/blob/main/tips-and-workarounds.md#update-a-cache

In addition,
the following [official environment variables][install-tl-env] are supported:

| Name                               | Default                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `TEXLIVE_DOWNLOADER`               |                                                                                                        |
| `TL_DOWNLOAD_PROGRAM`              |                                                                                                        |
| `TL_DOWNLOAD_ARGS`                 |                                                                                                        |
| `TEXLIVE_INSTALL_ENV_NOCHECK`      | `1`                                                                                                    |
| `TEXLIVE_INSTALL_NO_CONTEXT_CACHE` |                                                                                                        |
| `TEXLIVE_INSTALL_NO_DISKCHECK`     |                                                                                                        |
| `TEXLIVE_INSTALL_NO_RESUME`        |                                                                                                        |
| `TEXLIVE_INSTALL_NO_WELCOME`       | `1`                                                                                                    |
| `TEXLIVE_INSTALL_PAPER`            |                                                                                                        |
| `TEXLIVE_INSTALL_PREFIX`           | <!-- dprint-ignore-start --><code>[$RUNNER_TEMP]/setup-texlive-action</code><!-- dprint-ignore-end --> |
| `TEXLIVE_INSTALL_TEXMFLOCAL`       |                                                                                                        |
| `TEXLIVE_INSTALL_TEXMFHOME`        | Same as `TEXMFLOCAL`                                                                                   |
| `TEXLIVE_INSTALL_TEXMFCONFIG`      | Same as `TEXMFSYSCONFIG`                                                                               |
| `TEXLIVE_INSTALL_TEXMFVAR`         | Same as `TEXMFSYSVAR`                                                                                  |
| `NOPERLDOC`                        |                                                                                                        |

If `prefix` and `TEXLIVE_INSTALL_PREFIX` are both set, `prefix` will be used.

## Permissions

This action does not use `GITHUB_TOKEN` and does not require any permissions.

## Changelog

See the [releases page](https://github.com/teatimeguest/setup-texlive-action/releases).

## License

[MIT License](./LICENSE)

For third-party software licenses and copyright notices,
please refer to [`dist/NOTICE.md`](./dist/NOTICE.md).

[$RUNNER_TEMP]: https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
[`TEXDIR`]: https://tug.org/texlive/doc/texlive-en/texlive-en.html#x1-250003.2.3
[install-tl-env]: https://tug.org/texlive/doc/install-tl.html#ENVIRONMENT-VARIABLES
