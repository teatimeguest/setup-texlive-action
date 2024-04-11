# @setup-texlive-action/e2e

> E2E test files and helper scripts

## Prerequisites

- <!-- dprint-ignore-start -->
  <code>[act](https://github.com/nektos/act) >=0.2.53</code>
  <!-- dprint-ignore-end -->
- `docker`, or
  [compatible container engine](https://nektosact.com/usage/custom_engine.html)

### Container Images

- <!-- dprint-ignore-start -->
  <code>[node](https://hub.docker.com/_/node):20.0</code>
  <!-- dprint-ignore-end -->
- <!-- dprint-ignore-start -->
  <code>[ubuntu/squid](https://hub.docker.com/r/ubuntu/squid):latest</code>
  <!-- dprint-ignore-end -->

## Testing

```sh
npm run e2e [target]
```

```sh
npm run e2e -- --list  # Lists all test targets
```
