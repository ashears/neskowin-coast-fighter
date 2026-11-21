# Neskowin Coast Fighter

Oregon Coast landmarks become fighters in a browser game built on the [2D Fighter Framework](https://github.com/ashears/2d-fighter-framework). Proposal Rock charges through close fights, The Chelan throws beach balls, and The Ocean makes players jump incoming breakers.

## Play locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Choose **Campaign** to enter the Neskowin Coast Championship. Play as Proposal Rock, The Chelan, Duck Flag, Rip Rap, and The House in order. The bracket saves your clears and opens at your next bout. First wins earn shells to spend on palettes in the Coast shop.

Under **Multiplayer**, choose **Local versus** to share a keyboard or **Online** to invite a friend. All six fighters are available for CPU and versus matches. Touch controls work in solo and online play. Open **View Fighters and Controls** from the home screen for the roster and both keyboard layouts. Replay the last completed versus match from setup.

| Action | Player one or online | Local player two |
| --- | --- | --- |
| Move / jump | A, D, W | Left, Right, Up |
| Drop through a ledge | S + W | Down + Up |
| Air recovery | E | I |
| Guard | R | Right Shift |
| Light / heavy / special | F, G, H | J, K, L |

New versus matches use three lives on Proposal Rock and Breakwater Ridge. Damage makes fighters easier to launch, and leaving the arena costs a life. Some campaign bouts use health bars and rounds.

Use **Recover** on touch or the keyboard recovery input while airborne. Steer with left or right. Recovery is available once per airtime and costs no air jump. Proposal Rock and Duck Flag have a quick poke on Down + Light. Proposal Rock also uses Rock Chip in the air, and The House aims its aerial heavy upward.

## Signature moves

| Fighter | Restored moves |
| --- | --- |
| Proposal Rock | Starfish Mine arms behind you. Body Slam hits when you land. Hold and release Proposal Spin Charge to control its travel. |
| The Chelan | Beach Throw picks from six items with different arcs and impact. Chelanmania Driver grabs through guard and slams only when it connects. |
| Rip Rap | Spike Crown catches jump-ins on either side. Breakwater Boulder rolls along surfaces and falls off ledges. |
| Duck Flag | LaMichael Rush sends a runner down the beach. Hold and release Joey Harrington Pass to shape its arc. Mascot Moto Loop circles the target area and can hit more than once. |

The in-fight move guide shows each input, hold instructions, and cooldowns. The same framework definitions run these moves in local play, campaign fights, replays, and private rooms.

## Direct online rooms

Choose **Multiplayer** and then **Online**, pick an arena, then select **Copy invite link**. Send the link to your friend. It opens the multiplayer lobby and prepares their reply code. Your friend sends back that code. Paste it in your lobby and press **Connect** to choose fighters and ready up.

The host's browser runs the match over a direct WebRTC data channel. Pairing uses the invite link and reply code with no signaling or ICE servers. Use the same Wi-Fi for the best chance of connecting and keep the host tab open during the match.

## Code and verification

- `src/coast/content.ts` declares the roster, stages, moves, and match configurations used by both browser and relay.
- `src/coast/campaign.ts` authors the bracket, rival profiles, and rewards on top of the framework campaign API. Tournament progress and cosmetic purchases are saved in the browser.
- `src/coast/session.ts` connects controls and recordings to the framework. The Canvas renderer uses the existing coastal photographs and fighter art.
- `vendor/` pins the framework core, room protocol, and direct-room package. A clean install works independently of the framework checkout.

```sh
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The tests run every supported fighter and arena combination, play through all five tournament bouts, and exercise the production build on desktop and mobile. Browser coverage includes the tournament cast, retries, rewards, reload, the championship result, versus replay, and a private-room match and rematch.
