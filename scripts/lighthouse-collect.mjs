import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

const routes = ['/', '/notes/wordpress-migration-playbook/', '/tools/prime-factorizer/'];
export async function collectLighthouse({ origin, work, chromePath, lighthouse, launch }) {
  const address = new URL(origin);
  if (address.protocol !== 'http:' || address.hostname !== '127.0.0.1' || address.username || address.password || !isAbsolute(work)) throw Error('Local Lighthouse fixture and absolute temporary output required');
  const profile = await mkdtemp(join(work, 'chrome-'));
  let chrome;
  try {
    chrome = await launch({
      ...(chromePath ? { chromePath } : {}),
      userDataDir: profile,
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking'],
    });
    const rows = [];
    for (const [index, route] of routes.entries()) {
      const result = await lighthouse(origin + route, {
        port: chrome.port, logLevel: 'error', output: 'json', enableErrorReporting: false,
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      });
      if (!result?.lhr) throw Error('Lighthouse returned no result');
      const value = result.lhr;
      await writeFile(join(work, `lhr-${index}.json`), JSON.stringify(value, null, 2) + '\n');
      rows.push({ route: new URL(value.finalDisplayedUrl ?? value.finalUrl).pathname, lighthouseVersion: value.lighthouseVersion,
        scores: Object.fromEntries(Object.entries(value.categories).map(([key, category]) => [key, category.score])),
        lcpMs: value.audits['largest-contentful-paint'].numericValue, cls: value.audits['cumulative-layout-shift'].numericValue, runWarnings: value.runWarnings });
    }
    return rows;
  } finally {
    try { if (chrome) await chrome.kill(); }
    finally { await rm(profile, { recursive: true, force: true }); }
  }
}
