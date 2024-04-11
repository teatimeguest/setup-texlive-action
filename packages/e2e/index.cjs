// @ts-check
/**
 * Delete all caches created by this action.
 *
 * @param {object} args
 * @param {import('@actions/github').context} args.context
 * @param {import('@actions/core')} args.core
 * @param {ReturnType<import('@actions/github').getOctokit>} args.github
 */
async function deleteCaches(args) {
  const { context, core, github: { paginate, rest } } = args;
  const { deleteActionsCacheByKey, getActionsCacheList } = rest.actions;
  const paginator = paginate.iterator(getActionsCacheList, {
    ...context.repo,
    per_page: 100,
    key: 'setup-texlive-action-',
  });
  for await (const { data } of paginator) {
    for (const { key } of data) {
      if (key !== undefined) {
        core.info(`Deleting ${key}`);
        try {
          await deleteActionsCacheByKey({ ...context.repo, key });
        } catch (error) {
          core.setFailed(`${error}`);
        }
      }
    }
  }
}

module.exports = { deleteCaches };
