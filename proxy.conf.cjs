// The browser uses the same /api URL in development and production.
// Compose sets the target to the REST API service on its internal network.
require('./scripts/load-env.cjs');

module.exports = {
  '/api/**': {
    target:
      process.env.WORKBENCH_FRONTEND_API_PROXY_TARGET ||
      'http://127.0.0.1:3000',
  },
};
