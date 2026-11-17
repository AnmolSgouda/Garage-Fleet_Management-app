import 'dotenv/config';
import { createApp } from './backend/src/app.js';
import { fleetService } from './backend/src/services/fleetService.js';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  await fleetService.init();
  const app = createApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fleet Service Planning & Garage Server listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
