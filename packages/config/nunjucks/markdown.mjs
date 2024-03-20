import GitHubSlugger from 'github-slugger';
import nunjucks from 'nunjucks';

const slugger = new GitHubSlugger();

export default nunjucks
  .configure({
    autoescape: false,
    throwOnUndefined: true,
    trimBlocks: true,
    lstripBlocks: true,
    noCache: true,
  })
  .addFilter('slugify', (s) => slugger.slug(s))
  .addFilter('escape', (s) => s.replaceAll(/[<>]/gv, '\\$&'));
