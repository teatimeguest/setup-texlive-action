// @ts-check
import GitHubSlugger from 'github-slugger';
import nunjucks from 'nunjucks';

const env = nunjucks.configure({
  autoescape: false,
  throwOnUndefined: true,
  trimBlocks: true,
  lstripBlocks: true,
  noCache: true,
});
const indent = env.getFilter('indent');
const slugger = new GitHubSlugger();

export default env
  .addFilter('indent', (str, width = 4, first = false, blank = false) => {
    const indented = indent(str, width, first);
    return blank ? indented : indented.replaceAll(/^\s+$/gmv, '');
  })
  .addFilter('escape', (str) => str.replaceAll(/[<>]/gv, '\\$&'))
  .addFilter('slugify', (str) => slugger.slug(str));
