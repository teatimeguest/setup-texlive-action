import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from 'node:process';

import { TestEnvironment as NodeEnvironment } from 'jest-environment-node';

import type { Version } from '#/texlive/version';

import { latest } from '##/src/texlive/release-data.json';

const prefix = env['npm_config_local_prefix']!;

export default class JestEnvironment extends NodeEnvironment {
  override async setup(): Promise<void> {
    await super.setup();
    this.global.LATEST_VERSION = latest.version as Version;
    // https://www.rfc-editor.org/rfc/rfc2606.html
    this.global.MOCK_URL = 'https://example.com/';
    this.global.fixtures = async function(name: string): Promise<string> {
      const dir = path.join(prefix, 'tests', 'fixtures');
      return await fs.readFile(path.format({ dir, name }), 'utf8');
    };
  }
}

declare global {
  var LATEST_VERSION: Version;
  var MOCK_URL: string;
  function fixtures(name: string): Promise<string>;
}

/* eslint no-var: off */
