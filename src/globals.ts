import { setDefaultResultOrder } from 'node:dns';
import { setDefaultAutoSelectFamily } from 'node:net';

import '@abraham/reflection';
import 'temporal-polyfill/global';

import '#/polyfill/shim/array-from-async';
import '#/polyfill/shim/disposable';
import '#/util/custom-inspect';

// https://github.com/node-fetch/node-fetch/issues/1624
// https://github.com/nodejs/node/issues/47822
setDefaultResultOrder('ipv4first');
setDefaultAutoSelectFamily(false);

declare module 'node:net' {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  function setDefaultAutoSelectFamily(value: boolean): void;
}
