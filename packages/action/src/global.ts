import { setDefaultResultOrder } from 'node:dns';
import { setDefaultAutoSelectFamily } from 'node:net';

import '@setup-texlive-action/polyfill';
import '@setup-texlive-action/logger/custom-inspect';

// https://github.com/node-fetch/node-fetch/issues/1624
// https://github.com/nodejs/node/issues/47822
setDefaultResultOrder('ipv4first');
setDefaultAutoSelectFamily(false);
