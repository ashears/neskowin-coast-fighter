# Neskowin Coast Fighter

Oregon Coast landmarks become fighters in a browser game built on the [2D Fighter Framework](https://github.com/ashears/2d-fighter-framework). Proposal Rock charges through close fights, The Chelan throws beach balls, and The Ocean makes players jump incoming breakers.

## Play locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Choose **Campaign** to enter the Neskowin Coast Championship. Start with Proposal Rock or Duck Flag and work through five bouts, from The Chelan at Ghost Forest to The Ocean at King Tide. Jump throws, use the ledges, recover offstage, and look for an opening after Sneaker Wave. First wins unlock rivals and earn shells to spend on palettes in the Coast shop. The bracket saves locally and opens at your next bout.

Under **Multiplayer**, choose **Local versus** to share a keyboard or **Online** to invite a friend. All six fighters are available for CPU and versus matches. Touch controls work in solo and online play. Replay the last completed versus match from its setup screen.

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

Choose **Multiplayer** and then **Online**, pick an arena and rules, then select **Copy invite link**. Send the link to your friend. It opens the multiplayer lobby and prepares their reply code. Your friend sends back that code. Paste it in your lobby and press **Connect** to choose fighters and ready up.

The host's browser runs the match over a direct WebRTC data channel. Pairing uses the invite link and reply code with no signaling or ICE servers. Use the same Wi-Fi for the best chance of connecting and keep the host tab open during the match.

## Code and verification

- `src/coast/content.ts` declares the roster, stages, moves, and match configurations used by both browser and relay.
- `src/coast/campaign.ts` authors the bracket, rival profiles, and rewards on top of the framework campaign API. Tournament progress and cosmetic purchases use a fresh local save.
- `src/coast/session.ts` connects controls and recordings to the framework. The Canvas renderer uses the existing coastal photographs and fighter art.
- `vendor/` pins the framework core, room protocol, and direct-room package. A clean install works independently of the framework checkout.

```sh
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The tests run every supported fighter and arena combination, play through all five tournament bouts, and exercise the production build on desktop and mobile. Browser coverage includes tournament retries, unlocks, reload, the championship result, versus replay, and a private-room match and rematch.
