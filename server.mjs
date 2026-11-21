import { createRoomServer } from '@ashears/fighter-relay';
import { coastConfig, fighterIds, ruleIds, stageIds, supportsMatch } from './dist-server/content.js';

const origins = process.env.COAST_ROOM_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);
const rooms = createRoomServer({
  game: { fighters: fighterIds, stages: stageIds, rules: ruleIds, config: coastConfig, supports: supportsMatch },
  allowedOrigins: origins,
});
const boundary = await rooms.listen(Number(process.env.PORT ?? 8787), process.env.HOST ?? '127.0.0.1');
console.log(`Neskowin private rooms listening on port ${boundary.port}`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void rooms.close(); });
