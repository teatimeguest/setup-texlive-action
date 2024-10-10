# @setup-texlive-action/e2e

> E2E test files and helper scripts

Local testing is done inside a container using [`act`].
The `act` binary is automatically installed during `npm ci` by [`@kie/act-js`].

## Prerequisites

- `docker`

### Container Images

<!-- dprint-ignore-start -->
- <code>[node]:20.0</code>
- <code>[ubuntu/squid]:latest</code>
<!-- dprint-ignore-end -->

## Testing

```sh
npm run e2e [target]
```

```sh
npm run e2e -- --list  # Lists all test targets
```

[`@kie/act-js`]: https://www.npmjs.com/package/@kie/act-js
[`act`]: https://nektosact.com
[node]: https://hub.docker.com/_/node
[ubuntu/squid]: https://hub.docker.com/r/ubuntu/squid
