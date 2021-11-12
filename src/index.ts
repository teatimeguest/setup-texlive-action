import * as core from '@actions/core';

import { run } from '#/setup';

run().catch((error) => core.setFailed(`${error}`));
