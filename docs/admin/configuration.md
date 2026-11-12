# Frontend configuration

Frontend application settings are public JSON loaded before Angular starts.
Native commands and the production container generate this JSON from the same
validated configuration contract. Keep credentials in the REST API.

## Native development and static builds

Copy [template.env](../../template.env) to `.env` and uncomment the settings you need:

```bash
cp template.env .env
npm start
```

`npm start` and the npm build commands use `scripts/angular.mjs` to load the
repository `.env` and generate configuration and build metadata before Angular
starts. After a successful build, the wrapper restores any optional metadata export.
Shell variables take precedence over `.env`. Restart the dev server after changes.
All template entries are optional and commented out. `.env` and generated output
are excluded from Git and Docker build contexts.

The `generate:*` commands remain available for running generation directly.

## Public application settings

| Environment variable | JSON field | Default | Accepted values |
| --- | --- | --- | --- |
| `WORKBENCH_FRONTEND_API_URL` | `apiUrl` | `api` | Relative API path or HTTP(S) URL, without query or fragment. |
| `WORKBENCH_FRONTEND_ATTACK_WEBSITE_ENABLED` | `attackWebsiteEnabled` | `false` | `true` or `false`. |
| `WORKBENCH_FRONTEND_ATTACK_WEBSITE_URL` | `attackWebsiteUrl` | Development: `http://localhost:8000`; production: `https://attack.mitre.org` | HTTP(S) URL. |
| `WORKBENCH_FRONTEND_COLLECTION_MANAGER_ENABLED` | `collectionManagerEnabled` | `true` | `true` or `false`. |
| `WORKBENCH_FRONTEND_RECOMMENDED_INDEXES` | `recommendedIndexes` | MITRE ATT&CK index from `attack-stix-data` | JSON array of `{ "name": "...", "url": "https://..." }`; `[]` removes suggestions. |
| `WORKBENCH_FRONTEND_LOG_LEVEL` | `logLevel` | Development: `INFO`; production: `ERROR` | `TRACE`, `DEBUG`, `INFO`, `LOG`, `WARN`, `ERROR`, `FATAL`, `OFF`. |
| `WORKBENCH_FRONTEND_DEFAULT_LANDING_PAGE` | `defaultLandingPage` | Empty string | Internal route such as `tactic` or `matrix/<id>`; empty selects the standard landing page. |

Unset settings inherit defaults. Explicit `false`, `[]`, and an empty landing page
are meaningful overrides. Empty URLs, invalid booleans, malformed JSON, unknown
fields, and invalid log levels stop startup with an error. URL credentials are
not accepted. Frontend switches control presentation; backend permissions still
apply.

## Supplied JSON and precedence

Native commands read [src/assets/config.json](../../src/assets/config.json) by
default. `WORKBENCH_FRONTEND_CONFIG_FILE` selects a different input file. A partial
file such as `{"defaultLandingPage":"tactic"}` remains supported. The production
container reads `/etc/workbench/config.json` if present, or the file named by
`WORKBENCH_FRONTEND_CONFIG_FILE`. The development image uses the same optional
input through its `--container` startup flag, while still writing Angular's
`.generated/assets/config.json`. An explicitly selected missing file is an error.

Precedence, highest first:

- Native: shell variables, repository `.env`, supplied JSON, build defaults.
- Container: container variables, supplied JSON, build-mode defaults.

Arrays replace existing values. Supplied JSON must be valid even when an
environment variable overrides one of its fields. Every generation starts from
the original inputs, so removing an override restores its default or supplied
value. The input stays unchanged; validated output is replaced atomically.

Native output is `.generated/assets/config.json`, served or copied by Angular as
`/assets/config.json`. Static hosts can replace that served file and reload the
browser. Container startup writes `/usr/share/nginx/html/assets/config.json` before
Nginx starts. The same production image supports different settings without a
rebuild. Restart a directly configured container after changing mounted JSON;
recreate it after changing its environment. Reload the browser afterward. Serve
`/assets/config.json` without long-lived caching; the included Nginx configuration
uses `Cache-Control: no-store`.

## API routing

The browser uses same-origin `/api` by default. For native development,
`WORKBENCH_FRONTEND_API_PROXY_TARGET` selects the API origin (default
`http://127.0.0.1:3000`, without an `/api` suffix).

For Docker networking, Nginx proxying, and HTTPS setup, see the deployment
repository's [frontend configuration guide](https://github.com/mitre-attack/attack-workbench-deployment/blob/main/docs/configuration.md#frontend).

## Build information and build settings

Build metadata is generated separately in `.generated/assets/build-info.json` and
served at `/assets/build-info.json`. Production-container restarts and application
setting changes preserve the bundled version, commit, and build time.

| Build variable | Default | Purpose |
| --- | --- | --- |
| `WORKBENCH_FRONTEND_APP_VERSION` | `package.json` version | Public application version. |
| `WORKBENCH_FRONTEND_GIT_COMMIT` | Git HEAD, or `unknown` | Public source revision. |
| `WORKBENCH_FRONTEND_BUILD_DATE` | Current UTC time | Public build/start time; use an RFC 3339 timestamp. |
| `WORKBENCH_FRONTEND_BUILD_INFO_OUTPUT_PATH` | Unset | Also export metadata to this path, relative to the command's working directory. |

Metadata values are trimmed; empty metadata values use defaults. Docker build
arguments `VERSION`, `REVISION`, and `BUILDTIME` populate these namespaced controls
at build time. BuildKit also supplies `BUILDPLATFORM`, `TARGETOS`, and `TARGETARCH`.

```bash
docker build --build-arg VERSION=4.0.0 --build-arg REVISION=abc123 \
  --build-arg BUILDTIME=2026-10-10T12:00:00Z -t workbench-frontend .
```

`npm run build-prod` selects Angular production mode and optimizations.
Angular's `isDevMode()` determines the browser's configuration defaults. Setting
`NODE_ENV` does not select an Angular build configuration. Use npm commands to
include configuration generation; before direct Angular CLI commands, run
`npm run generate:build-info` and `npm run generate:configuration` (append
`-- --production` for production defaults).

## Deployment and release automation

Compose ports, image tags, env-file paths, and mounts belong in the
[deployment configuration guide](https://github.com/mitre-attack/attack-workbench-deployment/blob/main/docs/configuration.md).
The deployment repository embeds a copy of this repository's `template.env`
for both source and published-image setups. The commented `Template-Version`
identifies its revision separately from image versions. Releases do not attach a
template asset; embedded copies are maintained manually.

`GITHUB_TOKEN`, `GH_TOKEN`, `DOCKER_REGISTRY_USER`, `DOCKER_REGISTRY_PASSWORD`,
`GITHUB_REF_NAME`, and `HUSKY` remain release-tool controls. They are not public
frontend settings. Authentication and backend capabilities are configured through
the [REST API](https://github.com/mitre-attack/attack-workbench-rest-api/blob/next/docs/admin/configuration.md).

The real-server integration tests run only when `WORKBENCH_FRONTEND_TEST_API_URL`
is explicitly set in the shell or repository `.env`. There is no default endpoint.
Use an absolute HTTP(S) API URL (for example `http://localhost:5102/api`), because
these tests run in Node without the Angular proxy. An explicitly selected server
that is unreachable or returns an error fails the suite; missing seed tracks skip
only track-dependent cases. This is a test setting, not a public browser setting.
