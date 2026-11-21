# Neskowin Coast Fighter

Oregon Coast landmarks become fighters in a browser game built on the [2D Fighter Framework](https://github.com/ashears/2d-fighter-framework). Proposal Rock charges through close fights, The Chelan throws beach balls, and The Ocean makes players jump incoming breakers.

## Play locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Campaign follows five stops from Beach Cleanup to King Tide. First clears unlock campaign fighters and earn shells for local cosmetic palettes. All six fighters are available for versus. The game also supports CPU, two-player shared-keyboard versus, touch controls for solo and online play, and replay of the last completed versus match in the tab.

| Action | Player one or online | Local player two |
| --- | --- | --- |
| Move / jump | A, D, W | Left, Right, Up |
| Drop through a ledge | S + W | Down + Up |
| Guard | R | Right Shift |
| Light / heavy / special | F, G, H | J, K, L |

Health matches use rounds. Stock matches run on Proposal Rock and Breakwater Ridge with three lives, damage-scaled knockback, and respawn protection.

## Signature moves

| Fighter | Restored moves |
| --- | --- |
| Proposal Rock | Starfish Mine arms behind you. Body Slam hits when you land. Hold and release Proposal Spin Charge to control its travel. |
| The Chelan | Beach Throw picks from six items with different arcs and impact. Chelanmania Driver grabs through guard and slams only when it connects. |
| Rip Rap | Spike Crown catches jump-ins on either side. Breakwater Boulder rolls along surfaces and falls off ledges. |
| Duck Flag | LaMichael Rush sends a runner down the beach. Hold and release Joey Harrington Pass to shape its arc. Mascot Moto Loop circles the target area and can hit more than once. |

The in-fight move guide shows each input, hold instructions, and cooldowns. The same framework definitions run these moves in local play, campaign fights, replays, and private rooms.

## Direct online rooms

Choose **Online**, pick an arena and rules, then select **Copy invite link**. Send the link to your friend. It opens the multiplayer lobby and prepares their reply code. Your friend sends back that code. Paste it in your lobby and press **Connect** to choose fighters and ready up.

The host's browser runs the match over a direct WebRTC data channel. Pairing uses the invite link and reply code with no signaling or ICE servers. Use the same Wi-Fi for the best chance of connecting and keep the host tab open during the match.

## Code and verification

- `src/coast/content.ts` declares the roster, stages, moves, and match configurations used by both browser and relay.
- `src/coast/campaign.ts` implements campaign progression and the cleanup and tide-survival objectives with framework rule hooks. Older campaign clears are imported when valid. Wins and cosmetic purchases persist in local storage.
- `src/coast/session.ts` connects controls and recordings to the framework. The Canvas renderer uses the existing coastal photographs and fighter art.
- `vendor/` pins the framework core, room protocol, and direct-room package. A clean install works independently of the framework checkout.

```sh
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The tests run every supported fighter and arena combination, check custom objectives and save migration, replay an actual match, and exercise the production build on desktop and mobile. The browser suite also runs a complete match between two private-room clients with a rematch and disconnect.
