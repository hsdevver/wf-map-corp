import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1619, height: 1207 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://127.0.0.1:8080/workflow-intro/index.html?v=corp-chapters-visible-v1', {
  waitUntil: 'networkidle',
  timeout: 30000
});
await page.waitForTimeout(3000);

const state = await page.evaluate(() => {
  const modules = document.getElementById('modules');
  const grid = document.getElementById('intro-columns');
  const wraps = grid ? [...grid.querySelectorAll('.intro-module-wrap')] : [];
  const first = wraps[0]?.getBoundingClientRect();
  const modRect = modules?.getBoundingClientRect();
  return {
    layoutHiddenPath: document.documentElement.classList.contains('wf-layout-hidden-path'),
    wrapCount: wraps.length,
    modulesH: modRect?.height,
    firstVisible: first ? first.width > 20 && first.height > 20 && first.top < innerHeight : false,
    boardComplete: document.getElementById('intro-corporate-board')?.classList.contains('is-pop-complete'),
    modulesVisible: document.getElementById('viewport')?.classList.contains('is-modules-visible')
  };
});

console.log(state);
if (errors.length) console.log('errors', errors);
if (!state.wrapCount || !state.firstVisible) process.exit(1);

await browser.close();
