'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {renderProject} = require('./render-projects');
const projects = require('../content/projects');
const root = path.resolve(__dirname, '..');
const pages = ['index.html', '404.html',
  'blog/potion-station/potion-station.html', 'blog/birthday-hike/birthday-hike.html',
  'blog/memory-blanket/memory-blanket.html', 'blog/las-vegas-aws/las-vegas-aws.html'];

function build(output = path.join(root, 'dist')) {
  const resolved = path.resolve(output);
  if (resolved !== path.join(root, 'dist')) throw new Error('Build output must be the project dist directory');
  fs.rmSync(resolved, {recursive: true, force: true});
  fs.mkdirSync(resolved, {recursive: true});
  fs.mkdirSync(path.join(resolved, 'css'), {recursive: true});
  for (const file of ['shared.css', 'portfolio.css', 'blog.css']) {
    fs.copyFileSync(path.join(root, 'css', file), path.join(resolved, 'css', file));
  }
  fs.cpSync(path.join(root, 'assets'), path.join(resolved, 'assets'), {
    recursive: true,
    filter: source => fs.statSync(source).isDirectory() || ['.webp', '.pdf', '.svg'].includes(path.extname(source).toLowerCase())
  });
  for (const page of pages) {
    const prefix = path.posix.relative(path.posix.dirname(page), '.') || '.';
    const rootPrefix = page === '404.html' ? '/' : `${prefix}/`;
    let html = fs.readFileSync(path.join(root, page), 'utf8');
    // Keep complete fallback markup in the source pages as well as dist.
    // This makes direct previews and static root hosting show the same content.
    const sections = {
      header: fs.readFileSync(path.join(root, 'partials/header.html'), 'utf8').replaceAll('{{root}}', rootPrefix).trim(),
      footer: fs.readFileSync(path.join(root, 'partials/footer.html'), 'utf8').replaceAll('{{root}}', rootPrefix).trim(),
      projects: projects.map(renderProject).join('\n')
    };
    for (const [name, content] of Object.entries(sections)) {
      const start = `<!-- site:${name} -->`;
      const end = `<!-- /site:${name} -->`;
      if (!html.includes(start)) {
        if (name === 'projects' && page !== 'index.html') continue;
        throw new Error(`Missing ${name} marker in ${page}`);
      }
      const pattern = new RegExp(`${start}(?:[\\s\\S]*?${end})?`);
      html = html.replace(pattern, () => `${start}\n${content}\n${end}`);
    }
    html = html.replace(/(href="[^"]*css\/(shared|portfolio|blog)\.css)(?:\?v=[a-f0-9]+)?"/g, (_, href, name) => {
      const version = createHash('sha256').update(fs.readFileSync(path.join(root, 'css', `${name}.css`))).digest('hex').slice(0, 12);
      return `${href}?v=${version}"`;
    });
    fs.writeFileSync(path.join(root, page), html);
    html = html.replace(/<!-- \/?site:(?:header|footer|projects) -->\n?/g, '');
    if (/<!-- site:|\{\{root\}\}/.test(html)) throw new Error(`Unresolved template in ${page}`);
    const target = path.join(resolved, page);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, html);
  }
  fs.copyFileSync(path.join(root, 'robots.txt'), path.join(resolved, 'robots.txt'));
  console.log(`Built ${pages.length} pages and ${projects.length} project cards in dist/`);
}

if (require.main === module) build();
module.exports = {build, pages};
