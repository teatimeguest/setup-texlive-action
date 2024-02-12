/**
 * @param {object} args
 * @param {import('@actions/github').Context} args.context
 * @param {import('@actions/core')} args.core
 * @param {ReturnType<typeof import('@actions/github').getOctokit>} args.github
 */
async function deleteCaches(args) {
  const { context, core, github } = args;
  const { deleteActionsCacheByKey, getActionsCacheList } = github.rest.actions;
  const paginator = github.paginate.iterator(getActionsCacheList, {
    ...context.repo,
    per_page: 100,
    key: 'setup-texlive-action-',
  });
  for await (const { data: caches } of paginator) {
    await Promise.all(caches.map(async ({ key }) => {
      if (key !== undefined) {
        core.info(`Deleting ${key}`);
        try {
          await deleteActionsCacheByKey({ ...context.repo, key });
        } catch (error) {
          core.setFailed(`${error}`);
        }
      }
    }));
  }
}

module.exports = deleteCaches;
