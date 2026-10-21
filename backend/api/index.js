import app, { initializeApplication } from '../src/server.js';

export default async function handler(request, response) {
  try {
    await initializeApplication();
  } catch (error) {
    // The application-level initializer clears its failed promise so later
    // requests can retry after a transient database outage.
    response.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
    return;
  }

  return app(request, response);
}
