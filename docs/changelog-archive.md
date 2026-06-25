# Changelog Archive

This changelog contains entries for versions **up to v3.0.0**, prior to our adoption of the [semantic-release](https://github.com/semantic-release/semantic-release) workflow.

Starting with version **v3.1.0**, changelogs are automatically generated and published as part of each GitHub release. The latest release notes can be found on the [Releases page](https://github.com/mitre-attack/attack-workbench-frontend/releases).

## 08 April 2025

### ATT&CK Workbench version 3.0.0

#### New Features
- Added the ability to view and copy an object's STIX ID directly from its view page. See [frontend#555](https://github.com/mitre-attack/attack-workbench-frontend/issues/555).
- Added an informational popover to the version field for version bump guidelines based on the corresponding object type. See [frontend#588](https://github.com/mitre-attack/attack-workbench-frontend/issues/588).
- Added a diff view to the object history sidebar to show a detailed change log of what was changed on an object. See [frontend#575](https://github.com/mitre-attack/attack-workbench-frontend/issues/575).

#### Improvements
- Implemented automatic synchronization of tactics between parent and sub-techniques to ensure consistency upon saving. See [frontend#583](https://github.com/mitre-attack/attack-workbench-frontend/pull/583).
- Improved local installation documentation. See [frontend#581](https://github.com/mitre-attack/attack-workbench-frontend/issues/581).
- Updated the relationship view with links to its source or target object for easier navigation between related objects. See [frontend#386](https://github.com/mitre-attack/attack-workbench-frontend/issues/386).
- Automatically reset the status of an object to "work in progress" when changes are made to an object or its relationships. See [frontend#561](https://github.com/mitre-attack/attack-workbench-frontend/issues/561).

#### Fixes
- Fixed an issue where deprecated objects were not displayed in the "Objects citing this reference" section in the Reference Manager. The `includeDeprecatedObjects` property was added to the `stix-list` component, allowing these objects to be included in the list. See [frontend#582](https://github.com/mitre-attack/attack-workbench-frontend/pull/582).
- Fixed a bug that allowed users to assign a technique as a subtechnique of itself. See [frontend#586](https://github.com/mitre-attack/attack-workbench-frontend/issues/586).
- Fixed a bug where tactic names would not be displayed when editing a matrix due to asynchronous tactic loading. See [frontend#535](https://github.com/mitre-attack/attack-workbench-frontend/issues/535).
- Fixed a bug where removing an item from the `related_asset_sectors` list on a related asset would not actually remove it from the field.
- Fixed a bug where clicking "show more" on an alias property would cause the application to crash when both an alias description and citation are present.

## 31 October 2024

### ATT&CK Workbench version 2.2.0

#### New Features
- Added a Contributors page which lists all contributors in the knowledge base. Users can view a list of contributions made by each individual and click on any object to navigate to its Workbench page. See [frontend#514](https://github.com/mitre-attack/attack-workbench-frontend/issues/514).
- Added a search tab to the resources drawer. See [frontend#521](https://github.com/mitre-attack/attack-workbench-frontend/pull/521).

#### Improvements
- Added the ability to view mapped techniques for a given data source. See [frontend#255](https://github.com/mitre-attack/attack-workbench-frontend/issues/255).
- Added support for viewing Assets on a configured external ATT&CK Website. See [frontend#526](https://github.com/mitre-attack/attack-workbench-frontend/issues/526).
- Added collection events to object history in the sidebar. See [frontend#140](https://github.com/mitre-attack/attack-workbench-frontend/issues/140).
- Updated Angular to v17.
- Updated the [integration documentation](https://github.com/mitre-attack/attack-workbench-frontend/blob/master/docs/integrations.md) to be compatible with v5.0.0 of the [ATT&CK Navigator](https://github.com/mitre-attack/attack-navigator).
- Updated the associated software, group, and campaigns to require a reference or description.
- Added validation to new reference URLs to prevent duplicate references. See [frontend#541](https://github.com/mitre-attack/attack-workbench-frontend/issues/541).

## 31 October 2023

### ATT&CK Workbench version 2.1.0

#### New Features

- Added the ability to create, view, and edit Asset objects.
- Added the ability to view and route to objects that cite a given reference from the reference dialog. See [frontend#263](https://github.com/mitre-attack/attack-workbench-frontend/issues/263).

#### Improvements

- Navigation menu collapses under a separate hamburger menu rather than the identity icon. See [frontend#494](https://github.com/mitre-attack/attack-workbench-frontend/issues/494).
- Markdown support for collection index descriptions. See [frontend#222](https://github.com/mitre-attack/attack-workbench-frontend/issues/222).

#### Fixes

- Fixed an issue where revoking or deprecating an object would deprecate all `revoked-by` relationships with the object. See [frontend#467](https://github.com/mitre-attack/attack-workbench-frontend/issues/467).
- Fixed an issue where first/last seen Campaign dates were parsed in local time, causing the dates to be displayed incorrectly in certain timezones. See [frontend#508](https://github.com/mitre-attack/attack-workbench-frontend/pull/508).
- Fixed a bug where the "create a collection from group" button was being displayed on the group list page.
- Notes will only start editing when the header is clicked, enabling the contents of the note to easily be clicked or copied. See [frontend#213](https://github.com/mitre-attack/attack-workbench-frontend/issues/213).

## 21 September 2023

### ATT&CK Workbench version 2.0.1

#### Fixes

- Fixed a crash that would occur when retrieving recent activity for large teams.
- Fixed the incorrect path to the REST API Docker image documented in [`docker-compose.md`](https://github.com/mitre-attack/attack-workbench-frontend/blob/master/docs/docker-compose.md).
- Fixed an issue where the version number of an object could be saved in an invalid format.
- Fixed object name and ATT&CK ID validation to check against revoked and deprecated objects.
- Fixed an issue where the `retrieveAll()` query for Relationships and ATT&CK objects would cause a "Sort exceeded memory limit" error. See [rest-api#285](https://github.com/mitre-attack/attack-workbench-rest-api/issues/285).
- Updated Angular to v14.

## 16 August 2023

### ATT&CK Workbench version 2.0.0

As of v2.0.0, the [ATT&CK Workbench Collection Manager](https://github.com/mitre-attack/attack-workbench-collection-manager) has been deprecated. All functionality of the Collection Manager has been absorbed into the [ATT&CK Workbench REST API](https://github.com/mitre-attack/attack-workbench-rest-api).

The ATT&CK Workbench now features a persistent database for Docker installs with the use of a named volume. **This change may result in data on the current anonymous volume being lost.** The [Docker Install Update Guide](/docs/update.md) describes how to backup your existing ATT&CK Workbench data, update to v2.0.0, and restore your data after the update.

#### New Features

- Added an Admin interface for creating and managing teams.
- Added the ability to search objects by one or more users.
- Added a new user profile page where logged in users can view their recent activity across the Workbench and view/edit their display name.
- Added an option to configure an external ATT&CK Website in which to view Workbench objects, if a relevant object page exists.
- Added functionality to create a collection from a group and its related objects.
- Added button to import groups and their related objects into new or existing collections.
- Added an option to deprecate Data Component objects. See [frontend#429](https://github.com/mitre-attack/attack-workbench-frontend/issues/429).
- Added Matrix view to Matrix pages similar to the full matrix on the [ATT&CK website](https://attack.mitre.org/). See [frontend#20](https://github.com/mitre-attack/attack-workbench-frontend/issues/20).
- Added ability to upload csv and excel files in collection imports.
- Added support for configuring a default landing page. The desired landing page can be specified in `assets/config.json`, which Workbench will route to upon login.

#### Improvements

- Improved error handling during collection import.
- Lists of objects can now be filtered when viewing or editing collections. See [frontend#393](https://github.com/mitre-attack/attack-workbench-frontend/issues/393).
- Added a persistent database to Docker installs.
- Published pre-built Docker images to the Github Container Registry. See [frontend#250](https://github.com/mitre-attack/attack-workbench-frontend/issues/250).
- Improved the collection view to display versions in the drop down rather than in the main list.

#### Fixes

- Fixed an issue where duplicate entries would be displayed in some dropdown lists for objects in multiple domains. See [frontend#454](https://github.com/mitre-attack/attack-workbench-frontend/issues/454).

## 21 April 2023

### ATT&CK Workbench version 1.3.1

#### New Features

- Added universal Notes page where users can search for notes based on title or content. Selecting a note in the table will redirect the user to the object the note was created on.  See [frontend#176](https://github.com/mitre-attack/attack-workbench-frontend/issues/175).

#### Improvements

- Added individual attribution to edits made on Note objects.
- Added the ICS Security Control mapping field to Mitigation objects. See [frontend#419](https://github.com/mitre-attack/attack-workbench-frontend/issues/419). 
- Updated the documentation for installing Workbench with additional certs. See [frontend#225](https://github.com/mitre-attack/attack-workbench-frontend/issues/225).

#### Fixes

- Fixed an issue where assigning an existing technique as a sub-technique would not create a `subtechnique-of` relationship. See [frontend#446](https://github.com/mitre-attack/attack-workbench-frontend/issues/446).
- Fixed an issue causing a user's `displayName` to be removed when updating a user account on the admin page. See [frontend#449](https://github.com/mitre-attack/attack-workbench-frontend/issues/449).
- Fixed an issue where updates to a user account role or status would not be reflected until the page was refreshed. See [frontend#450](https://github.com/mitre-attack/attack-workbench-frontend/issues/450).
- Fixed a bug with the validation of the `source_name` field on Reference objects.

## 8 March 2023

### ATT&CK Workbench version 1.3.0

ATT&CK Workbench version 1.3.0 supports the deletion of objects.

#### New Features

- Added a Reference Manager page to the Workbench to increase usability. The ability to view and edit a reference has been moved from the sidebar to the Reference Manager page. See [frontend#349](https://github.com/mitre-attack/attack-workbench-frontend/issues/349).
- Added functionality to delete Relationship objects, with the exception of `subtechnique_of` relationships. See [frontend#341](https://github.com/mitre-attack/attack-workbench-frontend/issues/341).
- Added functionality to delete References which are not cited by any objects. See [frontend#350](https://github.com/mitre-attack/attack-workbench-frontend/issues/350).
- Added functionality to delete Mitigation, Group, Software, Data Source, Data Component, and Technique objects. Objects can only be deleted by users with `admin` roles if the object does not have any existing relationships. See [frontend#342](https://github.com/mitre-attack/attack-workbench-frontend/issues/342), [frontend#346](https://github.com/mitre-attack/attack-workbench-frontend/issues/346), [frontend#347](https://github.com/mitre-attack/attack-workbench-frontend/issues/347), and [frontend#343](https://github.com/mitre-attack/attack-workbench-frontend/issues/343).

#### Improvements

- Improved validation for the `source_name` field on Reference objects to prevent duplicated source names and issues caused by invalid characters during citation parsing. See [frontend#352](https://github.com/mitre-attack/attack-workbench-frontend/issues/352).
- Enabled editing of the `domains` field for Data Sources and Data Components. See [frontend#428](https://github.com/mitre-attack/attack-workbench-frontend/issues/428).

#### Fixes

- Fixed an issue where the "apply patches and save" button would be unavailable when updating a reference used only by Relationship objects. See [frontend#356](https://github.com/mitre-attack/attack-workbench-frontend/issues/356).
- Fixed an issue where the external reference for a Data Source's ATT&CK ID pointed to an incorrect URL. See [frontend#422](https://github.com/mitre-attack/attack-workbench-frontend/issues/422).
- Fixed an issue where updating a reference used by a revoked or deprecated object would throw an error and prevent the user from saving the changes to the reference. See [frontend#355](https://github.com/mitre-attack/attack-workbench-frontend/issues/355).
- Fixed a bug where citations would break if the reference source name contained special characters because the query was not correctly encoded in the request. See [frontend#371](https://github.com/mitre-attack/attack-workbench-frontend/pull/371).

## 25 October 2022

### ATT&CK Workbench version 1.2.0

ATT&CK Workbench v1.2.0 supports authentication and authorization for users. The REST API can be configured to use the Anonymous or OpenID Connect (OIDC) authentication mechanisms. See the [authentication documentation](https://github.com/mitre-attack/attack-workbench-rest-api/tree/master/docs/authentication.md#authentication) for more information.

Additionally, Workbench v1.2.0 introduces the ability to create, edit, and view Campaign objects and coincides with the ATT&CK v12.0 release. Users who do not upgrade to Workbench v1.2.0 may encounter issues with the new ATT&CK data.

#### New Features

- Added functionality to generate object ATT&CK IDs. See [frontend#114](https://github.com/mitre-attack/attack-workbench-frontend/issues/114) and [frontend#300](https://github.com/mitre-attack/attack-workbench-frontend/issues/300).
- Added optional namespace settings for ATT&CK IDs, so object IDs don't conflict with ATT&CK or other organizations' object IDs. These settings are automatically applied when creating a new object. See [frontend#113](https://github.com/mitre-attack/attack-workbench-frontend/issues/113).
- Added parent technique field when creating a sub-technique, this will automatically create a relationship between the parent and sub-technique. See [frontend#308](https://github.com/mitre-attack/attack-workbench-frontend/issues/308).
- Added support for LinkById tags, which allow users to add links from one object to another in Workbench. LinkById tags are formatted as `(LinkById: ATT&CK ID)` and are supported in `description` and `x_mitre_detection` fields. When previewing or viewing these fields, LinkById tags are detected and replaced with a link to the corresponding object's page on the Workbench. See [frontend#279](https://github.com/mitre-attack/attack-workbench-frontend/issues/279).
    - LinkById tags are automatically checked and updated when a referenced object's ATT&CK ID is changed. See [frontend#281](https://github.com/mitre-attack/attack-workbench-frontend/issues/281).
- Added a button to object ATT&CK ID fields to copy the object's LinkById tag. See [frontend#327](https://github.com/mitre-attack/attack-workbench-frontend/issues/327).
- Added `contributors` field to Technique and Tactic objects. See [frontend#325](https://github.com/mitre-attack/attack-workbench-frontend/issues/325).
- Added ability to search for objects by ATT&CK ID. See [rest-api#162](https://github.com/mitre-attack/attack-workbench-rest-api/issues/162).
- Added a view page for References in the Reference Manager. See [frontend#304](https://github.com/mitre-attack/attack-workbench-frontend/issues/304).
- Added a link to the parent technique page from the sub-technique page. See [frontend#309](https://github.com/mitre-attack/attack-workbench-frontend/issues/309).
- Added a link to tactic pages from the matrix page. See [frontend#391](https://github.com/mitre-attack/attack-workbench-frontend/issues/391).
- Added support for viewing techniques associated with a tactic on the tactic view page. See [frontend#390](https://github.com/mitre-attack/attack-workbench-frontend/issues/390).
- Added ability to create and edit Campaign objects. See [frontend#376](https://github.com/mitre-attack/attack-workbench-frontend/issues/376), [frontend#377](https://github.com/mitre-attack/attack-workbench-frontend/issues/377), and [frontend#384](https://github.com/mitre-attack/attack-workbench-frontend/issues/384).
- Added the ability to automatically find and add tactics related to techniques when creating or editing a collection. See [frontend#388](https://github.com/mitre-attack/attack-workbench-frontend/issues/388).
- Added the option to include associated Note objects in the Collection bundle export. See [frontend#389](https://github.com/mitre-attack/attack-workbench-frontend/issues/389).

#### Improvements

- Added authentication and authorization to the Workbench. Only authorized users can access the data of the Workbench instance. Documentation pages may be viewed by unauthenticated users. See [frontend#192](https://github.com/mitre-attack/attack-workbench-frontend/issues/192).
- Added user registration and approval. Administrators can approve registrants and set their permission levels on the administrator user accounts page. See [frontend#193](https://github.com/mitre-attack/attack-workbench-frontend/issues/193).
- Added user login and logout functionality. Pending users cannot log in until the Adminstrator has approved their account. See [frontend#266](https://github.com/mitre-attack/attack-workbench-frontend/issues/266).
- Added support for individual attribution. If a user is logged in, the application will display the individual user who has edited an object in place of the organization-level identity. Individual attribution is not supported when the Workbench instance is set up with anonymous authentication. See [frontend#191](https://github.com/mitre-attack/attack-workbench-frontend/issues/191).
- Added support for marking definitions. See [frontend#188](https://github.com/mitre-attack/attack-workbench-frontend/issues/188).
- Relationships which have been deprecated are hidden in the list of relationships without requiring a page refresh. See [frontend#321](https://github.com/mitre-attack/attack-workbench-frontend/issues/321).
- Changing a user's role to `admin`, `editor` or `visitor` automatically sets the user's status to `active`. A user's status is automatically set to `inactive` if their role is changed to `none`. See [frontend#318](https://github.com/mitre-attack/attack-workbench-frontend/issues/318).
- Added options to the relationship edit dialog to increment the source and/or target object versions when creating a new relationship. See [frontend#307](https://github.com/mitre-attack/attack-workbench-frontend/issues/307).
- The source and target objects' version numbers and last modified dates are shown alongside their names when creating a new relationship to provide more context. See [frontend#313](https://github.com/mitre-attack/attack-workbench-frontend/issues/313).
- When creating a new Reference object, the `retrieved` field will default to the current date. See [frontend#305](https://github.com/mitre-attack/attack-workbench-frontend/issues/305).
- The external references field at the bottom of object pages are automatically updated to reflect citation changes to the `description` and `x_mitre_detection` fields before the object is saved. See [frontend#329](https://github.com/mitre-attack/attack-workbench-frontend/issues/329).
- Added validation to ensure a technique has been assigned at least one tactic. See [frontend#273](https://github.com/mitre-attack/attack-workbench-frontend/issues/273).
- Removed the comma key as a keycode separator for list input fields (i.e. `contributors`, `system requirements`, `CAPEC IDs`, etc.). See [frontend#335](https://github.com/mitre-attack/attack-workbench-frontend/pull/335).
- Whitespace is trimmed during the serialization of string fields for all STIX objects and external references. See [frontend#187](https://github.com/mitre-attack/attack-workbench-frontend/issues/187).
- Lists of objects can now be filtered by domains and platforms. See [frontend#392](https://github.com/mitre-attack/attack-workbench-frontend/issues/392).
- Added validation for Reference URLs. See [frontend#407](https://github.com/mitre-attack/attack-workbench-frontend/issues/407).


#### Fixes

- Added missing fields from User Account objects: `created`, `modified`, and `displayName`. See [frontend#319](https://github.com/mitre-attack/attack-workbench-frontend/issues/319).
- Fixed a bug where spaces would break the search in object tables and show no results. See [frontend#303](https://github.com/mitre-attack/attack-workbench-frontend/issues/303).
- Fixed an issue where other external references (such as MTC IDs or CAPEC IDs) were being identified as the object's ATT&CK ID, when the object had not yet been assigned an ATT&CK ID. See [frontend#322](https://github.com/mitre-attack/attack-workbench-frontend/issues/322).
- Fixed an issue where Matrix ATT&CK IDs (a.k.a. domain identifiers) were being validated and preventing users from saving. This caused issues for domains which have multiple matrices with the same domain identifier. See [frontend#315](https://github.com/mitre-attack/attack-workbench-frontend/issues/315).
- Fixed the unexpected calls being made to the REST API before the user is authenticated. See [frontend#314](https://github.com/mitre-attack/attack-workbench-frontend/issues/314).
- Fixed a bug where the external reference links at the bottom of object pages did not redirect to the reference's associated URL. See [frontend#306](https://github.com/mitre-attack/attack-workbench-frontend/issues/306).
- Fixed a bug where the search functionality would break with special characters because the query was not correctly encoded in the request. See [frontend#332](https://github.com/mitre-attack/attack-workbench-frontend/issues/332).
- Fixed an issue where Note objects were not registered as a valid class, resulting in errors when trying to retrieve all objects from the REST API. See [frontend#338](https://github.com/mitre-attack/attack-workbench-frontend/pull/338).
- Fixed an issue where the Software/Group `aliases` field expected the object name as the first array entry, causing display issues in downstream applications. See [frontend#370](https://github.com/mitre-attack/attack-workbench-frontend/issues/370).
- Increased request timeout in nginx. See [frontend#387](https://github.com/mitre-attack/attack-workbench-frontend/issues/387).

## 21 October 2021

### ATT&CK Workbench version 1.1.0

ATT&CK Workbench v1.1.0 includes support for ATT&CK Spec v2.1.0 and coincides with the ATT&CK v10.0 release. Users who do not upgrade to Workbench v1.1.0 may encounter issues with the new ATT&CK data:

- If the user added the ATT&CK collection index prior to the ATT&CK v10.0 release, it may lose track of imported Enterprise collections. These collections can still be found in the "imported collections" tab of the collection manager, but won't be reflected in the collection manager. Collection subscriptions for Enterprise may also be lost. Upgrading to ATT&CK Workbench v1.1.0 will fix this issue and restore prior collection subscriptions.
- If the user imports ATT&CK v10.0 using ATT&CK Workbench 1.0.X, data sources and data components will not be imported into their local knowledge base. You can re-import the collection after upgrading Workbench to v1.1.0 to acquire the data sources and data components even if you had already imported it when running a prior version of Workbench.

ATT&CK Workbench version 1.1.0 includes improvements to how data is imported which should circumvent the above issues for future releases of ATT&CK.

#### Improvements

- Added object type documentation on list pages. See [frontend#221](https://github.com/mitre-attack/attack-workbench-frontend/issues/221).
- Added support for ATT&CK Spec v2.1.0:
    - Added support for data sources and data components, and viewing/editing interfaces for these object types and their relationships with techniques. See [frontend#67](https://github.com/mitre-attack/attack-workbench-frontend/issues/67), [frontend#66](https://github.com/mitre-attack/attack-workbench-frontend/issues/66).
    - Added support for `x_mitre_attack_spec_version` on all object types.
- Improved the flexibility and robustness of collection imports:
    - Workbench will now check the ATT&CK Spec version of imported data and warn the user if the ATT&CK Spec version is unsupported (ex. if the Workbench instance is too outdated to support the data it is trying to import). The user can choose to bypass this warning.
    - Workbench can now import the same collection multiple times in case objects in the initial import could not be imported due to an error.
    - The user will now be provided with a downloadable list of objects that could not be saved (and the reason why) in the event of import errors.
    - REST API will now log import errors for individual objects to the console when the log level is set to `verbose`.
    - Frontend will now log import errors to the console when the application environment is not set to production.
- Added validation for missing ATT&CK IDs on objects that support them. The user will now be warned if they neglect to assign an ATT&CK ID to an object which supports it. When exporting a collection, the user will similarly be warned if any contained objects are missing ATT&CK IDs. See [frontend#231](https://github.com/mitre-attack/attack-workbench-frontend/issues/231).
- REST API now supports setting the log level through an environment variable. See [rest-api#108](https://github.com/mitre-attack/attack-workbench-rest-api/issues/108).
- REST API no longer sets the `upgrade-insecure-requests` directive of the `Content-Security-Policy` header in responses. This will facilitate the deployment of ATT&CK Workbench in an internal environment without requiring the system to be configured to support HTTPS. See [rest-api#96](https://github.com/mitre-attack/attack-workbench-rest-api/issues/96).

#### Fixes

- Fixed an issue where the navigation header could be inaccessible when navigating within the application or when the page resized due to user input.
- Frontend will no longer claim objects were imported when they were actually discarded due to import errors such as spec violations.
- Imported STIX bundles will no longer require (but still allow) the `spec_version` field on the bundle itself. This was causing issues importing collections created by the Workbench. Objects within the bundle still require the `spec_version` field per the STIX 2.1 spec. See [rest-api#103](https://github.com/mitre-attack/attack-workbench-rest-api/issues/103).
- Fixed an issue where the REST API would save references when importing a collection bundle even though the `previewOnly` flag had been set. See [rest-api#120](https://github.com/mitre-attack/attack-workbench-rest-api/issues/120).

## 20 August 2021

### ATT&CK Workbench version 1.0.2

#### Fixes

- Error snackbars will now show appropriate messages instead of `[object ProgressEvent]` when communication with the REST API is interrupted or cannot be established. See [frontend#227](https://github.com/mitre-attack/attack-workbench-frontend/issues/227).
- Fixed a bug where tactic shortnames were computed incorrectly for tactics with more than one space in the name (E.g `"Command and Control"`). See [frontend#239](https://github.com/mitre-attack/attack-workbench-frontend/issues/239).
    - If you have edited a technique under a tactic with more than one space in the name, remove and re-add the tactic under the technique edit interface to ensure that the tactic reference is formatted properly.
    - If you have created a tactic with more than one space in the name, save a new version of the tactic and the proper shortname should be saved. You do not need to make any edits when saving the tactic page for the shortname to be fixed.

## 8 July 2021

### ATT&CK Workbench version 1.0.1

#### Improvements

- Added a system for configuring the Collection Manager with self-signed certs when using the docker setup. Documentation for this configuration will be improved in a subsequent release.

#### Fixes

- Fixed an error encountered when using the `attack-objects` API with large datasets. This error was preventing users from loading the "create a collection" page when Enterprise ATT&CK collections were imported. See [rest-api#87](https://github.com/mitre-attack/attack-workbench-rest-api/issues/87).

## 21 June 2021

### ATT&CK Workbench version 1.0.0

#### Improvements

- Performance improvements when adding, editing, and validating relationships.
- Improved error messages when importing collections that are too large or malformed. See [frontend#198](https://github.com/mitre-attack/attack-workbench-frontend/issues/198).
- Improved page titles and breadcrumb on "object not found" pages.
- User can now import collections from file. See [frontend#207](https://github.com/mitre-attack/attack-workbench-frontend/issues/207).
- Collection index update interval is now set in the REST API configuration instead of hardcoded in the frontend. See [frontend#200](https://github.com/mitre-attack/attack-workbench-frontend/issues/200).

#### Fixes

- Fixed vertically misaligned timestamps across several UIs.
- Fixed missing timestamp on collection version lists within collection indexes.
- Fixed object status popover showing the wrong status if opened too soon after the page loads. Also improved performance of the status popover code.
- Collection import UI no longer gets stuck if it runs into a problem fetching/importing/previewing the collection. See [frontend#198](https://github.com/mitre-attack/attack-workbench-frontend/issues/198)
- Object status popover now closes properly when the user starts editing the object. See [frontend#199](https://github.com/mitre-attack/attack-workbench-frontend/issues/199).

## 7 May 2021

### ATT&CK Workbench version 0.4.0

#### Improvements

- Added a favicon. See [frontend#137](https://github.com/mitre-attack/attack-workbench-frontend/issues/137).
- Added dynamic page title to make it easier to distinguish multiple Workbench tabs in the browser. See [frontend#130](https://github.com/mitre-attack/attack-workbench-frontend/issues/130).
- Added a list of recommended indexes available when adding a collection index. See [frontend#194](https://github.com/mitre-attack/attack-workbench-frontend/issues/194).
- Added ability to set workflow state when objects are saved. See [frontend#184](https://github.com/mitre-attack/attack-workbench-frontend/issues/184).
- Updated occurrences of "aliases" to "associated groups" or "associated software" for consistency across the application. See [frontend#176](https://github.com/mitre-attack/attack-workbench-frontend/issues/176).
- Improved logging and added log level to environment configuration to suppress unnecessary logs from production deployments. See [frontend#209](https://github.com/mitre-attack/attack-workbench-frontend/issues/209).
- Updated the reference editor to enforce correct formatting when creating a new reference. See [frontend#177](https://github.com/mitre-attack/attack-workbench-frontend/issues/177).

## 21 April 2021

### ATT&CK Workbench version 0.3.0

#### New Features

- Added attribution of edits and tracking of organization identity. See [frontend#61](https://github.com/mitre-attack/attack-workbench-frontend/issues/124) and [frontend#182](https://github.com/mitre-attack/attack-workbench-frontend/issues/61).
- Added ability to revoke and deprecate objects. See [frontend#164](https://github.com/mitre-attack/attack-workbench-frontend/issues/164).
- Added tracking of workflow state. See [frontend#3](https://github.com/mitre-attack/attack-workbench-frontend/issues/3).
- Added ability to create and edit collections. See [frontend#4](https://github.com/mitre-attack/attack-workbench-frontend/issues/4), [frontend#5](https://github.com/mitre-attack/attack-workbench-frontend/issues/5), and [frontend#112](https://github.com/mitre-attack/attack-workbench-frontend/issues/112).
- Added support and documentation for [ATT&CK Navigator](https://github.com/mitre-attack/attack-navigator) integration. See [frontend#153](https://github.com/mitre-attack/attack-workbench-frontend/issues/153).
- Added support and documentation for [ATT&CK Website](https://github.com/mitre-attack/attack-website/) integration. See [frontend#152](https://github.com/mitre-attack/attack-workbench-frontend/issues/152).

#### Improvements

- Improved display of object domains. See [frontend#166](https://github.com/mitre-attack/attack-workbench-frontend/issues/166).

## 19 March 2021

### ATT&CK Workbench version 0.2.0

#### New Features

- Added support for MTC and CAPEC IDs. See [frontend#124](https://github.com/mitre-attack/attack-workbench-frontend/issues/124).
- Added ability to create and edit objects. See [frontend#44](https://github.com/mitre-attack/attack-workbench-frontend/issues/44) and [frontend#145](https://github.com/mitre-attack/attack-workbench-frontend/issues/145).
    - Added ability to edit group/software aliases. See [frontend#118](https://github.com/mitre-attack/attack-workbench-frontend/issues/118).
    - Added ability to edit various list properties such as platforms, tactics, and domains. See [frontend#31](https://github.com/mitre-attack/attack-workbench-frontend/issues/31).
    - Added rich-text description editor. See [frontend#32](https://github.com/mitre-attack/attack-workbench-frontend/issues/32).
    - Added ability to convert techniques to sub-techniques, and vice versa.
    - Added ability to edit ATT&CK IDs. See [frontend#55](https://github.com/mitre-attack/attack-workbench-frontend/issues/55).
    - Added validation system to warn user of malformed data.
    - Added ability to reorder tactics on matrices. See [frontend#116](https://github.com/mitre-attack/attack-workbench-frontend/issues/116).
    - Added ability to edit object version numbers, and a UI for incrementing versions when objects are saved. See [frontend#56](https://github.com/mitre-attack/attack-workbench-frontend/issues/56).
- Added ability to create and edit notes (annotations) on objects. See [frontend#59](https://github.com/mitre-attack/attack-workbench-frontend/issues/59).
- Added citations/references support.
    - Added automatic detection of citations on descriptions and aliases. See [frontend#115](https://github.com/mitre-attack/attack-workbench-frontend/issues/115).
    - Added references manager tool. See [frontend#115](https://github.com/mitre-attack/attack-workbench-frontend/issues/115) and [frontend#133](https://github.com/mitre-attack/attack-workbench-frontend/issues/133).

#### Improvements

- Lists of objects can now be searched and filtered. See [frontend#128](https://github.com/mitre-attack/attack-workbench-frontend/issues/128) and [frontend#127](https://github.com/mitre-attack/attack-workbench-frontend/issues/127).
- Lists of objects now display ATT&CK IDs when relevant. See [frontend#119](https://github.com/mitre-attack/attack-workbench-frontend/issues/119).
- When viewing an object, fields which have no value(s) will now be hidden. See [frontend#120](https://github.com/mitre-attack/attack-workbench-frontend/issues/120).
- Improved display of sub-techniques. See [frontend#125](https://github.com/mitre-attack/attack-workbench-frontend/issues/125).
- Layout and formatting improvements to [USAGE](/docs/usage.md) document.

#### Fixes

- Fixed broken pagination on relationship tables. See [frontend#126](https://github.com/mitre-attack/attack-workbench-frontend/issues/126).

## 16 February 2021

### ATT&CK Workbench version 0.1.1

#### New Features

- Added Dockerfiles, docker-compose, [and documentation on how to use them](https://github.com/mitre-attack/attack-workbench-frontend/tree/master/docs/docker-compose.md). See [frontend#108](https://github.com/mitre-attack/attack-workbench-frontend/issues/108), [frontend#109](https://github.com/mitre-attack/attack-workbench-frontend/issues/109) [rest-api#14](https://github.com/mitre-attack/attack-workbench-rest-api/issues/14), and [collection-manager#13](https://github.com/mitre-attack/attack-workbench-collection-manager/issues/13).

#### Fixes

- Fixed a crash that could occur with specific queries on the REST API. See [rest-api#28](https://github.com/mitre-attack/attack-workbench-rest-api/issues/28).

## 19 January 2021

### ATT&CK Workbench version 0.1.0

#### New Features

- Created object view pages for matrix, technique, tactic, mitigation, group, and software objects.
- Added the ability to browse and import collection indexes.
    - Collection indexes can be imported via URL.
    - A preview of the collection index is shown before confirming the import.
- Added the ability to import, view, and subscribe to collections.
    - Collections listed within an index can be subscribed to, which will pull new versions when they are published.
    - Collections can also be manually imported via URL. When importing, a preview of the collection and its contents is shown before confirming the import. At this step, users can preview the objects in the collection and select which ones they want to import. Changes in the import are displayed relative to the state of the knowledge base similar to the update pages on the [ATT&CK Website](https://attack.mitre.org/resources/updates/).
    - An interface provides the ability to review prior imports, which provides a list of changes at the time of the import identical to that shown during the import of the collection.
