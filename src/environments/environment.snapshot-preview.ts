import { environment as defaults } from './environment.prod';

// Explicit opt-in design preview. Requests go only to the local fixture server.
export const environment = {
  ...defaults,
  production: false,
  integrations: {
    ...defaults.integrations,
    rest_api: { enabled: true, url: '/api' },
  },
};
