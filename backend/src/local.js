import 'dotenv/config';
import app, { initializeApplication } from './server.js';

const port = Number(process.env.PORT || 3001);

try {
  await initializeApplication();
  app.listen(port, () => {
    console.log(`TDGLTE backend listening on http://localhost:${port}`);
  });
} catch (error) {
  console.error('Backend initialization error:', error);
  process.exit(1);
}
