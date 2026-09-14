const supertest = require('supertest');
const { createApp } = require('../../app');

let appInstance;

function startTestServer(options = {}) {
  if (options.fresh || !appInstance) {
    const app = createApp();
    if (!options.fresh) appInstance = app;
    return supertest(app);
  }
  return supertest(appInstance);
}

function resetTestServer() {
  appInstance = null;
}

module.exports = { startTestServer, resetTestServer };
