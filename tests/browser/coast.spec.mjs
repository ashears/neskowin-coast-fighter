import { devices, expect, test } from '@playwright/test';

async function open(page) {
  const errors = [];
  page.on('pageerror', ({ message }) => errors.push(message));
  await page.goto('./');
  await expect(page.locator('#viewport canvas')).toBeVisible();
  return errors;
}

async function hold(page, key, milliseconds) {
  await page.keyboard.down(key);
  await page.clock.runFor(milliseconds);
  await page.keyboard.up(key);
  await page.clock.runFor(100);
}

test('campaign cleanup plays through, unlocks The Chelan, and restores progress on reload', async ({ page }, info) => {
  await page.clock.install();
  const errors = await open(page);
  await expect(page).toHaveTitle('Neskowin Coast Fighter');
  await expect(page.getByRole('button', { name: 'Start fight' })).toBeInViewport();
  await expect(page.locator('#portrait-one')).toHaveAttribute('data-fighter', 'proposal-rock');
  await expect(page.locator('#portrait-two img')).toBeVisible();
  await page.screenshot({ path: info.outputPath('desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Campaign', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Chelan Shore Locked' })).toBeDisabled();
  await page.getByRole('button', { name: 'Play stop' }).click();
  await expect(page.locator('#objective')).toContainText('Bottle');
  await hold(page, 'f', 60);
  await hold(page, 'd', 950);
  await hold(page, 'g', 55);
  await hold(page, 'a', 350);
  await hold(page, 'h', 55);
  await hold(page, 'd', 750);
  await hold(page, 'f', 60);
  await hold(page, 'a', 450);
  await hold(page, 'g', 55);
  await expect(page.getByRole('heading', { name: 'Stop cleared' })).toBeVisible();
  await expect(page.locator('#result-detail')).toContainText('The Chelan joined');
  await expect(page.locator('#shell-balance')).toHaveText('60 shells');
  await page.getByRole('button', { name: 'Daybreak · 60 shells' }).click();
  await expect(page.getByRole('button', { name: 'Daybreak · Equipped' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#shell-balance')).toHaveText('0 shells');
  await page.getByRole('button', { name: 'Next stop' }).click();
  await expect(page.locator('#objective')).toHaveText('Chelan Shore');
  await page.reload();
  await page.getByRole('button', { name: 'Campaign', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Beach Cleanup Cleared' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Chelan Shore 02' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#fighter-one option[value="chelan"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Daybreak · Equipped' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('local stock match completes and can be replayed from a saved recording', async ({ page }) => {
  await page.clock.install();
  const errors = await open(page);
  await page.getByRole('button', { name: 'Local', exact: true }).click();
  await page.getByRole('combobox', { name: 'Rules' }).selectOption('stock');
  await expect(page.getByRole('combobox', { name: 'Arena', exact: true })).toHaveValue('proposal-rock');
  await page.getByRole('button', { name: 'Start fight' }).click();
  await hold(page, 'a', 7600);
  await expect(page.getByRole('heading', { name: 'The Chelan wins' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Replay last match' }).click();
  await page.clock.runFor(8000);
  await expect(page.getByRole('heading', { name: 'The Chelan wins' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile practice accepts touch input and fits without overflow', async ({ browser }, info) => {
  const context = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' });
  try {
    const page = await context.newPage();
    await page.clock.install();
    const errors = await open(page);
    await expect(page.getByRole('button', { name: 'Start fight' })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: info.outputPath('mobile-setup.png'), fullPage: false });
    await page.getByRole('button', { name: 'Training', exact: true }).tap();
    await page.getByRole('button', { name: 'Start training' }).tap();
    await expect(page.locator('#hud .clock')).toHaveText('∞');
    await page.getByRole('button', { name: 'Light attack' }).tap();
    await page.clock.runFor(45);
    await expect(page.locator('#frame-data')).toContainText('Basalt Jab');
    expect(await page.locator('body').evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: info.outputPath('mobile.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('private rooms play a full match with the Neskowin roster and support rematch', async ({ browser }) => {
  const left = await browser.newContext();
  const right = await browser.newContext();
  try {
    const host = await left.newPage();
    const guest = await right.newPage();
    const errors = await Promise.all([open(host), open(guest)]);
    for (const page of [host, guest]) await page.getByRole('button', { name: 'Online', exact: true }).click();
    await host.getByRole('combobox', { name: 'Rules' }).selectOption('stock');
    await host.getByRole('button', { name: 'Create private room' }).click();
    await expect(host.locator('#code-display')).toHaveText(/^[A-Z2-9]{8}$/);
    await guest.getByLabel('Room code').fill(await host.locator('#code-display').textContent());
    await guest.getByRole('button', { name: 'Join room' }).click();
    await Promise.all([
      host.getByRole('combobox', { name: 'Your fighter' }).selectOption('the-house'),
      guest.getByRole('combobox', { name: 'Your fighter' }).selectOption('duck-flag'),
    ]);
    for (const page of [host, guest]) await page.getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(host.locator('#session-label')).toHaveText('Online · P1');
    await expect(guest.locator('#session-label')).toHaveText('Online · P2');
    await guest.keyboard.down('d');
    await expect(guest.getByRole('heading', { name: 'The House wins' })).toBeVisible({ timeout: 12_000 });
    await guest.keyboard.up('d');
    await expect(host.getByRole('heading', { name: 'The House wins' })).toBeVisible();
    for (const page of [host, guest]) await page.getByRole('button', { name: 'Rematch' }).click();
    await expect(guest.locator('#session-label')).toHaveText('Online · P2');
    await guest.getByRole('button', { name: 'Leave room' }).click();
    await expect(host.getByRole('status')).toHaveText('Your opponent left the room.');
    expect(errors).toEqual([[], []]);
  } finally {
    await Promise.all([left.close(), right.close()]);
  }
});

test('CPU mode runs from the keyboard and can return to setup', async ({ page }) => {
  await page.clock.install();
  const errors = await open(page);
  await page.getByRole('button', { name: 'Start fight' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#session-label')).toHaveText('CPU fight');
  await hold(page, 'd', 560);
  await hold(page, 'g', 350);
  await expect(page.locator('#hud')).toBeVisible();
  await page.getByRole('button', { name: 'End session' }).click();
  await expect(page.getByRole('button', { name: 'Start fight' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('fighter selection follows the preview and keyboard navigation reaches setup', async ({ page }) => {
  const errors = await open(page);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to game setup' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#setup')).toBeFocused();
  await page.getByRole('combobox', { name: 'Player one', exact: true }).selectOption('duck-flag');
  await expect(page.locator('#portrait-one')).toHaveAttribute('data-fighter', 'duck-flag');
  await expect(page.locator('#portrait-one .portrait-flag')).toBeVisible();
  await page.getByRole('combobox', { name: 'Player one', exact: true }).selectOption('the-house');
  await expect(page.locator('#portrait-one')).toHaveAttribute('data-fighter', 'the-house');
  await expect(page.locator('#portrait-one img')).toBeVisible();
  expect(errors).toEqual([]);
});
