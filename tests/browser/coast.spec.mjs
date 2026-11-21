import { fileURLToPath } from 'node:url';
import { Button, createMatch, createRecording, playRecording } from '@ashears/2d-fighter-framework';
import { coastConfig } from '../../dist-server/content.js';
import { bouts, campaignKey } from '../../dist-server/campaign.js';
import { playBout } from '../tournament-player.mjs';
import { devices, expect, test } from '@playwright/test';

async function open(page) {
  const errors = [];
  page.on('pageerror', ({ message }) => errors.push(message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Choose a mode' })).toBeVisible();
  await expect(page.locator('#game-screen')).toBeHidden();
  await expect(page.locator('#viewport canvas')).toHaveCount(0);
  return errors;
}

async function chooseMultiplayer(page, mode) {
  const multiplayer = page.getByRole('button', { name: 'Multiplayer', exact: true });
  if (await multiplayer.getAttribute('aria-expanded') === 'false') await multiplayer.click();
  await page.getByRole('button', { name: mode, exact: true }).click();
}

async function hold(page, key, milliseconds) {
  await page.keyboard.down(key);
  await page.clock.runFor(milliseconds);
  await page.keyboard.up(key);
  await page.clock.runFor(100);
}

async function installTournamentClock(page) {
  await page.addInitScript(() => {
    // Advance the production render loop one tick per input, with a fixed seed for both sides.
    let time = 0;
    let nextFrame;
    let held = 0;
    Object.defineProperty(performance, 'now', { value: () => time });
    window.requestAnimationFrame = (callback) => { nextFrame = callback; return 1; };
    window.cancelAnimationFrame = () => { nextFrame = undefined; };
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (array) => {
      if (!(array instanceof Uint32Array) || array.length !== 1) return getRandomValues(array);
      array[0] = 17;
      return array;
    };
    const keyCodes = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyR', 'KeyF', 'KeyG', 'KeyH'];
    window.playTournamentFrames = (frames) => {
      for (const frame of frames) {
        const changed = held ^ frame;
        for (const [index, code] of keyCodes.entries()) {
          if (changed & (1 << index)) {
            window.dispatchEvent(new KeyboardEvent(frame & (1 << index) ? 'keydown' : 'keyup', { code }));
          }
        }
        held = frame;
        time += 1000 / 60 + 0.00001;
        nextFrame?.(time);
      }
      if (!document.getElementById('result-view').hidden) held = 0;
    };
  });
}

const playFrames = (page, frames) => page.evaluate((inputs) => window.playTournamentFrames(inputs), frames);

test('campaign plays from qualifier to championship and saves rewards', async ({ page }, info) => {
  await installTournamentClock(page);
  const errors = await open(page);
  await expect(page).toHaveTitle('Neskowin Coast Fighter');
  await expect(page.getByRole('heading', { name: 'Neskowin Coast Fighter' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('desktop-menu.png') });
  const modeMenu = page.locator('#mode-screen button');
  await expect(modeMenu.first()).toHaveAccessibleName('Campaign');
  await modeMenu.first().click();
  await expect(page.locator('#viewport canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Beach Access Showdown Locked' })).toBeDisabled();
  await expect(page.locator('#rival-heading')).toHaveText('The Chelan');
  await page.screenshot({ path: info.outputPath('desktop-bracket.png') });

  const start = page.getByRole('button', { name: 'Start bout' });
  await expect(page.locator('#fighter-fields')).toBeHidden();
  const qualifier = bouts[0];
  await expect(page.locator('#player-heading')).toHaveText('Proposal Rock');
  await start.click();
  await expect(page.locator('#viewport canvas')).toBeVisible();
  await playFrames(page, playBout(qualifier, 17, true).frames);
  await expect(page.getByRole('heading', { name: 'Bout lost' })).toBeFocused();
  await expect(page.locator('#game-panel, #field-guide, #shop').filter({ visible: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry bout' }).click();
  await expect(page.locator('.hud-badge').first()).toHaveText('Proposal Rock');
  await playFrames(page, playBout(qualifier).frames);
  await expect(page.getByRole('heading', { name: 'Bout won' })).toBeFocused();
  await expect(page.locator('#result-detail')).toContainText('Next, you play as The Chelan.');
  await expect(page.getByRole('status')).toHaveText('Earned 60 shells.');
  await page.getByRole('button', { name: 'Next bout' }).click();
  await expect(page.locator('#bout-heading')).toBeFocused();
  await expect(page.locator('#bout-heading')).toHaveText(bouts[1].title);
  await expect(page.locator('#player-heading')).toHaveText('The Chelan');
  await expect(page.locator('#game-panel')).toBeHidden();
  const shop = page.getByRole('button', { name: 'Shop', exact: true });
  await shop.click();
  await expect(page.getByRole('heading', { name: 'Coast shop' })).toBeFocused();
  await page.getByRole('button', { name: 'Daybreak · 60 shells' }).click();
  await expect(page.getByRole('button', { name: 'Daybreak · Equipped' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Back to setup' }).click();
  await expect(shop).toBeFocused();

  await page.reload();
  await page.getByRole('button', { name: 'Campaign', exact: true }).click();
  const firstBout = page.getByRole('button', { name: 'Ghost Forest Qualifier Cleared' });
  const nextBout = page.getByRole('button', { name: 'Beach Access Showdown Ready' });
  await expect(firstBout).toBeEnabled();
  await expect(nextBout).toHaveAttribute('aria-pressed', 'true');
  await firstBout.click();
  await expect(firstBout).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#player-heading')).toHaveText('Proposal Rock');
  await start.click();
  await playFrames(page, playBout(qualifier).frames);
  await expect(page.getByRole('heading', { name: 'Bout won' })).toBeVisible();
  await expect(page.locator('#status')).toBeEmpty();
  await page.getByRole('button', { name: 'Next bout' }).click();

  for (const [index, bout] of bouts.slice(1).entries()) {
    const assigned = ['The Chelan', 'Duck Flag', 'Rip Rap', 'The House'][index];
    const { frames, firstWaveWarning } = playBout(bout);
    await expect(page.locator('#bout-heading')).toHaveText(bout.title);
    await expect(page.locator('#player-heading')).toHaveText(assigned);
    await start.click();
    await expect(page.locator('.hud-badge').first()).toHaveText(assigned);
    if (bout.opponent === 'ocean') {
      await playFrames(page, frames.slice(0, firstWaveWarning));
      await expect(page.locator('#objective')).toHaveText('Sneaker Wave incoming · Jump');
      await page.screenshot({ path: info.outputPath('king-tide.png') });
      await playFrames(page, frames.slice(firstWaveWarning));
    } else {
      await playFrames(page, frames);
      await expect(page.getByRole('heading', { name: 'Bout won' })).toBeVisible();
      await page.getByRole('button', { name: 'Next bout' }).click();
      await expect(page.locator('#game-panel')).toBeHidden();
    }
  }

  await expect(page.getByRole('heading', { name: 'Tournament Champion' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('champion.png') });
  await page.getByRole('button', { name: 'View bracket' }).click();
  await expect(page.locator('#bracket-progress')).toHaveText('Tournament Champion');
  await expect(page.locator('#route-bouts [data-state="cleared"]')).toHaveCount(5);
  await shop.click();
  await expect(page.getByRole('button', { name: 'Daybreak · Equipped' })).toBeVisible();
  await expect(page.locator('#shell-balance')).toHaveText('180 shells');
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), campaignKey);
  expect(saved.completed).toEqual(bouts.map(({ id }) => id));
  expect(errors).toEqual([]);
});

test('local stock match completes and can be replayed from a saved recording', async ({ page }) => {
  await page.clock.install();
  const errors = await open(page);
  await chooseMultiplayer(page, 'Local versus');
  await page.getByRole('button', { name: 'Choose arena' }).click();
  const arena = page.getByRole('group', { name: 'Arena', exact: true });
  const proposal = arena.getByRole('button', { name: 'Proposal Rock', exact: true });
  await expect(proposal).toHaveAttribute('aria-pressed', 'true');
  await expect(arena.getByRole('button')).toHaveCount(2);
  await expect(arena.getByRole('button', { name: 'Breakwater Ridge' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Rules' })).toHaveCount(0);
  await expect(page.locator('#format-name')).toHaveText('Three lives');
  await expect(page.locator('#format-description')).toContainText('Leaving the arena costs a life.');
  await page.getByRole('button', { name: 'Start fight' }).click();
  await hold(page, 'a', 7600);
  await expect(page.getByRole('heading', { name: 'The Chelan wins' })).toBeVisible();
  await expect(page.locator('#result-arena')).toHaveText('Proposal Rock');
  await expect(page.locator('#result-detail')).toHaveText('Lives remaining: 0–3.');
  await expect(page.locator('#game-panel')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Choose a mode' })).toBeVisible();
  await chooseMultiplayer(page, 'Local versus');
  await page.getByRole('button', { name: 'Replay last match' }).click();
  await page.clock.runFor(8000);
  await expect(page.getByRole('heading', { name: 'The Chelan wins' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile campaign accepts touch input and fits without overflow', async ({ browser }, info) => {
  const context = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' });
  try {
    const page = await context.newPage();
    await page.clock.install();
    const errors = await open(page);
    for (const button of await page.locator('#mode-screen button:visible').all()) await expect(button).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: info.outputPath('mobile-menu.png') });
    await page.getByRole('button', { name: 'Multiplayer', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Local versus', exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Online', exact: true })).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: 'Multiplayer', exact: true }).tap();
    await page.getByRole('button', { name: 'Campaign', exact: true }).tap();
    await page.getByRole('button', { name: 'Start bout' }).tap();
    await expect(page.locator('#active-heading')).toHaveText('Ghost Forest Qualifier');
    await expect(page.locator('#game-nav')).toBeHidden();
    await expect(page.locator('#shop')).toBeHidden();
    await expect(page.locator('#game-panel')).toBeInViewport({ ratio: 1 });
    const heavy = page.getByRole('button', { name: 'Heavy attack' });
    await heavy.scrollIntoViewIfNeeded();
    const { x, y, width, height } = await heavy.boundingBox();
    const touch = await context.newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: x + width / 2, y: y + height / 2 }],
    });
    await page.clock.runFor(60);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#move-guide [data-move=heavy]')).toHaveText(/2s/);
    expect(await page.locator('body').evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: info.outputPath('mobile.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('a shared link opens the Neskowin lobby, then players can play and rematch', async ({ browser }) => {
  test.setTimeout(45_000);
  const left = await browser.newContext();
  const right = await browser.newContext();
  try {
    const host = await left.newPage();
    const guest = await right.newPage();
    const guestErrors = [];
    guest.on('pageerror', ({ message }) => guestErrors.push(message));
    const errors = [await open(host), guestErrors];
    await chooseMultiplayer(host, 'Online');
    const externalSockets = [];
    for (const page of [host, guest]) page.on('websocket', ({ url }) => externalSockets.push(url));
    await left.grantPermissions(['clipboard-read', 'clipboard-write']);
    await host.getByRole('button', { name: 'Copy invite link' }).click();
    await expect(host.getByRole('status')).toHaveText('Invite link copied.', { timeout: 11_000 });
    const invite = await host.evaluate(() => navigator.clipboard.readText());
    expect(invite).toBe(await host.locator('#pairing-code').inputValue());
    expect(new URL(invite).hash).toMatch(/^#invite=FIGHT1\./);
    await guest.goto(invite);
    await expect(guest.getByRole('heading', { name: 'Multiplayer lobby' })).toBeVisible();
    await expect(guest.locator('#game-panel')).toBeHidden();
    await expect(guest.locator('#setup-form')).toBeHidden();
    expect(new URL(guest.url()).hash).toBe('');
    await expect(guest.locator('#pairing-code')).toHaveValue(/^FIGHT1\./, { timeout: 11_000 });
    const reply = await guest.locator('#pairing-code').inputValue();
    await host.locator('#reply-input').fill(invite);
    await host.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(host.getByRole('status')).toContainText('full reply code');
    await host.locator('#reply-input').fill(reply);
    await host.getByRole('button', { name: 'Connect', exact: true }).click();
    for (const page of [host, guest]) await expect(page.getByRole('heading', { name: 'Private room' })).toBeVisible();
    await expect(host.locator('#game-panel')).toBeHidden();
    expect(externalSockets).toEqual([]);
    await Promise.all([
      host.locator('#room-fighter [data-pick=the-house]').click(),
      guest.locator('#room-fighter [data-pick=duck-flag]').click(),
    ]);
    for (const page of [host, guest]) await page.getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(host.locator('#session-label')).toHaveText('Online · P1');
    await expect(guest.locator('#session-label')).toHaveText('Online · P2');
    await expect(guest.locator('#room-move-guide')).toContainText('LaMichael Rush');
    await guest.keyboard.press('f');
    await expect(host.locator('.hud-value').first()).toHaveText('11% · 3 lives', { timeout: 5000 });
    await expect(guest.locator('.hud-value').first()).toHaveText('11% · 3 lives');
    await guest.keyboard.down('d');
    await expect(guest.getByRole('heading', { name: 'The House wins' })).toBeVisible({ timeout: 12_000 });
    await guest.keyboard.up('d');
    await expect(host.getByRole('heading', { name: 'The House wins' })).toBeVisible();
    for (const page of [host, guest]) await page.getByRole('button', { name: 'Rematch' }).click();
    await expect(guest.locator('#session-label')).toHaveText('Online · P2');
    await expect(guest.locator('#arena')).toBeFocused();
    await guest.getByRole('button', { name: 'Leave room' }).click();
    await expect(host.getByRole('status')).toHaveText('Your opponent left the room.');
    expect(externalSockets).toEqual([]);
    expect(errors).toEqual([[], []]);
  } finally {
    await Promise.all([left.close(), right.close()]);
  }
});

test('CPU mode runs from the keyboard and can return to setup', async ({ page }) => {
  await page.clock.install();
  const errors = await open(page);
  await page.getByRole('button', { name: 'Fight CPU', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Choose fighters' })).toBeFocused();
  await page.getByRole('button', { name: 'Choose arena' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Choose arena' })).toBeFocused();
  await page.getByRole('button', { name: 'Start fight' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#session-label')).toHaveText('CPU fight');
  await hold(page, 'd', 560);
  await hold(page, 'g', 350);
  await expect(page.locator('#hud')).toBeVisible();
  await page.getByRole('button', { name: 'End session' }).click();
  await expect(page.getByRole('button', { name: 'Start fight' })).toBeFocused();
  await expect(page.locator('#game-panel')).toBeHidden();
  await page.getByRole('button', { name: 'Back to modes' }).click();
  await expect(page.getByRole('button', { name: 'Fight CPU', exact: true })).toBeFocused();
  await expect(page.locator('#game-screen')).toBeHidden();
  for (const [index, name] of ['Campaign', 'Fight CPU', 'Multiplayer'].entries()) {
    await expect(page.locator('#mode-screen button').nth(index)).toHaveAccessibleName(name);
  }
  await chooseMultiplayer(page, 'Local versus');
  await expect(page.getByRole('button', { name: 'Choose arena' })).toBeVisible();
  await expect(page.locator('#game-panel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('multiplayer groups both modes and restores focus when backing out', async ({ page }) => {
  const errors = await open(page);
  const multiplayer = page.getByRole('button', { name: 'Multiplayer', exact: true });
  const local = page.getByRole('button', { name: 'Local versus', exact: true });
  const online = page.getByRole('button', { name: 'Online', exact: true });
  await expect(local).toBeHidden();
  await expect(online).toBeHidden();
  await multiplayer.press('Enter');
  await expect(multiplayer).toBeFocused();
  await expect(multiplayer).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('heading', { name: 'Choose a mode' })).toBeVisible();
  await expect(local).toHaveAccessibleDescription('Two players on one keyboard.');
  await expect(online).toHaveAccessibleDescription('Invite a friend to a private match.');
  await local.press('Enter');
  await expect(page.getByRole('heading', { name: 'Choose fighters', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Back to multiplayer' }).click();
  await expect(local).toBeFocused();
  await online.press('Enter');
  await expect(page.getByRole('heading', { name: 'Choose arena', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Back to multiplayer' }).click();
  await expect(online).toBeFocused();
  await online.press('Escape');
  await expect(multiplayer).toBeFocused();
  await expect(multiplayer).toHaveAttribute('aria-expanded', 'false');
  await expect(online).toBeHidden();
  expect(errors).toEqual([]);
});

test('multiplayer keeps local play available when the browser lacks online rooms', async ({ page }) => {
  await page.addInitScript(() => { window.RTCPeerConnection = undefined; });
  const errors = await open(page);
  await page.getByRole('button', { name: 'Multiplayer', exact: true }).click();
  const online = page.getByRole('button', { name: 'Online', exact: true });
  await expect(online).toBeDisabled();
  await expect(online).toHaveAccessibleDescription('This browser does not support online rooms.');
  await page.getByRole('button', { name: 'Local versus', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Choose arena' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('fighter portraits follow selection and keyboard navigation reaches setup', async ({ page }) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'Fight CPU', exact: true }).click();
  await page.getByRole('button', { name: 'Back to modes' }).focus();
  await page.keyboard.press('Shift+Tab');
  const skip = page.getByRole('link', { name: 'Skip to game setup' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#setup')).toBeFocused();
  const picker = page.locator('#fighter-fields');
  const p1 = picker.getByRole('button', { name: 'Player one', exact: true });
  const cpu = picker.getByRole('button', { name: 'CPU fighter', exact: true });
  await picker.getByRole('button', { name: 'Proposal Rock', exact: true }).press('ArrowRight');
  await expect(picker.getByRole('button', { name: 'The Chelan', exact: true })).toBeFocused();
  await picker.getByRole('button', { name: 'Duck Flag', exact: true }).click();
  await expect(p1).toContainText('Duck Flag');
  const flag = p1.locator('img');
  await expect(flag).toHaveAttribute('src', /duck-flag-sprite/);
  await expect.poll(() => flag.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await cpu.press('Enter');
  await picker.getByRole('button', { name: 'Duck Flag', exact: true }).press('Enter');
  await expect(cpu).toContainText('Duck Flag');
  await expect(picker.locator('[data-pick=duck-flag] .fighter-select-badges')).toHaveText('P1 · CPU');
  expect(errors).toEqual([]);
});

test('invalid invites recover to online setup and the link remains selectable without clipboard access', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
  await page.goto('./#invite=invalid');
  await expect(page.getByRole('status')).toHaveText('Use the full invite link from the host.');
  await page.getByRole('button', { name: 'Copy invite link' }).click();
  await expect(page.getByRole('status')).toHaveText('Use Copy invite link to share your room.');
  await page.getByRole('button', { name: 'Copy invite link' }).click();
  const link = page.locator('#pairing-code');
  await expect(link).toBeFocused();
  const selection = await link.evaluate((field) => field.value.slice(field.selectionStart, field.selectionEnd));
  expect(selection).toBe(await link.inputValue());
  expect(new URL(selection).hash).toMatch(/^#invite=FIGHT1\./);
});

test('Proposal Rock’s landing slam and Duck Flag’s hold-to-pass work from the keyboard', async ({ page }) => {
  await page.clock.install();
  const errors = await open(page);
  await chooseMultiplayer(page, 'Local versus');
  await page.getByRole('button', { name: 'Player two', exact: true }).click();
  await page.locator('#fighter-fields [data-pick=duck-flag]').click();
  await page.getByRole('button', { name: 'Choose arena' }).click();
  await page.getByRole('button', { name: 'Start fight' }).click();
  await expect(page.locator('#move-guide')).toContainText('Starfish Mine');
  await expect(page.locator('#move-guide-two')).toContainText('Joey Harrington Pass');
  await expect(page.locator('#move-guide-two')).toContainText('Hold to charge');
  const quarterback = page.waitForResponse((response) => response.ok() && response.url().includes('duck-flag-quarterback-cutout'));
  await page.keyboard.down('k');
  await page.clock.runFor(350);
  await quarterback;
  await expect(page.locator('.hud-value').first()).toHaveText('0% · 3 lives');
  await page.keyboard.up('k');
  await page.clock.runFor(900);
  await expect(page.locator('.hud-value').first()).toHaveText('15% · 3 lives');
  await hold(page, 'd', 520);
  await page.keyboard.press('g');
  await page.clock.runFor(240);
  await expect(page.locator('.hud-value').last()).toHaveText('0% · 3 lives');
  await page.clock.runFor(500);
  await expect(page.locator('.hud-value').last()).toHaveText('25% · 3 lives');
  expect(errors).toEqual([]);
});

test('a held touch input summons and releases Duck Flag’s quarterback', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' });
  try {
    const page = await context.newPage();
    await page.clock.install();
    const errors = await open(page);
    await page.getByRole('button', { name: 'Fight CPU', exact: true }).tap();
    await page.locator('#fighter-fields [data-pick=duck-flag]').tap();
    const next = page.getByRole('button', { name: 'Choose arena' });
    await expect(next).toBeInViewport({ ratio: 1 });
    await next.tap();
    await expect(page.locator('#fighter-fields')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Start fight' })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.getByRole('button', { name: 'Back to fighters' }).tap();
    await expect(page.getByRole('button', { name: 'Player one', exact: true })).toContainText('Duck Flag');
    await next.tap();
    await page.getByRole('button', { name: 'Start fight' }).tap();
    const heavy = page.getByRole('button', { name: 'Heavy attack' });
    await heavy.scrollIntoViewIfNeeded();
    const { x, y, width, height } = await heavy.boundingBox();
    const touch = await context.newCDPSession(page);
    const quarterback = page.waitForResponse((response) => response.ok() && response.url().includes('duck-flag-quarterback-cutout'));
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + width / 2, y: y + height / 2 }] });
    await page.clock.runFor(350);
    await quarterback;
    await expect(heavy).toHaveAttribute('data-held', 'true');
    const charge = page.locator('#move-guide [data-move="heavy"]');
    await expect(charge).toContainText('Charging');
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(heavy).toHaveAttribute('data-held', 'false');
    await page.clock.runFor(200);
    await expect(charge).not.toContainText('Charging');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('Duck Flag summons and randomized throws produce identical Node and Chromium replays', async ({ page }) => {
  const { definition, rules } = coastConfig(['duck-flag', 'chelan'], 'ghost-forest', 'health', 58);
  const inputs = Array.from({ length: 288 }, (_, tick) => [
    tick < 26 ? Button.Heavy : tick === 75 ? Button.Special : tick === 130 ? Button.Light : 0,
    tick === 184 || tick === 235 ? Button.Heavy : 0,
  ]);
  const match = createMatch(definition, rules);
  const recording = createRecording(match, inputs);
  const expected = playRecording(definition, rules, recording);
  expect(expected.events.filter(({ type }) => type === 'projectile').length).toBeGreaterThanOrEqual(4);
  await page.route('**/__fighter-core/*.js', (route) => {
    const filename = new URL(route.request().url()).pathname.split('/').at(-1);
    const path = fileURLToPath(new URL(`../../node_modules/@ashears/2d-fighter-framework/dist/${filename}`, import.meta.url));
    return route.fulfill({ path, contentType: 'application/javascript' });
  });
  await open(page);
  const replay = await page.evaluate(async ({ definition, recording }) => {
    const core = await import('/__fighter-core/index.js');
    return core.playRecording(definition, core.healthRules, recording);
  }, { definition, recording });
  expect(replay).toEqual(expected);
});
