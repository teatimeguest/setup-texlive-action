# setup-texlive-action

> A GitHub Action to set up TeX Live

[![Marketplace][marketplace-badge]][marketplace]
[![CI][ci-badge]][ci]
[![Codecov][codecov-badge]][codecov]

This action provides the following functionality:

- Installing and setting up a specific version of [TeX Live];
- Caching and restoring [`TEXDIR`] by default
  to improve workflow execution time;
- Optionally configuring an additional package repository
  and installing TeX packages.

Linux, Windows, and macOS are supported.

[TeX Live]: https://tug.org/texlive/
[`TEXDIR`]: https://tug.org/texlive/doc/texlive-en/texlive-en.html#x1-250003.2.3 "3.2.3 Directories"
[ci-badge]: https://github.com/teatimeguest/setup-texlive-action/actions/workflows/ci.yml/badge.svg
[ci]: https://github.com/teatimeguest/setup-texlive-action/actions/workflows/ci.yml
[codecov-badge]: https://codecov.io/gh/teatimeguest/setup-texlive-action/branch/main/graph/badge.svg?token=97878QAWCF
[codecov]: https://codecov.io/gh/teatimeguest/setup-texlive-action
[marketplace-badge]: https://img.shields.io/github/v/release/teatimeguest/setup-texlive-action?logo=githubactions&label=Marketplace&labelColor=2e353b&color=2088ff
[marketplace]: https://github.com/marketplace/actions/setup-texlive-action

## Breaking Changes in V3

> In most cases, you can upgrade from v2 to v3 without changing your workflow.

<details>
  <summary>Use Node.js v20 as runtime.</summary>
  <p />
  <table>
    <tr></tr><tr><th rowspan="2"></th></tr>
    <tr>
      <td>
        <p>

With Node.js v16 having reached its [end-of-life][nodejs16-eol] and
GitHub Actions beginning the [transition to Node.js v20],
the action has upgraded its default runtime to Node.js v20.

If you are using a self-hosted runner, please update it to
[v2.308.0] or later to ensure `node20` runtime functionality.

[nodejs16-eol]: https://nodejs.org/en/blog/announcements/nodejs16-eol
[transition to Node.js v20]: https://github.blog/changelog/2023-09-22-github-actions-transitioning-from-node-16-to-node-20/
[v2.308.0]: https://github.com/actions/runner/releases/tag/v2.308.0

</p>
      </td>
    </tr>
  </table>
</details>
<details>
  <summary>
    Change the condition under which
    <code>cache-hit</code> is set to <code>true</code>.
  </summary>
  <p />
  <table>
    <tr></tr><tr><td rowspan="2"></td></tr>
    <tr>
      <td>
        <p>

To be more consistent with official actions such as [actions/cache],
the `cache-hit` output is now set to `true` only if
a cache is found that exactly matches the specified version and package set.
To simply check if a cache was found, use `cache-restored` instead:

```yaml
- uses: teatimeguest/setup-texlive-action@v3
  id: setup

- if: fromJSON(steps.setup.outputs.cache-restored)
  run: echo 'A cache has been found'
```

[actions/cache]: https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#cache-hits-and-misses

</p>
      </td>
    </tr>
  </table>
</details>
<details>
  <summary>
    Change default installation prefix,
    environment variable name, and cache key prefix.
  </summary>
  <p />
  <table>
    <tr></tr><tr><th rowspan="2"></th></tr>
    <tr>
      <td>
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

</p>
      </td>
    </tr>
  </table>
</details>
<details>
  <summary>Change default texmf user directories.</summary>
  <p />
  <table>
    <tr></tr><tr><th rowspan="2"></th></tr>
    <tr>
      <td>
        <p>

As with `install-tl`'s [portable installation], user directories are
now set by default to be the same as the corresponding system directories.
To emulate the previous behavior,
specify the user directories explicitly using environment variables:

```yaml
- uses: teatimeguest/setup-texlive-action@v3
  env:
    TEXLIVE_INSTALL_TEXMFHOME: ~/texmf
    TEXLIVE_INSTALL_TEXMFCONFIG: ~/.local/texlive/<version>/texmf-config
    TEXLIVE_INSTALL_TEXMFVAR: ~/.local/texlive/<version>/texmf-var
```

[portable installation]: https://tug.org/texlive/doc/texlive-en/texlive-en.html#tlportable "4.2 Portable (USB) installation"

</p>
      </td>
    </tr>
  </table>
</details>
<details>
  <summary>
    Change syntax for the <code>package-file</code> input.
  </summary>
  <p />
  <table>
    <tr></tr><tr><th rowspan="2"></th></tr>
    <tr>
      <td>
        <p>

The `package-file` input now accepts
[glob patterns][glob] to specify multiple files:

```yaml
- uses: actions/checkout@v4
- uses: teatimeguest/setup-texlive-action@v3
  with:
    package-file: |
      .github/tl_packages
      **/DEPENDS.txt
```

This change might break existing workflow behavior
since special characters such as `*` and `?` will need to be escaped.

[glob]: https://github.com/actions/toolkit/tree/main/packages/glob#patterns

</p>
      </td>
    </tr>
  </table>
</details>

## Table of Contents

<!-- "⎿" U+23BF DENTISTRY SYMBOL LIGHT VERTICAL AND BOTTOM RIGHT -->
<!-- "・" U+30FB KATAKANA MIDDLE DOT -->

- [Usage](#usage)
  - [Basic Usage](#basic-usage)
  - [Caching](#caching)
  - [Historic Versions](#historic-versions)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Environment Variables](#environment-variables)
- [Permissions](#permissions)
- [Troubleshooting](#troubleshooting)
- [Changelog](#changelog)
- [License](#license)

## Usage

### Basic Usage

```yaml
- name: Setup TeX Live
  uses: teatimeguest/setup-texlive-action@v3
  with:
    packages: scheme-basic
```

To make it suitable for CI use, by default, the action will only set up
[`tlmgr`](https://www.tug.org/texlive/tlmgr.html) (TeX Live package manager) and
**will not install any TeX packages, even basic commands such as `pdflatex`.**
If you want to install some TeX packages, you can use the `packages` input:

```yaml
- uses: teatimeguest/setup-texlive-action@v3
  with:
    packages: |
      scheme-basic
      hyperref
      microtype

  # `pdflatex` is now available
  # along with hyperlink and microtypography support.
```

> [!NOTE]\
> Since `tlmgr` does not manage package dependencies,
> you will need to explicitly specify all the packages you depend on.
> If you are not sure exactly which packages are required,
> it is recommended to install at least `scheme-basic`,
> which contains the most basic packages such as `latex` and `amsmath`.
>
> See also "[Troubleshooting](#troubleshooting)."

You can also specify packages by file using the `package-file` input:

```yaml
- uses: actions/checkout@v4
- uses: teatimeguest/setup-texlive-action@v3
  with:
    package-file: |
      .github/tl_packages
      **/DEPENDS.txt
```

### Caching

By default, the action will save `TEXDIR` to cache using [`@actions/cache`].
This is done in the [post-process] of a completed workflow job,
so that, for example, LuaTeX font cache files generated in your job are
also saved and restored as part of the cache entry.

If you have problems due to a corrupt cache entry,
you can delete it from the [web interface], [GitHub CLI], or [REST API].
For an example of programmatically deleting cache entries created by this action
using [actions/github-script], see [this script][e2e/index.cjs].

If you want to disable caching, set the `cache` input to `false`:

```yaml
- uses: teatimeguest/setup-texlive-action@v3
  with:
    cache: false
```

[GitHub CLI]: https://github.com/actions/gh-actions-cache
[REST API]: https://docs.github.com/en/rest/actions/cache?apiVersion=2022-11-28#delete-github-actions-caches-for-a-repository-using-a-cache-key
[`@actions/cache`]: https://github.com/actions/toolkit/tree/main/packages/cache
[actions/github-script]: https://github.com/actions/github-script
[e2e/index.cjs]: https://github.com/teatimeguest/setup-texlive-action/blob/v3.3.0/packages/e2e/index.cjs
[post-process]: https://docs.github.com/en/actions/sharing-automations/creating-actions/metadata-syntax-for-github-actions#runspost
[web interface]: https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#deleting-cache-entries

### Historic Versions

You can use an older version of TeX Live by setting the `version` input:

```yaml
- uses: teatimeguest/setup-texlive-action@v3
  with:
    version: 2008
```

The action will install an older version
using [historic archive](https://tug.org/historic/)
with small patches to fix minor problems.

<details>
  <summary>
    <ins>Supported TeX Live versions</ins>
  </summary>
  <p />
  <table>
    <thead>
      <tr>
        <th>OS</th>
        <th>Runner</th>
        <th>TeX Live Versions</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th rowspan="3">Linux</th>
        <!-- &zwj; U+200D ZERO WIDTH JOINER -->
        <td><code>ubuntu-&zwj;24.04</code>*</td>
        <td rowspan="5">

`2008`&ndash;`2024`

</td>
      </tr>
      <tr><td><code>ubuntu-22.04</code></td></tr>
      <tr><td><code>ubuntu-20.04</code></td></tr>
      <tr>
        <th rowspan="2">Windows</th>
        <td><code>windows-2022</code>*</td>
      </tr>
      <tr><td><code>windows-2019</code></td></tr>
      <tr>
        <th rowspan="3">macOS</th>
        <td><code>macos-15</code></td>
        <td rowspan="3">

`2013`&ndash;`2024`

> :memo:&ensp;Versions prior to `2013` are for 32-bit systems and
> will not work due to _<q>Bad CPU type in executable.</q>_

</td>
      </tr>
      <tr><td><code>macos-14</code>*</td></tr>
      <tr><td><code>macos-13</code></td></tr>
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3">
          <p />
          <sub>
            The runners marked with "*" are
            the current <code>-latest</code> runners (i.e.,
            <code>ubuntu-latest</code>,
            <code>windows-latest</code>, and
            <code>macos-latest</code>).
          </sub>
        </td>
      </tr>
    </tfoot>
  </table>
</details>

## Inputs

All inputs are optional.

| Name                  | Type   | Description                                                                                                                                                                                                              |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cache`               | Bool   | <p>Enable caching for [`TEXDIR`].</p> **Default:**&ensp;`true`                                                                                                                                                           |
| `package-file`        | String | A (multi-line) [glob] string to specify files that contain package names to be installed. The file format is the same as the syntax for the `packages` input. In addition, the [`DEPENDS.txt`] format is also supported. |
| `packages`            | String | TeX package names to be installed, separated by whitespaces. Schemes and collections are also acceptable. Everything from "`#`" to the end of line will be treated as a comment.                                         |
| `prefix`              | String | <p>TeX Live installation prefix. This has the same effect as [`TEXLIVE_INSTALL_PREFIX`][install-tl-env-vars].</p> **Default:**&ensp;<code>[$RUNNER_TEMP]/setup-texlive-action</code>                                     |
| `repository`          | URL    | Specify the [package repository URL] to be used as the main repository. Currently only http(s) repositories are supported.                                                                                               |
| `texdir`              | String | TeX Live system installation directory. This has the same effect as the installer's [`-texdir`] option and takes precedence over the `prefix` input and related environment variables.                                   |
| `tlcontrib`           | Bool   | <p>Set up [TLContrib] as an additional TeX package repository. This input will be ignored for older versions.</p> **Default:**&ensp;`false`                                                                              |
| `update-all-packages` | Bool   | <p>Update all TeX packages when cache restored. Defaults to `false`, and the action will update only `tlmgr`.</p> **Default:**&ensp;`false`                                                                              |
| `version`             | String | <p>TeX Live version to install. Supported values are `2008` to `2024`, and `latest`.</p> **Default:**&ensp;`latest` if the `repository` input is not set, otherwise the remote version will be assumed.                  |

<!-- TODO
  - Provide a separate subsection on the input syntax and file format.
  - Add a description for texmf-related inputs and profiles.
-->

[$RUNNER_TEMP]: https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
[TLContrib]: https://contrib.texlive.info
[`-texdir`]: https://tug.org/texlive/doc/install-tl.html#texdir-dir
[`DEPENDS.txt`]: https://tug.org/texlive/pkgcontrib.html#deps "Dependencies on other packages"
[install-tl-env-vars]: https://tug.org/texlive/doc/install-tl.html#ENVIRONMENT-VARIABLES
[package repository URL]: https://tug.org/texlive/doc/texlive-en/texlive-en.html#x1-280003.3.1 "3.3.1 The repository option"

## Outputs

<!-- &zwj; U+200D ZERO WIDTH JOINER -->

| Name                             | Type   | Description                                                                              |
| -------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `cache-hit`                      | Bool   | A boolean value to indicate if an exact cache match was found. Implies `cache-restored`. |
| <code>cache-&zwj;restored</code> | Bool   | A boolean value to indicate if a cache was found.                                        |
| `version`                        | String | The installed TeX Live version.                                                          |

## Environment Variables

The action reads the following environment variable:

<!-- U+200B ZERO WIDTH SPACE -->

| Name                                                          | Type   | Description                                                                                                                                                                                                                                        |
| ------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <code>SETUP_TEXLIVE_ACTION_&#x200B;FORCE_UPDATE_CACHE</code>  | String | Setting this to anything other than `0`, the action will use a [unique cache key each time][update-a-cache] to keep the cache up-to-date.<p /><blockquote>:warning:&ensp;Enabling this will consume more [cache space][cache-limits].</blockquote> |
| <code>SETUP_TEXLIVE_ACTION_&#x200B;NO_CACHE_ON_FAILURE</code> | String | Setting this to anything other than `0`, no cache will be saved when a job fails.                                                                                                                                                                  |
| [`NO_COLOR`](https://no-color.org/)                           | String | Disable color output.                                                                                                                                                                                                                              |

[cache-limits]: https://github.com/actions/cache#cache-limits
[update-a-cache]: https://github.com/actions/cache/blob/main/tips-and-workarounds.md#update-a-cache

In addition,
the [official environment variables][install-tl-env-vars] for `install-tl`
are supported, with the exception of `TEXLIVE_INSTALL_TEXMFSYS(CONFIG|VAR)`
in order to ensure system directories are cached correctly.

To specify the installation prefix, either the input `prefix` or
the environment variable `TEXLIVE_INSTALL_PREFIX` can be used,
with `prefix` taking precedence if both are set.
Precedence for all other texmf-related inputs and environment variables follows
the behavior of the latest version of `install-tl`.

<details>
  <summary>
    <ins>Default values in this action</ins>
  </summary>
  <p />

| Name                               | Default                                          |
| ---------------------------------- | ------------------------------------------------ |
| `TEXLIVE_DOWNLOADER`               |                                                  |
| `TL_DOWNLOAD_PROGRAM`              |                                                  |
| `TL_DOWNLOAD_ARGS`                 |                                                  |
| `TEXLIVE_INSTALL_ENV_NOCHECK`      | `1`                                              |
| `TEXLIVE_INSTALL_NO_CONTEXT_CACHE` |                                                  |
| `TEXLIVE_INSTALL_NO_DISKCHECK`     |                                                  |
| `TEXLIVE_INSTALL_NO_RESUME`        |                                                  |
| `TEXLIVE_INSTALL_NO_WELCOME`       | `1`                                              |
| `TEXLIVE_INSTALL_PAPER`            |                                                  |
| `TEXLIVE_INSTALL_PREFIX`           | <code>[$RUNNER_TEMP]/setup-texlive-action</code> |
| `TEXLIVE_INSTALL_TEXMFLOCAL`       |                                                  |
| `TEXLIVE_INSTALL_TEXMFHOME`        | Same as `TEXMFLOCAL`                             |
| `TEXLIVE_INSTALL_TEXMFCONFIG`      | Same as `TEXMFSYSCONFIG`                         |
| `TEXLIVE_INSTALL_TEXMFVAR`         | Same as `TEXMFSYSVAR`                            |
| `NOPERLDOC`                        |                                                  |

</details>

## Permissions

This action does not use [`GITHUB_TOKEN`] and
does not require any [permissions].

[`GITHUB_TOKEN`]: https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token
[permissions]: https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idpermissions

## Troubleshooting

> If a problem persists, feel free to open an issue.

- [Dependency Issues](#dependency-issues)
- [Repository-Related Issues](#repository-related-issues)
- [Local Testing](#local-testing)
- [Debug Logging](#debug-logging)

### Dependency Issues

Unlike other package managers such as `pip` or `npm`,
TeX Live (`tlmgr`) has very little dependency management,
so generally it is difficult to determine exactly which packages you need.
Lacking some indirect dependencies,
you may often encounter compilation errors like:

```console
! LaTeX Error: File `XXXXX.sty` not found.
```

While there is no perfect solution,
there are some tools that can help address this problem:

| Name           | Version                                     | Description                                          |
| -------------- | ------------------------------------------- | ---------------------------------------------------- |
| [DEPP]         | [![GitLab][DEPP-badge]][DEPP]               | Dependency Printer for TeX Live                      |
| [TeXFindPkg]   | [![CTAN][TeXFindPkg-badge]][TeXFindPkg]     | Query or install TeX packages and their dependencies |
| [texliveonfly] | [![CTAN][texliveonfly-badge]][texliveonfly] | On-the-fly download of missing TeX live packages     |

[DEPP-badge]: https://img.shields.io/gitlab/v/tag/islandoftex%2Ftexmf%2Fdepp?logo=gitlab&logoColor=fc6d26&label=GitLab&labelColor=2e353b&color=fc6d26
[DEPP]: https://gitlab.com/islandoftex/texmf/depp
[TeXFindPkg-badge]: https://img.shields.io/ctan/v/texfindpkg?label=CTAN&labelColor=2e353b&color=424285
[TeXFindPkg]: https://ctan.org/pkg/texfindpkg
[texliveonfly-badge]: https://img.shields.io/ctan/v/texliveonfly?label=CTAN&labelColor=2e353b&color=424285
[texliveonfly]: https://ctan.org/pkg/texliveonfly

### Repository-Related Issues

By default, the action automatically picks
one of the [CTAN mirrors](https://ctan.org/mirrors) and
sets it as the main package repository for the installation.
Infrequently, there may be some problem with the repository,
causing setup to fail with log messages like:

- ```console
  Error: unable to verify the first certificate
  ```

- ```console
  TeXLive::TLUtils::check_file_and_remove:
    checksums differ for /tmp/path/to/some/package.tar.xz:
  ```

- ```console
  gpg: BAD signature from "TeX Live Distribution <tex-live@tug.org>" [ultimate]
  ```

In most cases, these problems do not last so long and
after a while the workflow should be stable again.

Alternatively, you can pin the main repository
using the `repository` input to avoid using problematic repositories:

```yaml
- uses: teatimeguest/setup-texlive-action@v3
  with:
    repository: https://example.com/path/to/systems/texlive/tlnet/
```

For more information on the repository URL format,
see "[3.3.1 The `-repository` option][package repository URL]"
in the official TeX Live documentation.

### Local Testing

If you are using a container engine such as `docker`,
[`act`](https://nektosact.com) allows you
to run a workflow locally inside a container environment,
without having to push changes to GitHub, saving a lot of time in setup for CI.
This action can be run on a [`node:20`](https://hub.docker.com/_/node) image,
so the following configuration is
a good starting point for testing or debugging with `act`:

<table>
  <tr>
    <td align="right">
      <a href="https://nektosact.com/usage/index.html#configuration-file">
        <samp><code>.actrc</code></samp>
      </a>
    </td>
  </tr>
  <tr>
    <td width="1200">

```opts
--platform ubuntu-latest=node:20
--pull=false
--detect-event
--env RUNNER_DEBUG=1           # Enable debug logging
# --env NODE_DEBUG=<module>    # Might be useful in few cases
```

</td>
  </tr>
</table>

### Debug Logging

On GitHub, debug logging can be enabled without modifying a workflow file
by setting repository configuration variables.
See the [GitHub Docs][enabling-debug-logging] for more information.

[enabling-debug-logging]: https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/enabling-debug-logging

## Changelog

See the [releases page](https://github.com/teatimeguest/setup-texlive-action/releases).

## License

[MIT License](./LICENSE)

For third-party software licenses and copyright notices,
please refer to [dist/NOTICE.md](./dist/NOTICE.md).
