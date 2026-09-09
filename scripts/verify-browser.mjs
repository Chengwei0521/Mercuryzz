import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.VERIFY_URL || 'http://127.0.0.1:5173';
const output = new URL('../artifacts/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--use-angle=metal'],
});
const errors = [];
const results = { url: base, checks: [], temporarySignalId: null };
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

async function canvasPixels(target) {
  return target.locator('#scene canvas').evaluate((canvas) => {
    const copy = document.createElement('canvas');
    copy.width = 64; copy.height = 64;
    const ctx = copy.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let nonblank = 0; let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 200 && data[i] + data[i + 1] + data[i + 2] > 70) nonblank++;
      sum += data[i] + data[i + 1] + data[i + 2];
    }
    return { nonblank, sum };
  });
}

try {
  await page.goto(base, { waitUntil: 'networkidle', timeout: 45000 });
  await page.locator('#scene-wrap.ready').waitFor({ timeout: 30000 });
  await page.locator('.signal-card').first().waitFor({ timeout: 20000 });
  await page.screenshot({ path: new URL('desktop.png', output).pathname, fullPage: true });
  const initial = await canvasPixels(page);
  assert.ok(initial.nonblank > 400, `Planet is blank: ${JSON.stringify(initial)}`);
  results.checks.push({ name: 'Desktop renders real texture', ...initial });
  assert.equal(await page.locator('vite-error-overlay').count(), 0);

  for (const mode of ['nightfall', 'contours', 'surface']) {
    await page.locator(`[data-mode="${mode}"]`).click();
    await page.waitForTimeout(1700);
    const pixels = await canvasPixels(page);
    assert.ok(pixels.nonblank > 180);
    await page.screenshot({ path: new URL(`${mode}.png`, output).pathname });
    results.checks.push({ name: `${mode} mode`, ...pixels });
  }
  await page.locator('#reset-view').click();
  await page.waitForTimeout(1800);
  const beforeCoordinates = await page.locator('#coordinates').innerText();
  const canvas = await page.locator('#scene canvas').boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width / 2 + 110, canvas.y + canvas.height / 2 + 35, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  assert.notEqual(await page.locator('#coordinates').innerText(), beforeCoordinates);
  results.checks.push({ name: 'Drag rotates globe and updates coordinates' });

  await page.locator('#zoom-in').click();
  await page.waitForTimeout(650);
  await page.locator('#focus-view').click();
  assert.ok(await page.locator('body').evaluate((body) => body.classList.contains('focused')));
  await page.keyboard.press('Escape');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#capture').click();
  const download = await downloadPromise;
  await download.saveAs(new URL('observation.png', output).pathname);
  assert.match(download.suggestedFilename(), /mercury-observation.*\.png/);
  results.checks.push({ name: 'Focus view, zoom and PNG export' });

  if (process.env.VERIFY_WRITE === '1') {
    const receiver = await context.newPage();
    await receiver.goto(base, { waitUntil: 'networkidle' });
    await receiver.locator('#network-state[data-state="live"]').waitFor({ timeout: 20000 });
    const callsign = `Orbit check ${Date.now()}`;
    await page.locator('#leave-signal').click();
    await page.locator('#callsign').fill(callsign);
    await page.locator('#signal-message').fill('From Earth, with curiosity. \u5730\u7403\u6765\u4fe1\u3002');
    await page.locator('input[name="mood"][value="curiosity"]').check();
    await page.locator('#send-signal').click();
    await page.waitForFunction(() => !document.querySelector('#compose-dialog').open, { timeout: 20000 });
    await receiver.getByText(callsign, { exact: true }).waitFor({ timeout: 15000 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText(callsign, { exact: true }).click();
    const label = await page.locator('#read-id').innerText();
    results.temporarySignalId = Number(label.match(/(\d+)$/)[1]);
    await writeFile(new URL('verification.json', output), JSON.stringify(results, null, 2));
    assert.match(await page.locator('#read-message').innerText(), /From Earth/);
    await page.locator('#share-signal').click();
    await page.locator('[data-close="read-dialog"]').click();
    await page.goto(`${base}/#signal=${results.temporarySignalId}`, { waitUntil: 'networkidle' });
    await page.locator('#read-dialog[open]').waitFor();
    assert.equal(await page.locator('#read-name').innerText(), callsign);
    await page.locator('#locate-signal').click();
    results.checks.push({ name: 'Public write, cross-tab realtime, reload persistence and deep link' });
    await receiver.close();
  }

  await page.locator('[data-filter="hope"]').click();
  assert.ok(await page.locator('.signal-card.hope').count() >= 1);
  assert.equal(await page.locator('.signal-card.wonder').count(), 0);
  await page.locator('#signal-search').fill('no-signal-with-this-phrase');
  assert.equal(await page.locator('.signal-card').count(), 0);
  await page.locator('#signal-search').fill('');
  await page.locator('[data-filter="all"]').click();
  results.checks.push({ name: 'Search, frequency filters and empty state' });

  for (const [width, height] of [[390, 844], [320, 740], [768, 1024], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('#scene-wrap.ready').waitFor();
    await page.waitForTimeout(2000);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `Horizontal overflow at ${width}`);
    const pixels = await canvasPixels(page);
    assert.ok(pixels.nonblank > 250, `Blank planet at ${width}`);
    await page.screenshot({ path: new URL(`viewport-${width}.png`, output).pathname, fullPage: true });
    await page.locator('#leave-signal').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: new URL(`compose-${width}.png`, output).pathname });
    const dialogOverflow = await page.locator('#compose-dialog').evaluate((dialog) => dialog.scrollWidth > dialog.clientWidth);
    assert.equal(dialogOverflow, false, `Dialog overflow at ${width}`);
    await page.locator('[data-close="compose-dialog"]').click();
    results.checks.push({ name: `Responsive ${width}x${height}`, ...pixels });
  }

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(base, { waitUntil: 'networkidle' });
  await touchPage.locator('#scene-wrap.ready').waitFor();
  await touchPage.locator('#reset-view').click();
  await touchPage.waitForTimeout(1800);
  const touchRect = await touchPage.locator('#scene canvas').boundingBox();
  const touchBefore = await touchPage.locator('#coordinates').innerText();
  const cdp = await touchContext.newCDPSession(touchPage);
  const center = { x: touchRect.x + touchRect.width / 2, y: touchRect.y + touchRect.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...center, id: 1 }] });
  for (let step = 1; step <= 10; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x + step * 6, y: center.y + step, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touchPage.waitForTimeout(500);
  assert.notEqual(await touchPage.locator('#coordinates').innerText(), touchBefore);
  await touchPage.locator('#leave-signal').click();
  await touchPage.locator('#pick-coordinate').click();
  await touchPage.touchscreen.tap(center.x, center.y);
  await touchPage.locator('#compose-dialog[open]').waitFor();
  assert.ok((await touchPage.locator('#destination-coordinates').innerText()).includes('/'));
  await touchPage.locator('[data-close="compose-dialog"]').click();
  await touchPage.screenshot({ path: new URL('mobile-touch.png', output).pathname });
  results.checks.push({ name: 'Real touch input rotates globe and selects a signal coordinate' });
  await touchContext.close();

  const offlinePage = await context.newPage();
  await offlinePage.route('**/rest/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Temporary test outage"}' }));
  await offlinePage.goto(base, { waitUntil: 'networkidle' });
  await offlinePage.locator('#retry-signals:not([hidden])').waitFor({ timeout: 20000 });
  assert.match(await offlinePage.locator('#feed-status').innerText(), /UNAVAILABLE/);
  await offlinePage.unroute('**/rest/v1/**');
  await offlinePage.locator('#retry-signals').click();
  await offlinePage.locator('.signal-card').first().waitFor({ timeout: 15000 });
  results.checks.push({ name: 'Archive outage is visible and reconnect restores real data' });
  await offlinePage.close();

  assert.deepEqual(errors, [], `Browser errors: ${errors.join('\n')}`);
  results.checks.push({ name: 'No browser errors' });
  results.passed = true;
} catch (error) {
  results.passed = false;
  results.error = error.stack;
  results.browserErrors = errors;
  await page.screenshot({ path: new URL('failure.png', output).pathname, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(new URL('verification.json', output), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}
