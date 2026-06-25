import { NgxLoggerLevel } from 'ngx-logger';
export const environment = {
  production: true,
  log_level: NgxLoggerLevel.ERROR,
  recommended_indexes: [
    //recommended collection indexes shown to user if they have no indexes loaded
    {
      name: 'MITRE ATT&CK', //index name
      url: 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/index.json', //index url
    },
  ],
  integrations: {
    rest_api: {
      // configuration for the ATT&CK Workbench REST API
      // https://github.com/mitre-attack/attack-workbench-rest-api
      enabled: true, // MUST be true for application operation
      url: 'api',
    },
    collection_manager: {
      // configuration for the ATT&CK Workbench REST API Collection Manager
      enabled: true, // if false, all components for collection management will be disabled
    },
    attack_website: {
      // configuration for the ATT&CK Website
      // https://github.com/mitre-attack/attack-website
      enabled: false, // if false, attack website integration will be disabled
      url: 'https://attack.mitre.org',
    },
  },
};
