import app, { initializeApplication } from '../src/server.js';

let initializationPromise;

export default async function handler(request, response) {
  initializationPromise ||= initializeApplication();
  await initializationPromise;
  return app(request, response);
}
