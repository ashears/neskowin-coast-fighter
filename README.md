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

## Direct online rooms

Both players open the static game and choose **Online**. The host picks an arena and rules, then selects **Create invite**. The guest pastes that invite, selects **Generate reply**, and sends the reply back. The host pastes the reply and presses **Connect**. Once connected, each player picks a fighter and readies up.

The host's browser runs the match over a WebRTC data channel. No signaling server, WebSocket relay, or third-party connection service is required. A shared Wi-Fi network is the best starting point. Different networks, VPNs, or guest Wi-Fi isolation can prevent a direct connection. Keep the host tab open during the match.

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
