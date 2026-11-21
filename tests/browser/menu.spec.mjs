import { fileURLToPath } from 'node:url';
import { Button, createMatch, createRecording, SNAPSHOT_VERSION } from '@ashears/2d-fighter-framework';
import { expect, test } from '@playwright/test';
import { coastConfig } from '../../dist-server/content.js';

const heading = (page, name) => page.getByRole('heading', { name, exact: true });
const button = (page, name) => page.getByRole('button', { name, exact: true });

async function expectNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
}

test('home, campaign and arena layouts use desktop space and adapt on phones', async ({ page }, info) => {
  for (const [width, height] of [[1920, 1080], [1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto('./');
    const title = heading(page, 'Neskowin Coast Fighter');
    const lines = await title.evaluate((element) => {
      const text = document.createRange();
      text.selectNodeContents(element);
      return text.getClientRects().length;
    });
    if (width > 390) expect(lines).toBe(1);
    else expect(lines).toBeGreaterThan(1);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: info.outputPath(`home-${width}.png`) });

    await button(page, 'Campaign').click();
    await expect(heading(page, 'Ghost Forest Qualifier')).toBeVisible();
    const route = await page.locator('#campaign-route').boundingBox();
    const bracket = await page.locator('.campaign-bracket').boundingBox();
    const matchup = await page.locator('.campaign-matchup').boundingBox();
    if (width > 390) {
      expect(route.width).toBeGreaterThan(900);
      expect(bracket.x + bracket.width).toBeLessThan(matchup.x);
      await expect(button(page, 'Start bout')).toBeInViewport({ ratio: 1 });
    } else {
      expect(bracket.y + bracket.height).toBeLessThan(matchup.y);
    }
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: info.outputPath(`campaign-${width}.png`), fullPage: true });

    await button(page, 'Back to modes').click();
    await button(page, 'Fight CPU').click();
    await button(page, 'Choose arena').click();
    const preview = await page.locator('.arena-select-preview').boundingBox();
    const choices = await page.locator('#arena-choices').boundingBox();
    expect(preview.width / preview.height).toBeCloseTo(16 / 9, 1);
    if (width > 390) {
      expect(preview.width).toBeGreaterThan(650);
      expect(preview.x + preview.width).toBeLessThan(choices.x);
      await expect(button(page, 'Start fight')).toBeInViewport({ ratio: 1 });
    } else {
      expect(preview.y + preview.height).toBeLessThan(choices.y);
    }
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: info.outputPath(`arena-${width}.png`), fullPage: true });
  }
});

test('home guide and all three setup destinations restore focus and preserve selections', async ({ page }) => {
  await page.goto('./');
  const guide = button(page, 'View Fighters and Controls');
  await guide.press('Enter');
  await expect(heading(page, 'Fighters and controls')).toBeFocused();
  await expect(page.locator('#roster-list article')).toHaveCount(6);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('#shop')).toBeHidden();
  await button(page, 'Back to modes').click();
  await expect(guide).toBeFocused();

  await button(page, 'Fight CPU').click();
  await page.locator('#fighter-fields [data-pick="duck-flag"]').click();
  await button(page, 'Choose arena').click();
  const breakwater = button(page, 'Breakwater Ridge');
  await breakwater.click();

  for (const [label, title, target] of [
    ['Fighters', 'Fighters', 'roster'],
    ['Controls', 'Controls', 'controls'],
    ['Shop', 'Coast shop', 'shop'],
  ]) {
    const link = button(page, label);
    await link.click();
    await expect(heading(page, title)).toBeFocused();
    await expect(page.locator(`#${target}`)).toBeVisible();
    for (const id of ['roster', 'controls', 'shop'].filter((id) => id !== target)) {
      await expect(page.locator(`#${id}`)).toBeHidden();
    }
    await button(page, 'Back to setup').click();
    await expect(link).toBeFocused();
    await expect(breakwater).toHaveAttribute('aria-pressed', 'true');
  }

  await button(page, 'Back to fighters').click();
  await expect(button(page, 'Player one')).toContainText('Duck Flag');
});

test('the existing health-format replay still opens from versus setup', async ({ page }) => {
  const setup = { stage: 'proposal-rock', rule: 'health', fighters: ['proposal-rock', 'chelan'], seed: 17 };
  const { definition, rules } = coastConfig(setup.fighters, setup.stage, setup.rule, setup.seed);
  const match = createMatch(definition, rules);
  const inputs = [];
  while (match.snapshot().phase !== 'finished' && inputs.length < 1200) {
    const input = [Button.Left, 0];
    inputs.push(input);
    match.step(input);
  }
  expect(match.snapshot().winner).toBe(1);
  const fight = { setup, recording: createRecording(match, inputs) };
  await page.addInitScript(({ key, data }) => sessionStorage.setItem(key, JSON.stringify(data)), {
    key: `neskowin-coast-replay-v${SNAPSHOT_VERSION}`, data: fight,
  });
  await page.clock.install();
  await page.goto('./');
  await button(page, 'Fight CPU').click();
  await button(page, 'Replay last match').click();
  await expect(page.locator('#hud')).toHaveAttribute('data-stock', 'false');
  await page.clock.runFor(8000);
  await expect(heading(page, 'The Chelan wins')).toBeVisible();
  await expect(page.locator('#result-detail')).toHaveText('Rounds won: 0–2.');
});

test('an invite to an existing health-format room can still start a match', async ({ context }) => {
  test.setTimeout(35_000);
  const host = await context.newPage();
  const guest = await context.newPage();
  const modules = {
    core: '../../node_modules/@ashears/2d-fighter-framework/dist/',
    direct: '../../node_modules/@ashears/fighter-direct/dist/',
    relay: '../../node_modules/@ashears/fighter-relay/dist/',
    coast: '../../dist-server/',
  };

  await host.route('**/__legacy-host', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><script type="importmap">
      {"imports":{
        "@ashears/2d-fighter-framework":"/__legacy/core/index.js",
        "@ashears/fighter-relay/protocol":"/__legacy/relay/protocol.js"
      }}
    </script>`,
  }));
  await host.route('**/__legacy/*/*.js', (route) => {
    const [module, filename] = new URL(route.request().url()).pathname.split('/').slice(-2);
    return route.fulfill({
      path: fileURLToPath(new URL(modules[module] + filename, import.meta.url)),
      contentType: 'application/javascript',
    });
  });

  await host.goto('/__legacy-host');
  const invite = await host.evaluate(async () => {
    const { DirectRoomConnection, createInviteLink } = await import('/__legacy/direct/index.js');
    const { coastConfig, fighterIds, ruleIds, stageIds, supportsMatch } = await import('/__legacy/coast/content.js');
    const connection = new DirectRoomConnection({
      id: 'neskowin-platform-v2', fighters: fighterIds, stages: stageIds, rules: ruleIds,
      config: coastConfig, supports: supportsMatch,
    }, () => {}, () => {});
    window.legacyHost = connection;
    return createInviteLink(new URL('./', location.href).href, await connection.invite('ghost-forest', 'health'));
  });

  await guest.goto(invite);
  await expect(heading(guest, 'Multiplayer lobby')).toBeVisible();
  const reply = guest.locator('#pairing-code');
  await expect(reply).toHaveValue(/^FIGHT1\./, { timeout: 11_000 });
  await host.evaluate((code) => window.legacyHost.accept(code), await reply.inputValue());
  await expect(heading(guest, 'Private room')).toBeVisible();
  await host.evaluate(() => {
    window.legacyHost.send({ type: 'select', fighter: 'proposal-rock' });
    window.legacyHost.send({ type: 'ready', ready: true });
  });
  await guest.locator('#room-fighter [data-pick="chelan"]').click();
  await button(guest, 'Ready').click();
  await expect(guest.locator('#stage-name')).toHaveText('Ghost Forest');
  await expect(guest.locator('#hud')).toHaveAttribute('data-stock', 'false');
});
