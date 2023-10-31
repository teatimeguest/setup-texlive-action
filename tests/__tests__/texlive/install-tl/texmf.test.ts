import * as process from 'node:process';

import { SystemTrees, UserTrees } from '#/texlive/install-tl/texmf';

vi.unmock('#/texlive/install-tl/texmf');

const opts = { prefix: '<prefix>' };

describe('SystemTrees', () => {
  it('uses default directories', () => {
    const trees = new SystemTrees(LATEST_VERSION, opts);
    expect(trees).toHaveProperty('TEXDIR', `<prefix>/${LATEST_VERSION}`);
    expect(trees).toHaveProperty('TEXMFLOCAL', '<prefix>/texmf-local');
    expect(trees).toHaveProperty(
      'TEXMFSYSCONFIG',
      `<prefix>/${LATEST_VERSION}/texmf-config`,
    );
    expect(trees).toHaveProperty(
      'TEXMFSYSVAR',
      `<prefix>/${LATEST_VERSION}/texmf-var`,
    );
  });

  it('uses environment variables', () => {
    process.env.TEXLIVE_INSTALL_TEXMFSYSCONFIG = '<TEXMFSYSCONFIG>';
    process.env.TEXLIVE_INSTALL_TEXMFLOCAL = '<TEXMFLOCAL>';
    const trees = new SystemTrees(LATEST_VERSION, opts);
    expect(trees).toHaveProperty('TEXDIR', `<prefix>/${LATEST_VERSION}`);
    expect(trees).toHaveProperty('TEXMFLOCAL', '<TEXMFLOCAL>');
    expect(trees).toHaveProperty('TEXMFSYSCONFIG', '<TEXMFSYSCONFIG>');
    expect(trees).toHaveProperty(
      'TEXMFSYSVAR',
      `<prefix>/${LATEST_VERSION}/texmf-var`,
    );
  });

  it.each([
    {},
    { TEXLIVE_INSTALL_TEXMFSYSCONFIG: '<TEXMFSYSCONFIG>' },
    { TEXLIVE_INSTALL_TEXMFSYSVAR: '<TEXMFSYSVAR>' },
  ])('uses texdir', (env) => {
    Object.assign(globalThis.process.env, env);
    const trees = new SystemTrees(LATEST_VERSION, {
      ...opts,
      texdir: '<texdir>',
    });
    expect(trees).toHaveProperty('TEXDIR', '<texdir>');
    expect(trees).toHaveProperty('TEXMFLOCAL', '<texdir>/texmf-local');
    expect(trees).toHaveProperty('TEXMFSYSCONFIG', '<texdir>/texmf-config');
    expect(trees).toHaveProperty('TEXMFSYSVAR', '<texdir>/texmf-var');
  });

  it('uses TEXLIVE_INSTALL_TEXMFLOCAL', () => {
    process.env.TEXLIVE_INSTALL_TEXMFLOCAL = '<TEXMFLOCAL>';
    const trees = new SystemTrees(LATEST_VERSION, {
      ...opts,
      texdir: '<texdir>',
    });
    expect(trees).toHaveProperty('TEXMFLOCAL', '<TEXMFLOCAL>');
  });

  it('does not use TEXLIVE_INSTALL_TEXDIR', () => {
    process.env.TEXLIVE_INSTALL_TEXDIR = '<TEXDIR>';
    const trees = new SystemTrees(LATEST_VERSION, {
      ...opts,
      texdir: '<texdir>',
    });
    expect(trees).not.toHaveProperty('TEXDIR', '<TEXDIR>');
  });
});

describe('UserTrees', () => {
  it('defaults to use system directories', () => {
    const trees = new UserTrees(LATEST_VERSION, opts);
    expect(trees).toHaveProperty('TEXMFHOME', '<prefix>/texmf-local');
    expect(trees).toHaveProperty(
      'TEXMFCONFIG',
      `<prefix>/${LATEST_VERSION}/texmf-config`,
    );
    expect(trees).toHaveProperty(
      'TEXMFVAR',
      `<prefix>/${LATEST_VERSION}/texmf-var`,
    );
  });

  it('uses environment variables', () => {
    process.env.TEXLIVE_INSTALL_TEXMFCONFIG = '<TEXMFCONFIG>';
    const trees = new UserTrees(LATEST_VERSION, opts);
    expect(trees).toHaveProperty('TEXMFCONFIG', '<TEXMFCONFIG>');
  });

  it.each([
    {},
    { TEXLIVE_INSTALL_TEXMFCONFIG: '<TEXMFCONFIG>' },
  ])('uses texuserdir', (env) => {
    Object.assign(globalThis.process.env, env);
    const trees = new UserTrees(LATEST_VERSION, {
      ...opts,
      texuserdir: '<texuserdir>',
    });
    expect(trees).toHaveProperty('TEXMFHOME', '<texuserdir>/texmf');
    expect(trees).toHaveProperty('TEXMFCONFIG', '<texuserdir>/texmf-config');
    expect(trees).toHaveProperty('TEXMFVAR', '<texuserdir>/texmf-var');
  });
});
