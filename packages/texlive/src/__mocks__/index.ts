import { vi } from 'vitest';

vi.mock('#texlive/releases');
vi.mock('#texlive/tlnet');
vi.mock('#texlive/install-tl/cli');
vi.mock('#texlive/tlmgr/actions/install');
vi.mock('#texlive/tlmgr/actions/path');
vi.mock('#texlive/tlmgr/actions/pinning');
vi.mock('#texlive/tlmgr/actions/repository');
vi.mock('#texlive/tlmgr/actions/update');
vi.mock('#texlive/tlmgr/actions/internals');

export * from '../index.js';
