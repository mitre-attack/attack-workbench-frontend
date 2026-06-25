# ATT&CK Workbench Frontend

The ATT&CK Workbench is an application allowing users to **explore**, **create**, **annotate**, and **share** extensions of the MITRE ATT&CK® knowledge base. 

Organizations or individuals within the ATT&CK community can initialize an instance of the application to serve as the centerpiece to their own customized instance of the ATT&CK knowledge base, attaching other tools and interfaces as desired. Through the Workbench this local knowledge base can be extended with new or updated techniques, tactics, mitigations groups, and software. Finally, the ATT&CK Workbench provides means to share these extensions with the greater ATT&CK community if so desired, facilitating a greater level of collaboration within the community than is possible with current tools. 

We developed the Workbench with the ATT&CK user community in mind. If MITRE ATT&CK is at the core our organization’s security operations, you actively track threats against ATT&CK, align your defenses to ATT&CK, or plan your security investments based on ATT&CK, the Workbench is for you. The ATT&CK Workbench enables a number of important use cases within the ATT&CK community:
- **Cyber Threat Intelligence**: Take notes on techniques, groups, and other objects to collaborate within a threat intelligence team. Update your knowledge base with new mappings as soon as new threat reports are released.
- **Defensive Planning**: Stay up to date with the evolving threat landscape by downloading new releases of ATT&CK automatically. Fill in gaps in open-source reporting by creating new groups and software and seamlessly integrate them into the existing ATT&CK knowledge base.
- **Red Teaming**: Track and manage coverage of Red Team engagements the same way you track your ATT&CK coverage.
- **Collaboration with ATT&CK and the community**: Share your custom datasets with the ATT&CK community and download datasets created by others.

This repository contains an Angular-based web application providing the user interface for the ATT&CK Workbench application, as well as the main documentation regarding its use. The ATT&CK Workbench application requires additional components for full operation. See the [install and run](#install-and-run) instructions for more details about setting up the entire project.

The ATT&CK Workbench does not collect or share information with MITRE or any third parties.

## Frontend Documentation

For more information about the ATT&CK Workbench, please see the [docs](/docs/README.md) folder. The contents of the docs folder is also available in the in-app help page.
- [usage](/docs/usage.md): documentation about how to use the ATT&CK Workbench application and its full capabilities.
- [collections](/docs/collections.md): documentation about the collection and collection index data type.
- [integrations](/docs/integrations.md): instructions for integrating other tools with the ATT&CK Workbench.
- [contributing](/docs/contributing.md): information about how to contribute to this project.
- [changelog-archive](/docs/changelog-archive.md): records of updates to this application prior to v3.1.0.

## Collections and Collection Indexes

Importing and exporting data from the ATT&CK Workbench is facilitated through the **Collections** and **Collection Indexes**. These data formats also enable record keeping of ATT&CK versions and extensions.
- [Collections](/docs/collections.md#collections)

  Collections are sets of related ATT&CK objects, and may be used to represent specific releases of a dataset such as “Enterprise ATT&CK v9.0” or any other set of objects one may want to share with someone else. Collections are represented in STIX 2.1.

  Collections for all current and prior ATT&CK releases can be found on our [attack-stix-data GitHub repository](https://github.com/mitre-attack/attack-stix-data).
- [Collection Indexes](/docs/collections.md#collection-indexes)

  Collection indexes are organized lists of collections intended to ease their distribution to data consumers. Collection indexes track individual releases of given collections (e.g Enterprise v7, Enterprise v8, Enterprise v9) and allow applications such as the Workbench to check if new releases have been published. Collection Indexes are represented as JSON objects.
  
  The ATT&CK collection index can be found on our [attack-stix-data GitHub repository](https://github.com/mitre-attack/attack-stix-data). The ATT&CK Workbench is pre-configured to recommend this index in the "add a collection index" interface.

More information about collections and collection indexes can be found in the [collections document](docs/collections.md).

## Install and Run

The ATT\&CK Workbench application is composed of several interconnected services. **For the full application to function properly, the frontend, REST API, and database must all be running and able to communicate with one another.** The [Docker installation guide](https://github.com/mitre-attack/attack-workbench-deployment) provides instructions to install all components and is the **recommended approach** for most deployments.

### Core Components

* **[ATT\&CK Workbench Frontend](https://github.com/mitre-attack/attack-workbench-frontend)**
  The web-based user interface for ATT\&CK Workbench, and the primary way users interact with the knowledge base.

* **[ATT\&CK Workbench REST API](https://github.com/mitre-attack/attack-workbench-rest-api)**
  Provides a CRUD interface for storing, querying, and editing ATT\&CK objects, as well as managing collections, collection indexes, and subscriptions.

* **[ATT\&CK Workbench Database](https://hub.docker.com/_/mongo)**
  A MongoDB instance for persisting Workbench entities.

* **[ATT\&CK Workbench TAXII 2.1 Server](https://github.com/mitre-attack/attack-workbench-taxii-server)** *(optional)*
  A sidecar service that exposes the Workbench’s STIX objects through a TAXII 2.1-compliant interface.

Each component can also be manually installed using the instructions in its respective repository. This is useful if you wish to deploy components on separate machines or with custom configurations.

### Installing with Docker

Refer to the official [Deployment Guide](https://github.com/mitre-attack/attack-workbench-deployment) for templates and step-by-step instructions on installing and running Workbench using Docker Compose.

> **Note:** Docker Compose is the **recommended** and **only officially supported** method for deploying Workbench.

### Manual Installation

Developers who prefer to run the Workbench frontend locally (outside of Docker) can follow the steps below.

#### Requirements

- [Node.js](https://nodejs.org/) version `22.x`

#### Installing Dependencies

This step is only necessary if you're running the app locally using `ng serve` or `ng build`. It can be skipped if you're using the Docker setup described above.

1. Run `npm install` to install required packages.

#### Running Locally

1. Run `ng serve`
2. Open your browser and navigate to `http://localhost:4200`

#### Building for Deployment

1. Run `ng build`
2. Copy the output from the `dist/` directory to your desired deployment location.

To build the app for production, use:

```bash
ng build --prod
````

This will compile the application using the production environment configuration.
See [Modifying the Environment](#modifying-the-environment) for more information.


#### Modifying the environment
The ATT&CK Workbench Frontend is configured to connect to the REST API running under its default configuration. If the applications is configured to run on a different port, or if the application is to be hosted for access on multiple machines, the environment must be edited to reflect the URLs and port.

These environment properties can be edited under `src/environments`:
- [src/environments/environment.ts](app/src/environments/environment.ts) is the development environment with configurations for when it is hosted on a local machine or is being actively developed. This is the default environment file used when building the application.
- [src/environments/environment.prod.ts](app/src/environments/environment.prod.ts) is the production environment for deployment inside of an organization or in cases where the user is not developing the application. When the application is built for production deployments (`ng build --prod`) this environment file is used.

#### Setting the Default Landing Page
To allow for additional customization, the ATT&CK Workbench enables users to set a default landing page for their instance of Workbench. To set the default landing page:
- Open up the config file, found at `src/assets/config.ts`.
- Set the `defaultLandingPage` variable to the url path you want to set as the default landing page
  - You can set the default to a more general page, such as the tactic list view `"defaultLandingPage": "tactic"`, or to a specific page, such as a certain matrix `"defaultLandingPage": "matrix/x-mitre-matrix--eafc1b4c-5e56-4965-bd4e-66a6a89c88cc"`

### Developer Setup

Please refer to our [local development instructions](docs/local-dev.md) for information on installing and running the application for local development and testing. 

## Related Work

### STIX

Structured Threat Information Expression (STIX<sup>™</sup>) is a language and serialization format used to exchange cyber threat intelligence (CTI).

STIX enables organizations to share CTI with one another in a consistent and machine readable manner, allowing security communities to better understand what computer-based attacks they are most likely to see and to anticipate and/or respond to those attacks faster and more effectively.

STIX is designed to improve many different capabilities, such as collaborative threat analysis, automated threat exchange, automated detection and response, and more.

https://oasis-open.github.io/cti-documentation/

### MITRE ATT&CK

MITRE ATT&CK® is a curated knowledge base and model for cyber adversary behavior, reflecting the various phases of an adversary’s lifecycle and the platforms they are known to target. ATT&CK is useful for understanding security risk against known adversary behavior, for planning security improvements, and verifying defenses work as expected.

https://attack.mitre.org

### ATT&CK Navigator

The ATT&CK Navigator is a web-based tool for annotating and exploring ATT&CK matrices. It can be used to visualize defensive coverage, red/blue team planning, the frequency of detected techniques, and more. 

https://github.com/mitre-attack/attack-navigator/

## Notice 

Copyright 2020-2025 MITRE Engenuity. Approved for public release. Document number CT0020 and public release case number 22-3206.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at 

http://www.apache.org/licenses/LICENSE-2.0 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. 

This project makes use of ATT&CK®

[ATT&CK Terms of Use](https://attack.mitre.org/resources/terms-of-use/)
