import assert from 'node:assert/strict';

import esMain from 'es-main';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import type {
  LicenseIdentifiedModule,
} from 'license-webpack-plugin/dist/LicenseIdentifiedModule';
import webpack from 'webpack';

import webpackConfig, { pluginNoEmit } from '##/.config/webpack.config.mjs';

const allowlist = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-3-Clause',
  'ISC',
  'MIT',
]);

export function pluginListLicenses(
  callback: (data: Array<LicenseIdentifiedModule>) => Promise<unknown>,
): (compiler: webpack.Compiler) => void {
  return (compiler: webpack.Compiler) => {
    const assertName = 'licenses.txt';
    let data: Array<LicenseIdentifiedModule>;

    const pluginLicense = new LicenseWebpackPlugin({
      outputFilename: assertName,
      unacceptableLicenseTest: (license: string) => !allowlist.has(license),
      renderLicenses: (modules: Array<LicenseIdentifiedModule>): string => {
        data = modules;
        return '';
      },
      handleMissingLicenseText: (name, license) => {
        switch (license) {
          case 'MIT':
            return 'The MIT License (https://opensource.org/license/mit/)';
          default:
            throw new Error(`Missing license file: ${name}`);
        }
      },
    }) as unknown as webpack.WebpackPluginInstance;
    pluginLicense.apply(compiler);

    compiler.hooks.afterCompile.tapPromise(
      'ListLicenses',
      async (compilation: webpack.Compilation): Promise<void> => {
        await callback(data);
        // compilation.deleteAsset(assertName);
      },
    );
  };
}

export async function compile(config: webpack.Configuration) {
  return await new Promise<void>(
    (resolve: () => void, reject: (error: Error) => void) => {
      webpack(config, (error?: Error, stats?: webpack.Stats) => {
        if (error) {
          reject(error);
        } else {
          const info = stats?.toJson();
          for (const warning of info?.warnings ?? []) {
            console.warn(warning.message ?? warning);
          }
          if (stats?.hasErrors()) {
            reject(new AggregateError(info?.errors));
          } else {
            resolve();
          }
        }
      });
    },
  );
}

export interface Module extends LicenseIdentifiedModule {
  author?: string | undefined;
  licenseId: string;
  licenseText: string;
}

export async function listLicenses(): Promise<Array<Module>> {
  let data: Array<LicenseIdentifiedModule>;

  const config = { ...webpackConfig } as webpack.Configuration;
  config.plugins = [...config.plugins ?? []];
  config.plugins.push(
    pluginListLicenses(async (licenseData) => {
      data = licenseData;
    }),
    pluginNoEmit,
  );
  await compile(config);

  const modules = function*(): Generator<Module, void, void> {
    for (const m of data!) {
      const author = m.packageJson?.['author'];
      if (typeof author === 'string') {
        m['author'] = author;
      } else {
        const { name, email, url } = author ?? {};
        if (name) {
          m['author'] = `${name}${email ? ` <${email}>` : ''}${
            url ? ` (${url})` : ''
          }`;
        }
      }
      m.name = m.packageJson?.name ?? m.name;
      assert.ok(m.licenseId);
      m.licenseText ??= m.licenseId;
      yield m as Module;
    }
  };
  return [...modules()].sort((lhs, rhs) => lhs.name < rhs.name ? -1 : 1);
}

export function showLicenses(modules: ReadonlyArray<Module>): void {
  const maxNameLength = Math.max(...modules.map((m) => m.name.length));
  const maxIdLength = Math.max(...modules.map((m) => m.licenseId.length));
  const header = 'PACKAGE'.padEnd(maxNameLength + 1)
    + 'LICENSE'.padEnd(maxIdLength);
  console.error(header);
  console.error('='.repeat(header.length));
  for (const { name, licenseId } of modules) {
    console.error(name.padEnd(maxNameLength), licenseId);
  }
}

if (esMain(import.meta)) {
  showLicenses(await listLicenses());
}
