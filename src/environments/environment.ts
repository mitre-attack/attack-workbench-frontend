import { NgxLoggerLevel } from 'ngx-logger';
// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  log_level: NgxLoggerLevel.INFO,
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
      url: 'http://localhost:3000/api',
    },
    collection_manager: {
      // configuration for the ATT&CK Workbench REST API Collection Manager
      enabled: true, // if false, all components for collection management will be disabled
    },
    attack_website: {
      // configuration for the ATT&CK Website
      // https://github.com/mitre-attack/attack-website
      enabled: false, // if false, the ATT&CK website integration will not work
      url: 'http://localhost:8000',
    },
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
