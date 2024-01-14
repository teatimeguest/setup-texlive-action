import { setDefaultResultOrder } from 'node:dns';
import { setDefaultAutoSelectFamily } from 'node:net';

// https://github.com/node-fetch/node-fetch/issues/1624
// https://github.com/nodejs/node/issues/47822
setDefaultResultOrder('ipv4first');
setDefaultAutoSelectFamily(false);

declare module 'node:net' {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  function setDefaultAutoSelectFamily(value: boolean): void;
}
