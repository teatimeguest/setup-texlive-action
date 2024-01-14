/** @type {import('webpack').WebpackPluginFunction} */
export default function pluginNoEmit(compiler) {
  const name = 'NoEmit';
  compiler.hooks.compilation.tap(name, (compilation) => {
    compilation.hooks.processAssets.tap(name, (assets) => {
      for (const key of Object.keys(assets)) {
        delete assets[key];
      }
    });
  });
}

/** @type {import('webpack').WebpackPluginFunction} */
export function pluginNoOutput(compiler) {
  compiler.hooks.afterCompile.tap('NoOutput', (compilation) => {
    compilation.assets = [];
  });
}
