module.exports = async ({ context, core, github }) => {
  const { deleteActionsCacheByKey, getActionsCacheList } = github.rest.actions;
  const paginator = github.paginate.iterator(getActionsCacheList, {
    ...context.repo,
    per_page: 100,
    key: 'setup-texlive-',
  });
  for await (const { data: caches } of paginator) {
    await Promise.all(caches.map(async ({ key }) => {
      if (key !== undefined) {
        core.info(`Deleting ${key}`);
        return await deleteActionsCacheByKey({ ...context.repo, key });
      }
    }));
  }
};
