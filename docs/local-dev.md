# Local Development Documentation

This document outlines how to set up ATT&CK Workbench for local development. For information on installing and deploying the full application using Docker, please refer to the [Workbench Deployment Guide](https://github.com/mitre-attack/attack-workbench-deployment).

## Prerequisites

Before running the application locally, ensure you have the following set up:

1. Clone the required repositories
    - [attack-workbench-frontend](https://github.com/mitre-attack/attack-workbench-frontend) repository
    - [attack-workbench-rest-api](https://github.com/mitre-attack/attack-workbench-rest-api) repository alongside the frontend

2. Install the [recommended version](../README.md#requirements) of [Node.js](https://nodejs.org/)

3. Install MongoDB

    Follow the official [MongoDB installation guide](https://www.mongodb.com/docs/manual/installation/) to install MongoDB on your operating system.


## Configure and Run the REST API

#### 1. Install dependencies
    
Navigate to the `attack-workbench-rest-api` directory and run

```
npm install
```

#### 2. Configure the system

Configure the application using environment variables, a configuration file, or a combination. Please refer to the documentation on how to [Configure the System](https://github.com/mitre-attack/attack-workbench-rest-api?tab=readme-ov-file#step-3-configure-the-system) for more details.

For example, you can use a custom configuration to adapt to your specific environment:

- Create a `.rest-api-env` file:

    ```bash
    export DATABASE_URL=mongodb://localhost/attack-workspace
    export JSON_CONFIG_PATH="resources/sample-configurations/multiple-apikey-services.json"
    export WB_REST_SERVICE_ACCOUNT_CHALLENGE_APIKEY_ENABLE=true
    export NODE_EXTRA_CA_CERTS="path/to/cert.crt"    
    ```

- Ensure this file is sourced when starting the backend:

    ```bash
    source .rest-api-env
    ```

#### 3. Run the REST API

```
node ./bin/www
```

Or to run it in the background:

```
node ./bin/www &
```

## Setting Up the Frontend

#### 1. Install dependencies

Navigate to the project's root directory and run

```
npm install
```

#### 2. Run the frontend locally

```
ng serve
```

Open your browser and navigate to `http://localhost:4200`

### Build information

`ng serve` uses `src/assets/build-info.json`, which contains development
fallbacks. The repository's `npm run build` and `npm run build-prod` commands
generate `dist/app/browser/assets/build-info.json` after Angular finishes.
Provide release metadata through the same variables used by the Docker build:

```bash
APP_VERSION=4.20.0-beta.23 \
GIT_COMMIT=c2c017c146fae040caba559333b35536bfbd1189 \
BUILD_DATE=2026-08-05T15:13:49.915Z \
npm run build-prod
```

If variables are omitted, the generated asset uses the package version and
reports its commit and build date as `unknown`.

### Virtual snapshot design preview

Run `npm run preview:snapshots`, then open
<http://localhost:4300/dashboard/release-management/release-track--snapshot-preview>.
This opt-in configuration runs Angular on port 4300 and an in-memory fixture API
on loopback port 4311. It never proxies to the production or local REST API.
Normal `npm start` and build configurations are unchanged.

The preview includes a current quarantined draft, a tagged snapshot using another
deduplication strategy, and a tagged snapshot with quarantine enabled but no
conflicts. Open each card to compare contents and button visibility. The current
draft contains eleven distinct manifest objects: five members, three relationships,
two supporting objects, and one non-exported LinkById render dependency.
The source filter demonstrates seven Enterprise ATT&CK objects, three Research
extensions objects, and two objects whose source was not recorded. PowerShell
is one shared revision attributed to both component tracks, not a duplicate row.
Quarantine comparison serves two distinct exact STIX revisions, including changed
descriptions, platforms, and ATT&CK versions. Both can be inspected as raw JSON
or opened in the existing read-only detail dialog; **View in Object Library**
opens the ordinary object page without closing the comparison.
Quarantine selection simulates creating a new draft; earlier snapshots are preserved.
Restart the preview to reset its in-memory data. Other write operations are not
simulated and return an explicit preview-only error.

The identity and marking-definition fixtures return plain arrays unless the
request explicitly sets `includePagination=true`, which returns `{ data,
pagination }`. Detail dialogs load marking definitions without pagination; the
fixture includes the referenced statement marking so the dialog shows one
statement. Collection-index listings also return a plain array. When smoke-testing
View details, check console error logs and notifications as well as uncaught
exceptions: connector errors are caught and can leave the object visible.

All eleven manifest rows provide working **Preview** and **View in Object
Library** actions. The fixture serves typed current/exact object endpoints,
enriched relationship endpoints and their filtered lookups, identity field
options, and tactic technique listings. Supporting-object previews reuse the
identity and marking-definition views. `/relationship/:id` is a read-only detail
route, with no relationship creation or editing entry point.

Snapshot-history fixtures follow the current `next` contract: `tagged`, `limit`,
and `offset` select the returned page; `counts` describes the filtered history;
`latest_snapshot_modified` and `latest_tagged_snapshot_modified` identify the
unfiltered live snapshots. The draft-cleanup endpoint returns an empty operation
list so Releases can exercise its automatic refresh without simulated cleanup.

The complete-manifest mockup uses a **proposed**, not yet implemented production
response field on exact Workbench snapshot exports:

```typescript
content_manifest_entries: Array<{
  kind: 'primary' | 'secondary' | 'relationship' | 'supporting' | 'link_target';
  object_ref: string;
  object_modified?: string;
  stix?: object;
  source_tracks?: Array<{ track_id: string; track_name?: string }>;
}>;
```

Entries are combined by exact object ID and revision, retaining all roles and
recorded source tracks. Track IDs identify sources; names are display labels.
Absent origin metadata remains **Source not recorded** and is never reconstructed
from current component contents.
Non-exported dependencies remain visible; entries without payloads show their
exact reference rather than fetching a latest revision. The generated collection
projection is excluded. Production API responses currently omit this field;
the UI then shows the snapshot's exported graph and explicitly discloses that
non-exported render dependencies cannot be listed. A real complete-manifest read
contract is required before this design can provide full manifest browsing
against production data.


## Note: Recommended setup using Visual Studio Code Workspaces

To streamline your development workflow, you can configure a Visual Studio Code workspace for easier management of both the frontend and REST API repositories. Open VS Code in the `attack-workbench-frontend` directory, add the directory for the REST API repository, and save the workspace.

To automate terminal setups, ensure the "Restore Terminals" extension is installed in VS Code. Open the `.code-workspace` file in a text editor other than VS Code and configure the `restoreTerminals.runOnStartup` and `restoreTerminals.terminals` settings.

Example VS Code Workspace configuration:

```json
{
    "folders": [
        {
            "name": "attack-workbench-rest-api",
            "path": "attack-workbench-rest-api"
        },
        {
            "name": "attack-workbench-frontend",
            "path": "attack-workbench-frontend"
        }
    ],
    "settings": {
        "terminal.integrated.env.osx": {
            "DATABASE_URL": "mongodb://localhost/attack-workspace",
            "JSON_CONFIG_PATH": "resources/sample-configurations/multiple-apikey-services.json",
            "WB_REST_SERVICE_ACCOUNT_CHALLENGE_APIKEY_ENABLE": "true",
            "NODE_EXTRA_CA_CERTS": "path/to/cert.crt" 
        },
        "restoreTerminals.runOnStartup": true,
        "restoreTerminals.terminals": [
            {
                "splitTerminals": [
                    {
                        "name": "rest-api",
                        "commands": [
                            "cd ../../attack-workbench-rest-api/",
                            "git checkout develop",
                            "git pull",
                            "npm ci",
                            "source /path/to/.rest-api-env",
                            "node bin/www"
                        ]
                    }
                ]
            },
            {
                "splitTerminals": [
                    {
                        "name": "frontend",
                        "commands": [
                            "cd ../attack-workbench-frontend/",
                            "git checkout develop",
                            "git pull",
                            "npm ci",
                            "ng serve --open"
                        ]
                    }
                ]
            }
        ]
    }
}
```
