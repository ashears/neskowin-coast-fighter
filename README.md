# Neskowin Coast Fighter

Oregon Coast landmarks become fighters in a browser game built on the [2D Fighter Framework](https://github.com/ashears/2d-fighter-framework). Proposal Rock charges through close fights, The Chelan throws beach balls, and The Ocean makes players jump incoming breakers.

## Play locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Campaign follows five stops from Beach Cleanup to King Tide. First clears unlock campaign fighters and earn shells for local cosmetic palettes. All six fighters are available for versus and training. The game also supports CPU, two-player shared-keyboard versus, touch controls for solo and online play, frame and hitbox displays in training, and replay of the last completed versus match in the tab.

| Action | Player one or online | Local player two |
| --- | --- | --- |
| Move / jump | A, D, W | Left, Right, Up |
| Drop through a ledge | S + W | Down + Up |
| Guard | R | Right Shift |
| Light / heavy / special | F, G, H | J, K, L |

Health matches use rounds. Stock matches run on Proposal Rock and Breakwater Ridge with three lives, damage-scaled knockback, and respawn protection.

## Private rooms

Run the relay in another terminal and open the demo in two browser sessions.

```sh
npm run server
```

Choose **Online**, create a room, and share its eight-character code. Both players pick a fighter and ready up. The Node relay runs the same content and authoritative simulation and sends state snapshots to both browsers.

Deploy the static `dist/` directory with `VITE_ROOM_URL=wss://your-relay.example/rooms` set at build time for public online play. Run the relay separately with `HOST=0.0.0.0`, `PORT`, and `COAST_ROOM_ORIGINS` set to the origin of the static site. Use a TLS reverse proxy that forwards WebSocket upgrades. The relay exposes `GET /health`. GitHub Pages reads the `NESKOWIN_ROOM_URL` repository variable when it builds. Solo and local modes work without a relay.

## Code and verification

- `src/coast/content.ts` declares the roster, stages, moves, and match configurations used by both browser and relay.
- `src/coast/campaign.ts` implements campaign progression and the cleanup and tide-survival objectives with framework rule hooks. Older campaign clears are imported when valid. Wins and cosmetic purchases persist in local storage.
- `src/coast/session.ts` connects controls and recordings to the framework. The Canvas renderer uses the existing coastal photographs and fighter art.
- `vendor/` pins the core and relay to the public [v0.2.0 release](https://github.com/ashears/2d-fighter-framework/releases/tag/v0.2.0). A clean install works independently of the framework checkout.

```sh
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The tests run every supported fighter and arena combination, check custom objectives and save migration, replay an actual match, and exercise the production build on desktop and mobile. The browser suite also runs a complete match between two private-room clients with a rematch and disconnect.
