/**
 * @file
 * @see {@link https://jestjs.io/ja/docs/configuration#snapshotresolver-string}
 */

/**
 * @param {string} testPath
 * @param {string} snapshotExtension
 * @returns {string}
 */
function resolveSnapshotPath(testPath, snapshotExtension) {
  return testPath.replace('__tests__', '__snapshots__') + snapshotExtension;
}

/**
 * @param {string} snapshotFilePath
 * @param {string} snapshotExtension
 * @returns {string}
 */
function resolveTestPath(snapshotFilePath, snapshotExtension) {
  return snapshotFilePath
    .replace('__snapshots__', '__tests__')
    .slice(0, -snapshotExtension.length);
}

const testPathForConsistencyCheck = 'tests/__tests__/example.test.ts';

module.exports = {
  resolveSnapshotPath,
  resolveTestPath,
  testPathForConsistencyCheck,
};
