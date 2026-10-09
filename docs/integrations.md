# Integrations

The ATT&CK Workbench is designed to integrate with a variety of tools. This page provides documentation on how to set up such integrations.

Many ATT&CK Workbench integrations require that specific fields or values are present on your custom STIX data to use it properly. Depending on what data you have some objects may not be shown in integrations. Objects may not show up in integrations if they:

-   Support ATT&CK IDs but do not have one assigned
-   Are revoked or deprecated
-   Support platforms or tactics but are not assigned to any
-   Support mappings to techniques but do not feature any mappings

## Workbench REST API URLs

Depending on whether you are using the manual install or the docker install, and where Workbench has been deployed, the URLs you will be setting in your integrations will be different.

The following API routes are used with integrations to access STIX bundles representing the local knowledge base:

| Domain     | API Route                                     |
| :--------- | :-------------------------------------------- |
| Enterprise | `/api/stix-bundles/?domain=enterprise-attack` |
| Mobile     | `/api/stix-bundles/?domain=mobile-attack`     |
| ICS        | `/api/stix-bundles/?domain=ics-attack`        |

The host the routes are available at depends on how the Workbench has been installed and deployed:

| Deployment Type | Installation Type | Host (hostname:port)     |
| :-------------- | :---------------- | :----------------------- |
| local           | manual            | `http://localhost:3000`  |
| local           | docker            | `http://localhost`       |
| remote          | manual            | `{remote-hostname}:3000` |
| remote          | docker            | `{remote-hostname}`      |

For example, the enterprise STIX bundle of a manual installation running locally would be available at `http://localhost:3000/api/stix-bundles/?domain=enterprise-attack`. You can test the URL by opening it in your web browser while the Workbench is running - if it is correct you should see a JSON object as a response.

## ATT&CK Navigator Integration

The [ATT&CK Navigator](https://github.com/mitre-attack/attack-navigator) can be configured to display the contents of your local ATT&CK Workbench knowledge base.

### 1. Install ATT&CK Navigator

Clone the [ATT&CK Navigator](https://github.com/mitre-attack/attack-navigator) repository:

```bash
git clone https://github.com/mitre-attack/attack-navigator.git
```

### 2. Update Navigator Configuration

Edit the configuration file at `nav-app/src/assets/config.json` to connect to your ATT&CK Workbench REST API. Enable the `versions` section and add an entry for your Workbench data. Replace the `(Enterprise URL)`, `(Mobile URL)`, and `(ICS URL)` with your actual REST API endpoints (see [Workbench REST API URLs](#workbench-rest-api-urls)).


```json
{
    "versions": {
        "enabled": true,
        "entries": [
            {
                "name": "ATT&CK Workbench Data",
                "version": "14",
                "authentication": {
                    "enabled": true,
                    "serviceName": "navigator",
                    "apiKey": "sample-navigator-apikey"
                },
                "domains": [
                    {
                        "name": "Enterprise",
                        "identifier": "enterprise-attack",
                        "data": ["(Enterprise URL)"]
                    },
                    {
                        "name": "Mobile",
                        "identifier": "mobile-attack",
                        "data": ["(Mobile URL)"]
                    },
                    {
                        "name": "ICS",
                        "identifier": "ics-attack",
                        "data": ["(ICS URL)"]
                    }
                ]
            }
        ]
    }
}
```

### 3. Configure ATT&CK Workbench REST API Authentication

To allow Navigator to access your Workbench data, you must enable basic API key authentication in your REST API configuration.

1. Create or update your REST API configuration file. The REST API loads its configuration from the file specified by the `JSON_CONFIG_PATH` environment variable in your `.env` file. For example:

    ```bash
    JSON_CONFIG_PATH=/some/path/to/rest-api-service-config.json
    ```

    Make sure this path points to your actual configuration file. For more details on configuring the REST API, see the [Usage Documentation: Configuration](https://github.com/mitre-attack/attack-workbench-rest-api/blob/main/USAGE.md#configuration).

2. In your REST API config file, add a `basicApikey` section to the `serviceAuthn` block, specifying a service account for Navigator. Example:

    ```json
    {
    "serviceAuthn": {
        "basicApikey": {
        "enable": true,
        "serviceAccounts": [
            {
            "name": "navigator",
            "apikey": "sample-navigator-apikey",
            "serviceRole": "read-only"
            }
        ]
        }
    }
    }
    ```

    For more example configurations, see the [sample REST API configuration files](https://github.com/mitre-attack/attack-workbench-rest-api/tree/main/resources/sample-configurations). For more details on Service Authentication, see the [REST API Service Authentication documentation](https://github.com/mitre-attack/attack-workbench-rest-api/blob/main/docs/legacy/authentication.md#service-authentication).

### 4. Serve the application

Follow the [install and run](https://github.com/mitre-attack/attack-navigator#install-and-run) instructions in the ATT&CK Navigator repository to deploy the application.

*Note: Navigator will fetch the latest data from your Workbench REST API each time it loads. You do not need to rebuild the application to stay synchronized with Workbench data.*

## ATT&CK Website Integration

The [ATT&CK Website](https://github.com/mitre-attack/attack-website) can be configured to display the contents of your local knowledge base.

### 1. Install the Website

Clone the [ATT&CK Website](https://github.com/mitre-attack/attack-website) repository: `git clone https://github.com/mitre-attack/attack-website.git`

### 2. Update Config

Edit the domain URLs in the config file `modules/site_config.py` as shown below to connect to the Workbench REST API. Refer to [Workbench REST API URLs, above](#workbench-rest-api-urls), for the values for the enterprise and mobile URLs.

```python
domains = [
    {
        "name" : "enterprise-attack",
        "location" : "(Enterprise URL)",
        "alias" : "Enterprise",
        "deprecated" : False
    },
    {
        "name" : "mobile-attack",
        "location" : "(Mobile URL)",
        "alias" : "Mobile",
        "deprecated" : False
    },
    {
        "name" : "pre-attack",
        "location" : "https://raw.githubusercontent.com/mitre/cti/master/pre-attack/pre-attack.json",
        "alias": "PRE-ATT&CK",
        "deprecated" : True
    }
]
```

### 3. Build the site

Run `python3 update-attack.py` to build the website using the current Workbench data.

### 4. Serve the site

Copy the files from output to your web server or use `python3 -m http.server [port]` to host for local browsing.

If the data within the Workbench changes you will need to rebuild the site (from step 3) again; for this reason you may want to consider re-running your build and deploy pipeline at regular intervals using `cron` to keep the data synchronized with the contents of the Workbench.

### 5. Configure the ATT&CK Workbench
Within the environment of the ATT&CK Workbench Frontend, you can set the url of the ATT&CK Website instance you wish to point to with the `environment.attack_website.url` property and enable the ATT&CK website integration with the `environment.attack_website.enabled` property.  Setting the url properly and enabling the integration will allow an option to view objects from the ATT&CK Workbench within the configured ATT&CK Website with a button found in the toolbar.
