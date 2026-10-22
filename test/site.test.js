const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {once} = require('node:events');
const {build, pages} = require('../scripts/build');
const {renderProject} = require('../scripts/render-projects');
const {createServer} = require('../scripts/serve');
const projects = require('../content/projects');
const output = path.resolve(__dirname, '../dist');
const read = page => fs.readFileSync(path.join(output, page), 'utf8');
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"');

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(([, name, value]) => [name, decode(value)]));
}

build();

test('all pages have a shared header, footer, language and meaningful main landmark', () => {
  for (const page of pages) {
    const html = read(page);
    assert.equal((html.match(/class="site-header"/g) || []).length, 1, page);
    assert.equal((html.match(/class="site-footer"/g) || []).length, 1, page);
    assert.equal((html.match(/<main\b/g) || []).length, 1, page);
    assert.match(html, /lang="en-GB"/);
    assert.match(html, /href="#main-content"/);
    assert.match(html, /id="main-content"/);
    assert.match(html, /2026 Amanda Bamford/);
    assert.match(html, /Built with HTML5, CSS3 &amp; JavaScript/);
  }
});

test('every local link, fragment, stylesheet and image resolves in the built site', () => {
  for (const page of pages) {
    for (const match of read(page).matchAll(/<(?:a|img|link|script)\b[^>]*>/g)) {
      const tag = attributes(match[0]);
      const target = tag.href || tag.src;
      if (!target || /^(?:https?:|mailto:|tel:)/.test(target)) continue;
      const url = new URL(target, `https://portfolio.test/${page}`);
      const file = decodeURIComponent(url.pathname).slice(1) || 'index.html';
      const resolved = path.resolve(output, file);
      assert.ok(resolved.startsWith(output + path.sep), target);
      assert.ok(fs.existsSync(resolved), `${page}: ${target}`);
      if (url.hash && file.endsWith('.html')) {
        const id = decodeURIComponent(url.hash.slice(1));
        assert.ok(read(file).includes(`id="${id}"`), `${page}: ${target}`);
      }
    }
  }
});

test('images reserve their intrinsic space and retain meaningful alternative text', () => {
  let count = 0;
  for (const page of pages) {
    for (const match of read(page).matchAll(/<img\b[^>]*>/g)) {
      const a = attributes(match[0]);
      assert.ok(Number(a.width) > 0 && Number(a.height) > 0, `${page}: ${a.src}`);
      assert.ok(a.alt?.trim(), `${page}: ${a.src}`);
      assert.ok(['eager', 'lazy'].includes(a.loading));
      assert.match(a.src, /\.webp$/);
      count++;
    }
  }
  assert.ok(count > 20);
});

test('all real projects render once with an accurate choice of live and code actions', () => {
  const html = read('index.html');
  assert.equal((html.match(/class="project-card"/g) || []).length, projects.length);
  assert.equal((html.match(/>Try it out /g) || []).length, projects.filter(p => p.demo).length);
  assert.equal((html.match(/>View code /g) || []).length, projects.length);
  assert.ok(!html.includes('Allotment Planner'));
  assert.equal(new Set(projects.map(p => p.title)).size, projects.length);
});

test('project rendering escapes content and refuses executable or non-HTTPS links', () => {
  const sample = {...projects[0], title: '<img src=x onerror=alert(1)>', description: 'A & B', tags: ['<script>']};
  const html = renderProject(sample);
  assert.doesNotMatch(html, /<img|<script>/);
  assert.match(html, /&lt;img/);
  assert.match(html, /A &amp; B/);
  assert.throws(() => renderProject({...sample, repository: 'javascript:alert(1)'}), /HTTPS/);
  assert.throws(() => renderProject({...sample, demo: 'http://example.com'}), /HTTPS/);
  assert.throws(() => renderProject({...sample, title: ''}), /title/);
});

test('build excludes source, tests and private repository configuration', () => {
  for (const name of ['package.json', 'README.md', 'test', 'partials', 'content', '.github', '.git', '.env']) {
    assert.ok(!fs.existsSync(path.join(output, name)), name);
  }
  assert.ok(fs.statSync(path.join(output, 'assets/cv.pdf')).size > 0);
  assert.ok(!fs.existsSync(path.join(output, 'css/style.css')));
  assert.ok(!fs.existsSync(path.join(output, 'assets/blog/potion-station/quality-assurance.jpeg')));
  assert.throws(() => build(path.resolve(output, '..')), /dist directory/);
});

test('development server serves the site, nested pages, images and a genuine 404', async t => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const page of ['/', '/blog/memory-blanket/memory-blanket.html', '/css/shared.css', '/assets/decor/pressed-flower-border-hd.webp']) {
    const result = await fetch(base + page);
    assert.equal(result.status, 200, page);
    assert.ok((await result.text()).length > 0);
  }
  const missing = await fetch(base + '/missing/nested/page');
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /wandered off/);
  assert.equal((await fetch(base + '/package.json')).status, 404);
  assert.equal((await fetch(base + '/', {method: 'POST'})).status, 405);
  assert.equal((await fetch(base + '/%zz')).status, 400);
});


test('new project badges follow explicit boolean metadata', () => {
  const sample = {...projects[0], isNew: true};
  assert.match(renderProject(sample), /class="project-new">New project<\/span>/);
  assert.doesNotMatch(renderProject({...sample, isNew: false}), /class="project-new"/);
  assert.doesNotMatch(renderProject({...projects[0], isNew: undefined}), /class="project-new"/);
  assert.throws(() => renderProject({...sample, isNew: 'false'}), /boolean/);
  assert.equal((read('index.html').match(/class="project-new"/g) || []).length, projects.filter(p => p.isNew).length);
});


test('source pages include visible navigation and projects for direct static previews', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.resolve(__dirname, '..', page), 'utf8');
    assert.match(html, /class="site-header"/);
    assert.match(html, /class="site-footer"/);
    if (page === 'index.html') {
      assert.equal((html.match(/class="project-card"/g) || []).length, projects.length);
      assert.match(html, /Sound Safari/);
    }
  }
  const first = read('index.html');
  build();
  assert.equal(read('index.html'), first, 'rebuilding must not duplicate generated sections');
});


test('decorative assets resolve from CSS and article return links are bottom-only', () => {
  for (const stylesheet of ['shared.css', 'portfolio.css', 'blog.css']) {
    const css = read(`css/${stylesheet}`);
    for (const [, target] of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const [asset, fragment] = target.split('#');
      const resolved = path.resolve(output, 'css', asset);
      assert.ok(fs.existsSync(resolved), `${stylesheet}: ${target}`);
      if (fragment) assert.ok(fs.readFileSync(resolved, 'utf8').includes(`id="${fragment}"`), target);
    }
  }
  for (const page of pages.filter(page => page.startsWith('blog/'))) {
    const html = read(page);
    assert.equal(html.split('← Back to Projects outside the screen.').length - 1, 1, page);
    assert.ok(html.indexOf('← Back to Projects outside the screen.') > html.lastIndexOf('</section>'), page);
  }
});


test('all hobby cards use a consistent flush thumbnail frame', () => {
  const cards = [...read('index.html').matchAll(/<article class="blog-card">([\s\S]*?)<\/article>/g)];
  assert.equal(cards.length, 4);
  for (const [, card] of cards) {
    assert.match(card, /<div class="blog-card-media"><img class="blog-card-image"/);
  }
});


test('homepage includes the approved About copy, concise facts and work arrow', () => {
  const html = read('index.html');
  assert.match(html, /a cup of coffee and a creative idea/);
  assert.match(html, /finding small ways to make life a bit better/);
  for (const fact of ['Based in the UK', 'Software developer', 'Gardener &amp; maker', 'Always learning']) {
    assert.ok(html.includes(fact));
  }
  assert.match(html, /See my work <span aria-hidden="true">→<\/span>/);
});


test('every article uses the shared title-first heading and floral separator', () => {
  for (const page of pages.filter(page => page.startsWith('blog/'))) {
    const header = read(page).match(/<header class="blog-post-header">([\s\S]*?)<\/header>/)[1];
    assert.match(header, /^\s*<h1>[^<]+<\/h1>\s*<p class="eyebrow">/);
    assert.equal((header.match(/class="article-floral-divider"/g) || []).length, 1);
    assert.doesNotMatch(header, /Back to Projects/);
  }
});

test('all pages version stylesheet URLs so changed CSS is refreshed after deployment', () => {
  for (const page of pages) {
    const sheets = [...read(page).matchAll(/href="([^" ]*css\/(?:shared|portfolio|blog)\.css[^" ]*)"/g)];
    assert.ok(sheets.length >= (page === '404.html' ? 1 : 2), page);
    for (const [, href] of sheets) assert.match(href, /\?v=[a-f0-9]{12}$/);
  }
});
