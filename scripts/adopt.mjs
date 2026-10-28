import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { lift, configFromEnv } from '../extensions/pi/client.mjs';
import { readJson, verifySeal } from './receipt.mjs';

const checks = [];
const check = (name, pass, detail = {}) => {
  checks.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ` ${JSON.stringify(detail)}`}`);
};

const DIATAXIS = {
  overview: ['docs/index.md'],
  tutorials: ['docs/tutorials/first-deploy.md'],
  'how-to': ['docs/how-to/use-with-pi.md', 'docs/how-to/add-a-tool.md', 'docs/how-to/call-from-any-agent.md'],
  reference: ['docs/reference/http-api.md', 'docs/reference/recipe.md', 'docs/reference/pi-extension.md'],
  explanation: ['docs/explanation/workflows.md', 'docs/explanation/how-it-works.md', 'docs/explanation/limits.md'],
};

execFileSync('node', ['scripts/build-docs.mjs'], { stdio: 'ignore' });

for (const [section, files] of Object.entries(DIATAXIS)) {
  const missing = files.filter((file) => !existsSync(file) || !readFileSync(file, 'utf8').includes(`section: ${section}`));
  check(`docs ${section} pages exist with the right section`, missing.length === 0, { missing });
}

const pageUrls = Object.values(DIATAXIS).flat().map((file) => file.replace(new RegExp('^docs/'), '').replace(new RegExp('\\.md$'), '').replace(new RegExp('(^|/)index$'), ''));
const built = pageUrls.filter((slug) => existsSync(`client/public/docs/${slug === '' ? '' : `${slug}/`}index.html`));
check('every docs page renders to static HTML', built.length === pageUrls.length, { built: built.length, total: pageUrls.length });

const docsHtml = pageUrls.map((slug) => readFileSync(`client/public/docs/${slug === '' ? '' : `${slug}/`}index.html`, 'utf8')).join('\n');
const internalLinks = [...docsHtml.matchAll(new RegExp('href="(/docs/[^"#]*)"', 'g'))].map((match) => match[1]);
const broken = [...new Set(internalLinks)].filter((href) => !existsSync(`client/public${href.endsWith('/') ? `${href}index.html` : href}`));
check('no broken internal docs links', broken.length === 0, { broken });
check('docs pages leave no unfilled placeholders', !docsHtml.includes('{{'), {});

const view = readFileSync('client/src/view.ts', 'utf8');
check('home page links to /docs', view.includes('"/docs/"'), {});

const extension = readFileSync('extensions/pi/index.ts', 'utf8');
const extensionPackage = readJson('extensions/pi/package.json');
check('pi extension registers accrete_run and /accrete', extension.includes('name: "accrete_run"') && extension.includes('registerCommand("accrete"'), {});
check('pi extension is a pi package', extensionPackage.keywords.includes('pi-package') && extensionPackage.pi.extensions.includes('./index.ts'), {});
check('root package exposes the extension to pi install', readJson('package.json').pi?.extensions?.includes('./extensions/pi/index.ts') === true, {});

const config = configFromEnv();
if (config.ready) {
  const dir = 'bench';
  const first = await lift(config, { pkg: 'semver', version: '7.6.3', args: ['-i', 'minor', '1.4.7'], inputs: [], cwd: dir, write: false });
  const second = await lift(config, { pkg: 'semver', version: '7.6.3', args: ['-i', 'minor', '1.4.7'], inputs: [], cwd: dir, write: false });
  check('extension client lifts a tool and repeats with no boot', first.ok && second.ok && second.placement === 'built-tool' && second.containerSeconds === 0 && second.stdout.trim() === '1.5.0', { first: first.placement, second: second.placement, stdout: second.stdout });
} else {
  check('extension client live check (needs ACCRETE_URL and ACCRETE_TOKEN)', false, { reason: 'not configured' });
}

const workflows = readJson('bench/workflows/latest.json');
const rows = workflows.results;
check('workflow receipt is sealed', verifySeal(workflows), {});
check('workflow bench covers at least 4 workflows', rows.length >= 4, { count: rows.length });
check('every workflow matches npx output', rows.every((row) => row.sameOutput), { failing: rows.filter((row) => !row.sameOutput).map((row) => row.id) });
check('every repeat call ran with no boot and 0 container-seconds', rows.every((row) => row.repeat.allNoBoot && row.repeat.containerSeconds === 0), {});
check('repeat beats laptop npx on every workflow', rows.every((row) => row.repeat.p50Ms < row.local.p50Ms), { rows: rows.map((row) => [row.id, row.local.p50Ms, row.repeat.p50Ms]) });

const workflowsHtml = readFileSync('client/public/docs/explanation/workflows/index.html', 'utf8');
const shownFromReceipt = rows.every((row) => workflowsHtml.includes(`${row.repeat.p50Ms} ms`) && workflowsHtml.includes(`${row.local.p50Ms} ms`));
check('workflow numbers in docs come from the receipt', shownFromReceipt, {});

const honesty = (() => {
  try {
    execFileSync('node', ['scripts/honesty.mjs'], { stdio: 'pipe', env: process.env });
    return true;
  } catch {
    return false;
  }
})();
check('honesty gate still passes', honesty, {});

const failed = checks.filter((entry) => !entry.pass).length;
console.log(failed === 0 ? `ADOPT PASS: ${checks.length} checks` : `ADOPT FAIL: ${failed}/${checks.length}`);
process.exit(failed === 0 ? 0 : 1);
