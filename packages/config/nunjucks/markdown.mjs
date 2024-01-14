import nunjucks from 'nunjucks';
import slugify from 'slugify';

export default nunjucks
  .configure({
    autoescape: false,
    throwOnUndefined: true,
    trimBlocks: true,
    lstripBlocks: true,
    noCache: true,
  })
  .addFilter('slugify', (s) => {
    return slugify(s, {
      remove: /[!-/:-@[-`{-~]/gu,
      lower: true,
    });
  })
  .addFilter('escape', (s) => s.replaceAll(/[<>]/gu, '\\$&'));
