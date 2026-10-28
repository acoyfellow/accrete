import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';

const SITE = 'https://accrete.customer0.dev';
const OUT = 'client/public/docs';
const SECTIONS = ['overview', 'tutorials', 'how-to', 'reference', 'explanation'];
const SECTION_TITLES = { overview: 'Overview', tutorials: 'Tutorials', 'how-to': 'How-to guides', reference: 'Reference', explanation: 'Explanation' };

const FRONT = new RegExp('^---\\n([\\s\\S]*?)\\n---\\n');

const parse = (path) => {
  const raw = readFileSync(path, 'utf8');
  const match = FRONT.exec(raw);
  const meta = Object.fromEntries((match?.[1] ?? '').split('\n').filter(Boolean).map((line) => [line.slice(0, line.indexOf(':')).trim(), line.slice(line.indexOf(':') + 1).trim()]));
  return { meta, body: match ? raw.slice(match[0].length) : raw };
};

const pages = readdirSync('docs', { recursive: true })
  .map(String)
  .filter((file) => file.endsWith('.md'))
  .map((file) => {
    const { meta, body } = parse(join('docs', file));
    const slug = file.replace(new RegExp('\\.md$'), '').replace(new RegExp('(^|/)index$'), '');
    return { file, slug, url: slug === '' ? '/docs/' : `/docs/${slug}/`, section: meta.section ?? 'overview', order: Number(meta.order ?? 99), title: meta.title ?? slug, description: meta.description ?? '', body };
  })
  .sort((first, second) => SECTIONS.indexOf(first.section) - SECTIONS.indexOf(second.section) || first.order - second.order);

const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

const nav = (current) =>
  SECTIONS.map((section) => {
    const items = pages.filter((page) => page.section === section);
    if (items.length === 0) return '';
    const links = items.map((page) => `<li><a href="${page.url}"${page.url === current.url ? ' aria-current="page"' : ''}>${escape(page.title)}</a></li>`).join('');
    return `<p class="nav-h">${SECTION_TITLES[section]}</p><ul>${links}</ul>`;
  }).join('');

const toc = (html) => {
  const heads = [...html.matchAll(new RegExp('<h2 id="([^"]+)">(.*?)</h2>', 'g'))];
  if (heads.length < 2) return '';
  return `<p class="nav-h">On this page</p><ul>${heads.map(([, id, text]) => `<li><a href="#${id}">${text}</a></li>`).join('')}</ul>`;
};

const slugify = (text) => text.toLowerCase().replace(new RegExp('<[^>]+>', 'g'), '').replace(new RegExp('[^a-z0-9]+', 'g'), '-').replace(new RegExp('^-|-$', 'g'), '');

marked.use({ renderer: { heading({ tokens, depth }) { const text = this.parser.parseInline(tokens); return `<h${depth} id="${slugify(text)}">${text}</h${depth}>`; } } });

const numbers = JSON.parse(readFileSync('client/src/numbers.json', 'utf8'));
const workflows = (() => {
  try {
    return JSON.parse(readFileSync('bench/workflows/latest.json', 'utf8'));
  } catch {
    return null;
  }
})();

const workflowTable = () => {
  if (workflows === null) return '_No workflow receipt yet. Run `node scripts/workflow-bench.mjs latest`._';
  const rows = workflows.results.map((row) => `| ${row.title}<br><code>${row.package}</code> | ${row.local.p50Ms} ms | ${row.cold.ms} ms | **${row.repeat.p50Ms} ms** | **${Math.round(row.local.p50Ms / row.repeat.p50Ms)}×** |`);
  const allSame = workflows.results.every((row) => row.sameOutput);
  const repeatCs = workflows.results.reduce((sum, row) => sum + row.repeat.containerSeconds, 0);
  return ['| Workflow | Laptop `npx` | accrete, 1st call | accrete, repeat | Faster |', '|---|---|---|---|---|', ...rows].join('\n') +
    `\n\nOutput identical to \`npx\` on every call: **${allSame ? 'yes' : 'no'}**. Container time across all repeat calls: **${repeatCs.toFixed(2)} s**. Times are p50.` +
    `\n\nReceipt: [\`bench/workflows/latest.json\`](https://github.com/acoyfellow/accrete/blob/main/bench/workflows/latest.json) · ${workflows.results[0]?.repeats ?? 0} repeats per workflow · ${workflows.host.platform}, Node ${workflows.host.node} · accrete ${workflows.placement === 'local' ? 'on local wrangler dev' : 'deployed'} · digest \`${workflows.digest.slice(0, 12)}\``;
};

const fill = (body) =>
  body
    .replaceAll('{{WORKFLOW_TABLE}}', workflowTable())
    .replaceAll('{{HELDOUT}}', numbers.current.coverage)
    .replaceAll('{{REPEAT_CS}}', numbers.current.repeatCs)
    .replaceAll('{{REPEAT_P50}}', numbers.current.repeatP50);

const layout = (page, html) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(page.title)} · accrete docs</title>
<meta name="description" content="${escape(page.description)}" />
<link rel="canonical" href="${SITE}${page.url}" />
<meta property="og:title" content="${escape(page.title)} · accrete docs" />
<meta property="og:description" content="${escape(page.description)}" />
<meta property="og:image" content="${SITE}/og.jpg" />
<meta name="theme-color" content="#f38020" />
<link rel="icon" type="image/png" href="/favicon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="stylesheet" href="/docs/docs.css" />
</head>
<body>
<header class="top"><a class="brand" href="/">accrete</a><nav><a href="/docs/">Docs</a><a href="/docs/tutorials/first-deploy/">Tutorial</a><a href="/docs/how-to/use-with-pi/">Pi extension</a><a href="https://github.com/acoyfellow/accrete">GitHub</a></nav></header>
<div class="crumbs"><a href="/docs/">Docs</a>${page.url === '/docs/' ? '' : ` / ${SECTION_TITLES[page.section]} / <b>${escape(page.title)}</b>`}</div>
<div class="wrap">
<aside class="side"><button class="menu" onclick="document.body.classList.toggle('open')">Menu</button><nav>${nav(page)}</nav></aside>
<main><p class="kind">${SECTION_TITLES[page.section]}</p>${html}<p class="edit"><a href="https://github.com/acoyfellow/accrete/edit/main/docs/${page.file}">Edit this page</a></p></main>
<aside class="toc">${toc(html)}</aside>
</div>
</body>
</html>
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'docs.css'), readFileSync('docs/docs.css', 'utf8'));
for (const page of pages) {
  const html = marked.parse(fill(page.body));
  const dir = join(OUT, page.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), layout(page, html));
}
const urls = ['/', ...pages.map((page) => page.url)];
writeFileSync('client/public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${SITE}${url}</loc></url>`).join('')}</urlset>\n`);
console.log(`docs: ${pages.length} pages`);
