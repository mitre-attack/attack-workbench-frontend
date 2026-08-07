# ATT&CK Workbench Usage Documentation

The ATT&CK Workbench is a tool intended to allow the ATT&CK community to *explore*, *create*, *annotate* and *share* extensions of ATT&CK. 

## Build Information

The bottom of the primary navigation shows the release versions of the
Workbench frontend and the connected REST API. Hover over either version to
see the source commit and build date. If the REST API cannot be reached, its
version is shown as `unknown` without preventing the rest of the application
from loading.

## Exploring ATT&CK

When first instantiated, the ATT&CK Workbench will not include any data. You can use the application to build a custom dataset, or import data from a data provider such as MITRE using the collections browser.

### Managing Collections

Accessing and sharing ATT&CK knowledge is realized through _collections_. A collection is a set of related ATT&CK objects; collections may be used represent specific releases of a dataset such as "Enterprise ATT&CK v7.2", or any other set of objects one may want to share with someone else. 

Collections can be created by anyone, not just MITRE. The ATT&CK Workbench application includes workflows for both importing and creating new collections. Collections can be shared as STIX bundles, uploaded to the internet, or sent through email. <!-- or hosted on a [TAXII server](https://oasis-open.github.io/cti-documentation/taxii/intro.html). -->

Data providers may opt to describe their published collections through a _collection index_ which provides a listing of collections. The ATT&CK Workbench Editor can be configured to subscribe to such indexes to automatically receive updates when they are available, or to allow the user to easily browse the collections listed by an index.

Objects may exist in multiple collections simultaneously, and objects can exist within the editor outside of the context of a collection. Collections exist at the _version_ level of an object: a specific version of the object is tagged with the collection instead of the object as a whole. If a user imports a collection, and then edits an object from that collection (thereby creating a new version of the object), the new version will not exist within that collection.

You can read more about the technical specifications for a collection, such as the STIX representation of a collection object, in our [collections](/docs/collections.md) document. MITRE's ATT&CK collections and collection index can be found on our [attack-stix-data GitHub repository](https://github.com/mitre-attack/attack-stix-data).

#### Releasing a Release-Track Snapshot

The release preview offers minor and major relative tags as well as an exact `MAJOR.MINOR` version. Relative tags are calculated from the tagged snapshot immediately before the selected draft. When releasing an older draft, the exact version must also remain below the next tagged snapshot; the dialog shows these exclusive bounds. Optional release notes are stored on that snapshot and become the `x-mitre-collection` description in exported STIX bundles.

The release-track page can export the latest snapshot or a selected historical snapshot as a STIX 2.0 bundle, a STIX 2.1 bundle, or Workbench JSON. Historical snapshot exports can also copy a concise summary. Tagged snapshots with a bundle cache use that pinned member graph for deterministic member-only exports in either STIX version.

Each cached snapshot card displays server-generated SHA-256 hashes for the exact UTF-8 JSON files produced by its STIX 2.0 and STIX 2.1 bundle downloads. The adjacent copy buttons copy a hash for external file-integrity verification. Snapshot notes are locked while the bundle is cached; delete the cache, edit the notes, and cache the bundle again to generate matching hashes.

#### Adding a Collection Index

Collection indexes can be added from the collections page. To add a collection index, specify the URL at which the index is found. The application will then provide a preview of the index for you to review before you save. You can also choose from the provided "recommended collection indexes" to quickly connect your Workbench instance to a data provider without having to find the URL yourself. The ATT&CK Workbench is pre-configured to recommend the MITRE ATT&CK collection index in the "add a collection index" interface.

Once saved, the Workbench will periodically check for updates to the collection index at the original URL it was loaded from. Thus can data providers update subscribers by updating their collection index with new collections.


#### Subscribing to a Collection

Once a collection index has been added, you can subscribe to a collection listed within the index. Once subscribed, two things will happen:
1. The most recent version of that collection will be downloaded automatically (this may take a few moments depending on the size of the collection)
2. When the collection index updates, any new versions of subscribed collections will be downloaded, helping you stay up-to-date with releases of subscribed collections as the data provider updates their index.

Older versions of subscribed collections will not be automatically downloaded. If you want to access older versions (to peruse object history for instance) you can manually download them by clicking the "download" button next to the version. This will bring you into the "import collection" workflow described below.

#### Manually Importing a collection

There are multiple means through which a collection can be imported. The "import collection" workflow provides the means through which a collection can be specified, its contents reviewed, and then incorporated to the local knowledge base instance.

##### 1. Indicate the Collection

Users can import the collection in several different ways:
- *Import from URL*: In cases where the collection has been hosted on the internet, the user may specify the URL of a collection STIX bundle for the application to download.
- *Upload from file*: Users can upload a STIX bundle representing the collection. You can upload a collection in JSON, CSV, or XLSX format.
- *Import from collection index*: The user can choose to import collections listed by attached _collection indexes_, which are essentially lists of collections on the internet.

##### 2. Review Contents

In this step, the user should review the contents of the collection being imported. The review step is provided to ensure that users have control over the contents of their local knowledge base. Users can choose to only import specific objects from the collection if they so choose, or likewise exclude certain objects from the import. 

While previewing an import the list of contents will be organized by object type, and then by change type. The change types are as follows:
- *Additions*: Additions; objects which were not previously in the knowledge base.
- *Changes*: Updated objects; Objects with major updates such as changes to scope, new reporting, and so forth.
- *Minor changes*: Objects with minor updates such as typo corrections.
- *Revocations*: Objects that have been replaced by other objects.
- *Deprecations*: Objects that have been removed from the dataset.
- *Unchanged*: Objects that already exist in the Workbench and have no changes.  
- *Out of date*: Objects which are outdated by more recent edits in your knowledge base. These objects already exist in your workbench, and the version in the collection is older. The version imported in the collection will appear in the version history of the object.

The following error change types may appear when there are conflicts importing a collection:
- *Import conflicts*: Object supersedes local edits, and the user should merge their changes with the new object content.
- *Other Errors*: The Workbench encountered errors when determining whether the following objects exist within the Workbench already.

After importing a collection, users can review the results of the import from the collection page. The collection review UI reflects the changes that occurred at the time of the import.

##### 3. Incorporate into Knowledge Base

After selecting the objects to import, the application will automatically integrate them into the knowledge base. 

In cases where objects being imported already exist in the knowledge base, the imported object will appear as a new _version_ of that object. 
- If it was edited more recently than the copy already in the knowledge base, it will appear as the most recent version (supersede the version already in the knowledge base). 
- If it was edited less recently than the copy already in the knowledge base, it will appear as a _previous version_ of the object (superseded by the version already in the knowledge base).

In both cases, the user may need to manually merge the two versions to prevent the incoming knowledge, or knowledge created by the user, from being lost. 

### Browsing the Knowledge Base

Once you have imported or created data, you can browse the knowledge base using the simple interface provided. For each object type (excepting relationships) a master list of all objects is provided to find the data you want to explore. Clicking on an entry in that list will preview the description of the object, and provide a link to view the full definition. 

On the view page for a specific object you can also see relationships the object has with other objects in the knowledge base. Clicking on a relationship in the table will open a dialog window with more information about the relationship, such as the modified date and external references.

#### Object Lists

Most object lists include pagination, which improves performance of the application by only loading a few objects at a time. The controls in the bottom of the list provides controls for changing the page size and moving between pages.

Most object lists also support searching and filtering. The search input above such lists will match text within object IDs, names, and descriptions. The options dropdown menu allows you to filter the data. Available filters include:
- Workflow status: quality control workflow status as discussed in the quality control workflows section below.
- State: by default, revoked and deprecated objects are not shown in lists as they are considered removed from the knowledge base. Enabling them in this menu will allow them to appear in the list.
- Domain: available in lists of objects which support the domains field.
- Platform: available in lists of objects which support the platforms field.

#### Reviewing Object History

Object history can be found in the resources drawer, accessible through the icon on the right of the application toolbar. The history tool can only be accessed on an object page.

The history timeline browser allows users to see the revision history of an object itself as well as that of any relationships with the object. Clicking an event within the timeline will show what the corresponding object looked like at that moment in time.

- Events within the timeline are color-coded by type:
    - Purple events correspond to object changes
    - Blue events correspond to relationship changes
	- Gray events correspond to collection events
- Events within the timeline are also differentiated by type, denoted by tooltip and icon:
    - A plus symbol denotes additions, such as the creation of the object itself or the addition of relationships with the object.
    - A pencil symbol denotes modifications. Modifications to the object that change the version number have additional markings.
    - A download icon denotes the first available version of the object, but that earlier versions exist outside of what the user has in their workbench. This occurs when an object has been imported from a collection.
	- A minus symbol denotes removals, such as if the object was removed from a collection.
	- A verified icon denotes releases, such as if the object was included in a collection marked for release.

## Creating Extensions of ATT&CK

Objects imported from collections can be modified, or new objects created. The processes for these are documented in the sections below.

### Attribution of Edits

The Workbench will attribute edits to you when you edit existing objects or create new objects. Attribution is shown next to created and modified dates and in the object history timeline. Attribution is represented by an automatically generated icon to easily distinguish different editing/creating organizations or individuals; hovering over the icon will display the full organization name or user display name. Your user display name can be edited or removed through the user profile page. If removed, your username will be shown in its place for attribution.

Edits you make in the knowledge base are attributed to your _organization identity_, which is unique to your Workbench instance. The organization identity can be edited from the admin page accessible from the application homepage; when you first open the application you will be prompted to edit the organization identity to ensure the placeholder identity is not used. Changes to your organization identity will automatically update objects in the knowledge base, but attribution within exported collections will not be automatically affected. 

### Quality Control Workflows

The ATT&CK Workbench provides optional quality control workflows to assist in the creation of ATT&CK data. Objects are marked with a "workflow status," reflecting their place in the quality control pipeline:
- *work in progress*: this object is being actively developed. Work in progress objects are marked in the UI using a red document icon.
- *awaiting review*: this object is awaiting the review within your organization. Awaiting review objects are marked in the UI using an orange person icon.
- *reviewed*: this object has passed the quality control checks of a reviewer. Reviewed objects are marked using a green checkmark icon.

Object lists can be filtered to show only objects within a specific state to enable reviewers to find the objects awaiting their review, or editors to find objects still in development. You can set the workflow state of an object by clicking on the gear icon in the toolbar while on an object page.

The quality control workflow is intended to be generic in order to support the quality control needs of users and organizations. It will be up to you and/or your organization to decide the review process itself or whether to use the built-in quality control workflows at all.

### Validating Changes

When saving an object, the application will validate the data to ensure the new data has no issues. There are four types of messages that can be shown in the validation window:
- *Successes*, which let you know that things are as they should be. This will tell you that your object has a unique name and ATT&CK ID, and other important messages.
- *Warnings*, which tell you that you might want to make a correction, but don't prevent you from saving altogether. Name conflicts for instance are a warning: nothing will break if there's a conflict, but it should still be avoided if possible. 
- *Errors*, which tell you that you can't save until you've fixed the mistake. ATT&CK ID conflicts, malformed version numbers and duplicate relationships are examples of validation errors.
- *Info*, which convey other information about your changes. Letting you know that you've already incremented the version number (and shouldn't/can't use the automatic version-increment buttons) is an example of an info message.

Once you have reviewed the validation feedback you can proceed to save the object unless errors are present which must be corrected first. If you want to make changes as the result of validation warnings or errors, you can simply click cancel to continue editing.

### Version Numbers

All objects (Excepting relationships) support version numbers. Version numbers can have any level of granularity (e.g `2.1`, `2.1.1`, `2.1.0.5`), but it is recommended to use at least 2 levels of granularity, formatted as `major.minor`:
   - *major* updates include revisions to object scope.
   - *minor* updates include additions to reporting and content that do not change the overall scope of the object.
   <!-- - An optional third level of granularity, *patch* updates include fixes in the object content such as typo corrections. -->

When saving an object, the validation window will prompt you to increment the version number you haven't already edited the version field. We recommend data providers be careful when incrementing versions so as to avoid double-increments between their releases.

### Rich Text Formatting

Some fields of objects support additional formatting features.

#### Markdown

Fields which show a "preview" tab when editing (all descriptions and the detection field found on techniques) allow markdown to be used to format the text. The ATT&CK Workbench uses the [GitHub-Flavored Markdown (GFM)](https://github.github.com/gfm/) syntax, though applications consuming ATT&CK data may not support this extension to the [commonMark](https://commonmark.org/) spec. The preview tab allows the the field formatting to be checked while it is being updated.

#### LinkByIds

LinkByIds are supported in description and detection fields and are used to reference an ATT&CK object. When viewing an object, LinkByIDs are visualized as a full hyperlink within the field and link to the corresponding object's page in the Workbench. 

LinkByIds are formatted in text as `(LinkById: ATT&CK ID)`, which corresponds to the linked object's ATT&CK ID. When exporting collection and STIX bundles, LinkByIds will be replaced with the equivalent markdown formatted hyperlink to the object's page on the [ATT&CK Website](https://attack.mitre.org/).

#### Citations

Description, detection, and alias-description* fields allow for in-text citations, used to reference a primary source relevant to the prior sentence or paragraph. When viewing an object, citations are rendered as a citation marker (e.x: <sup>[1]</sup> ) corresponding to an entry in the external references section of the object page.

Citations are formatted within the text as `(Citation: source name)`, which corresponds to the source name of a reference. This will get compiled to a citation marker with hyperlink when rendered, and the relevant reference added to the references section of the object when it is saved.

The **Reference Manager Tool** can be used to add, view, edit, and find references. The tool can be found under "Reference Manager" in the header, and contains a list of all references on all objects, as well as references you've created to add to objects later. 

- When a collection is imported, all references will be added to the master list in the sidebar.
- Once a reference has been created, you cannot change the source name.
- If you edit the description or URL on an existing reference, any objects which cite this reference will automatically be updated with the adjusted data. The interface will notify you of which objects contain the updated reference. This patch will show up as a change within object history, but will not change the object version number.
- You can use the "copy" button on a reference in the list to quickly copy the in-text citation string to your clipboard to paste into a description or alias.

A complete list of references can also be found in the resources drawer by clicking the icon on the far right of the toolbar. This provides a convenient way to add, find, or copy a reference without leaving the current object being viewed or edited.

_\* Unlike other descriptions, alias descriptions do not support markdown and typically only contain citations without other text._

### ATT&CK IDs

ATT&CK IDs must follow a prescribed format:

| Object Type | ID Format |
|:------------|:----------|
| Matrix           | (domain identifier)* |
| Tactic           | `TAxxxx` |
| Technique        | `Txxxx` |
| Sub-Technique    | `Txxxx.yyy` |
| Mitigation       | `Mxxxx` |
| Campaign         | `Cxxxx` |
| Group            | `Gxxxx`  |
| Software         | `Sxxxx` |
| Data Source (deprecated)      | `DSxxxx` |
| Detection Strategy | `DETxxxx` |
| Log Source | `LSxxxx` |
| Analytic | `ANxxxx` |

_\* Domain identifiers for Matrices are described in the section for editing matrices._

### Creating Objects

Object creation follows the same approach as object editing. Objects can be created from the object list pages by clicking the "add" button above the object list. When creating an object, required fields will be marked with an asterisk and must be filled before the object can be created.

Objects are initially created in the "work in progress" workflow state.

#### Creating Relationships

Relationships connecting two objects (e.g procedure examples, associated groups) can be created from object pages themselves by clicking the "add" button above the relevant relationship table. The source and target objects _must_ be selected before the relationship can be created. The remainder of the creation process otherwise follows the standard process for editing relationships.

Relationship source/target objects can be changed after the relationship has been created, but the type of the relationship cannot (e.g a `mitigates` relationship cannot be converted to a `uses` relationship).

#### Creating Marking Definition Statements

Marking definition statements can be created and assigned to individual objects. Marking definition objects differ from other objects because they cannot be edited after creation and workflow states are not tracked.

#### Default Marking Definition Statements

Default marking definition statments can be set in the admin page. Selected marking definition statements will be applied by default to any newly created objects. If you edit an object that does not have the default marking definitions, it will be added automatically on save.

#### Adding Statements and TLP Marking Definitions

When creating and/or editing an object, you can add multiple statements and select one of the four standard TLP markings. TLP markings are loaded by the REST API and cannot be created and/or edited from the front end.

### Editing Objects

Any object in the knowledge base, except for marking definitions, can be edited, even those imported from collections. Clicking the "edit" button in the toolbar, or the "edit" link in an object list, will bring you to the edit interface for the object. While editing an object, relationships cannot be viewed or created since they are saved independently of the objects they connect.

Domain-bearing ATT&CK objects expose a Domain field that reads and writes the STIX `x_mitre_domains` list. This includes techniques, campaigns, mitigations, groups, software, analytics, assets, data components, data sources, detection strategies, matrices, and tactics. When an existing object is revised, its domains are retained unless the editor explicitly changes them.

#### Editing Matrices

Matrices share the typical fields on objects, including a description supporting markdown, LinkByIds, and citations. Unlike other object types, their IDs serve as identifier for their domain:

| Domain | ID |
|:------------|:----------|
| Enterprise     | enterprise-attack |
| Mobile           | mobile-attack |
| ICS           | ics-attack |

Multiple matrices _can_ exist for a domain (e.x _Device Access_ and _Network-Based Effects_ in the Mobile domain), and matrices of the same domain share IDs.

##### Editing Tactics on Matrices

The order of tactics in matrices can be added, ordered, and removed. Tactic ordering can be completed by using the mouse to drag and drop the entire row or by clicking on the up/down arrows. Tactics recently added to the matrix will appear at the bottom of the tactic list.

##### Matrix Relationships

Matrices do not have any associated relationships.

#### Editing Techniques

Techniques represent "how" an adversary achieves a tactical goal by performing an action. For example, an adversary may dump credentials to achieve credential access.

Like all objects, techniques support descriptions with markdown, LinkByIds, and citation support. The detection field also supports markdown, LinkByIds, and citations. Additionally, techniques list relevant platforms according to their domain. After a domain has been selected, the user may select the relevant platforms from the dropdown menu.

##### Sub-techniques

Sub-techniques are a more specific description of the adversarial behavior used to achieve a goal. Techniques and sub-techniques are both represented in the techniques section of the application, with sub-techniques nested beneath their parent technique in the "Sub-techniques" section of the page. A technique can be converted to a sub-technique by checking the "sub-technique?" box in the edit interface, after which point parent (non-sub-techniques) techniques can create relationships with them.

##### Domain/Tactic Specific Fields

The set of fields available to edit on a technique differs according to the domains and tactics of the technique. Domain specific fields are displayed in the same row as the domain field, and tactic specific fields are displayed in the same row as the tactics field.

| Field | Domains | Tactics? |  Description |
|:------|:--------|:---------|:-------------|
| Data Sources | ICS | (All Tactics) | Sources of information that may be used to identify the action or result of the action being performed. |
| sub-technique? | Enterprise | (All Tactics) | Is this object a sub-technique? This cannot be changed for sub-techniques with assigned parents, or for parent-techniques with assigned sub-techniques. |
| System Requirements | Enterprise | (All Tactics) | Additional information on requirements the adversary needs to meet or about the state of the system (software, patch level, etc.) that may be required for the technique to work. |
| Permissions Required | Enterprise | Privilege Escalation | The lowest level of permissions the adversary is required to be operating within to perform the technique on a system. |
| Effective Permissions | Enterprise | Privilege Escalation | The level of permissions the adversary will attain by performing the technique. | 
| Defenses Bypassed | Enterprise | Defense Evasion | List of defensive tools, methodologies, or processes the technique can bypass. |
| Remote Support | Enterprise | Execution | Can the technique can be used to execute something on a remote system? |
| Impact Type | Enterprise | Impact | Denotes if the technique can be used for integrity or availability attacks. |
| CAPEC IDs | Enterprise | (All Tactics) | [CAPEC](https://capec.mitre.org/) IDs associated with the technique. Must follow the format `CAPEC-###`. |
| MTC IDs | Mobile | (All Tactics) | NIST [Mobile Threat Catalogue](https://pages.nist.gov/mobile-threat-catalogue/) IDs associated with the technique. Must follow the format `[Threat Category]-###`. |
| Tactic Type | Mobile | (All Tactics) | "Post-Adversary Device Access", "Pre-Adversary Device Access", or "Without Adversary Device Access". |


##### Technique Relationships

| Relationship Section                       | Description |
|:-----|:----|
| Sub-techniques / Other Sub-techniques      | Sub-techniques of the technique if it is a parent technique, or other sub-techniques of the parent | is a sub-technique.
| Campaigns                                  | Campaigns that use this technique |
| Mitigations                                | Mitigations that apply to this technique |
| Procedure Examples                         | Groups and software that use this technique |
| Data Sources (deprecated)                  | Data components that detect this technique |
| Detection Strategies | Strategies that detect this technique |

#### Editing Tactics

Tactics represent the "why" of an ATT&CK technique or sub-technique. It is the adversary's tactical goal: the reason for performing an action. For example, an adversary may want to achieve credential access. 

Tactics support the standard set of fields, including a description supporting citations, LinkByIds, and markdown formatting. Tactics must be assigned to a domain before techniques can be assigned to them. The assignment of techniques to tactics can only be done on the techniques page.

##### Tactic Relationships

Tactics do not have any associated relationships.
#### Editing Mitigations

Mitigations represent security concepts and classes of technologies that can be used to prevent a technique or sub-technique from being successfully executed. They support the standard set of fields and must be assigned to a domain. 

A special mitigation published within the Enterprise domain, "Do Not Mitigate," should be used to mark any techniques which should not be mitigated.
##### Mitigation Relationships

| Relationship Section                    | Description |
|:-----|:----|
| Techniques Addressed by Mitigation      | Techniques the mitigation addresses / mitigates. |

#### Editing Campaigns

Campaigns are a grouping of adversarial behaviors that describe activities or attacks that occur over a period of time. Overlaps between names based on publicly reported associations are tracked using "Associated Campaigns" (also known as "Aliases").

Campaigns support the standard set of fields, including a description supporting citations, LinkByIds, and markdown formatting, as well as the "Associated Campaigns" field. Each associated campaign is tracked using a name and description. The alias description is typically used to hold a set of citations, though plain-text can also be entered alongside citations if additional context is necessary. Alias names cannot be changed after they are added, but the description can be changed by clicking on the entry in the associated campaigns list. Additionally, campaigns support optional first and last seen fields to identify the period of time activity was seen for a particular campaign.

##### Campaign Relationships

| Relationship Section                    | Description |
|:-----|:----|
| Groups | Groups involved in carrying out the campaign |
| Techniques Used | Techniques used as part of the campaign |
| Software Used | Software used as part of the campaign |

#### Editing Groups

Groups are sets of related intrusion activity that are tracked by a common name in the security community. Overlaps between names based on publicly reported associations are tracked using "Associated Groups" (also known as "Aliases").

Groups support the standard set of fields as well as the "Associated Groups" field. Each associated group is tracked using a name and description. The alias description is typically used to hold a set of citations, though plain-text can also be entered alongside citations if additional context is necessary. Alias names cannot be changed after they are added, but the description can be changed by clicking on the entry in the associated groups list.

##### Group Relationships

| Relationship Section                    | Description |
|:-----|:----|
| Campaigns | Campaigns attributed to the group |
| Techniques Used      | Techniques used by the group. Note that this should not include indirect usages through software, which should be expressed by mapping to the software itself. |
| Software Used      | Software used by the group |

#### Editing Software

Software is a generic term for custom or commercial code, operating system utilities, open-source software, or other tools used to conduct behavior modeled in ATT&CK. Some instances of software have multiple names associated with the same instance due to various organizations tracking the same set of software by different names. The team makes a best effort to track overlaps between names based on publicly reported associations, which are designated as “Associated Software” on each page (also known as "Aliases").

Software support the standard set of fields as well as the "Associated Software" field. Each associated software is tracked using a name and description. The alias description is typically used to hold a set of citations, though plain-text can also be entered alongside citations if additional context is necessary. Alias names cannot be changed after they are added, but the description can be changed by clicking on the entry in the associated software list.

##### Types of Software 

Two types of software exist, _malware_ and _tool_:
- *malware*: commercial, custom closed source, or open source software intended to be used for malicious purposes by adversaries.
- *tool*: commercial, open-source, built-in, or publicly available software that could be used by a defender, pen tester, red teamer, or an adversary.

The software type must be selected when creating it and due to limitations of the data model cannot be changed after the software is created. If the type must be changed, create a new object of the other type and _revoke_ the old object with the replacing object.

##### Software Relationships

| Relationship Section                    | Description |
|:-----|:----|
| Campaigns | Campaigns that use this software |
| Techniques Used      | Techniques used by the software |
| Associated Groups    | Groups that use this software |

#### Editing Data Sources (deprecated)

Data sources represent relevant information that can be collected by sensors or logs to detect adversary behaviors. Data sources
include data components to provide an additional layer of context and identify the specific properties of a data source
that are relevant to detecting an ATT&CK technique or sub-technique.

Data sources support the standard set of fields and also define collection layers, which are a description of where the data source may be
physically collected. After a data component has been added to a data source, the user can create relationships with techniques in the
data component dialog window.

##### Data Source Relationships

| Relationship Section                    | Description |
|:-----|:----|
| Data Components      | Data components related to this data source |

##### Data Component Relationships (deprecated)

| Relationship Section                    | Description |
|:-----|:----|
| Techniques Detected      | Techniques detected by the data component |

#### Editing Data Components

Data Components identify the specific properties/values relevant to detecting a given ATT&CK technique or sub-technique.

##### Data Component Relationships

While Data Components do not have direct relationships with other objects, they are linked to Analytics through the list of log source references on Analytics (specifically, the `x_mitre_data_component_ref` property in each entry of the `x_mitre_log_source_references` array).

#### Editing Detection Strategies

Detection strategies define high-level approaches for detecting specific adversary techniques. They serve as containers that organize multiple platform-specific analytics into cohesive detection methodologies.

##### Detection Strategy Relationships

| Relationship Section                    | Description |
|:-----|:----|
| Technqiues | Techniques detected by the detection strategy. |

#### Editing Analytics

Analytics contain platform-specific detection logic and represent the implementation details of a detection strategy.

##### Analytic Relationships

While Analytics do not have direct relationships with other objects, they are linked to Detection Strategies through the list of analytic STIX ID references on Detection Strategies (specifically, the `x_mitre_analytic_refs` field)

#### Editing Relationships

Relationships map objects to other objects. Relationships have types, sources, and targets. The source and targets define the objects connected by the relationship, and the type is a verb describing the nature of their relationship.


| Relationship Type | Valid Source Types | Valid Target Types |
|:-----|:----|:---|
| uses              | Campaign, Group, Software*  | Software*, Technique |
| mitigates         | Mitigation       | Technique |
| subtechnique-of   | Technique        | Technique |
| detects           | Detection Strategy, Data Component (deprecated)   | Technique |
| attributed-to     | Campaign         | Group     |

_\* Relationships cannot be created between two software._

Relationships are edited within a dialog window accessed by clicking on the relationship row in the relevant table its source or target object. Then, in the dialog window, you can click the edit button in the dialog toolbar.

The source and target objects can be changed after the relationship has been created, but the relationship type cannot. Thus could a procedure example be remapped to a new technique based off updated reporting or adjustments to technique scope, for example.

Relationships also have a description to provide additional context or to hold citations of relevant reporting. Like all descriptions, those on relationships support citations, LinkByIds, and markdown formatting. Relationships between sub-techniques and techniques however are purely structural and do not support descriptions.

Saving a relationship creates a new relationship revision and returns its connected source and target objects to the *work in progress* workflow state through new SDO revisions. Previously published or snapshot-pinned SDO revisions remain unchanged.

### Revoking and Deprecating Objects

All objects within the knowledge base can be _revoked_ or _deprecated_. These functionalities allow you to remove irrelevant or outdated objects without deleting them outright since deletions cannot be propagated to data consumers subscribed to your collections. Revoked and deprecated objects are hidden from UIs unless the user explicitly chooses to display them.

- _Revoked_ objects are objects that are replaced by others within the knowledge base. Revoke an object by clicking the gear icon in the toolbar while on an object page and then clicking "revoke." You will then be prompted to select the revoking (replacing) object. Relationships cannot be revoked, only deprecated.
- _Deprecated_ objects are objects that you want to remove without indicating a replacement. Deprecate an object by clicking the gear icon in the toolbar while on an object page and then clicking "deprecate." We also recommend prepending a paragraph to the object description explaining the reason for the deprecation, although this is optional.

When an object is revoked or deprecated, all relationships attached to the object in question will themselves be deprecated. 

### Deleting Objects

Objects can be deleted from the knowledge base from the edit page by clicking on the "edit" button followed by the "delete" button in the toolbar. This functionality allows you to remove any incomplete or extraneous objects which do not have relationships with other objects and have not been previously exported or published.

Deletion is limited to Technique, Mitigation, Group, Software, Data Source, Data Component, and Relationship objects. When a sub-technique is deleted, the associated `subtechnique_of` relationship will also be deleted. Additionally, a reference can be deleted if it is not cited by any objects in the knowledge base.

## Annotating ATT&CK Data

Annotations allow users to add additional information about an object in the dataset without extending it directly. This is useful for a number of reasons, most notably that incoming updates from a data provider won't overwrite notes but _can_ conflict with local changes to the object itself. 

Uses of notes include but are not limited to:
- Sharing informal knowledge within an organization (e.g "This mitigation might be useful to protect us from _X_")
- Recording potential knowledge (e.g "TODO: verify whether the mention in threat report _X_ is actually this technique")
- Enabling collaboration in development workflows (e.g "Marcie, make sure to update the platforms once you finish determining the technique scope")

Annotations in the ATT&CK Workbench are implemented through _notes_. Typically notes are not published outside of a Workbench instance, and are intended to be local knowledge. Notes are associated directly with objects within the knowledge base, and cannot exist without an attached object.

### Creating Notes

The Note Editor is found within the resources drawer accessible through the button on the far right of the toolbar. The note editor is only available when on the page for an object, and created notes will only be visible within that page. Notes within the editor can be sorted by modified date or alphabetically by title.

Notes have titles and descriptions, both of which must be filled in order to save the note. The description field supports markdown. Once saved, a note can be edited by clicking on it in the note editor.

### Searching notes

Notes are searchable through the "More" option in the dropdown menu within the notes option.  You can search notes by content, title, and which user created the note.  Clicking on a note within the list will open up the object the note is associated with, as well as the selected note.

## Sharing Your Extensions

Objects you create can be published in collections. Please see the [collections document](/docs/collections.md) for more information about the representation and intention of collections.

You can create new collections and manage releases from the "my collections" tab of the collections page. This tab will track all published releases of your collections as well as any work in progress releases. Previously published releases cannot be edited, but you can always draft a new release from the most recent version of the collection.

### Staging Changes
When editing a collection, you can stage changes for each object type. Changes are shown as compared to the previous release of the collection, so if you had previously released "example collection v0.1" your staged and potential changes will be shown against that version. Changes are grouped by type:
- *Additions*: Objects added in this release.
- *Changes*: Objects changed by this release where the version number has been incremented.
- *Minor changes*: Objects changed by this release where the version number has _not_ been incremented.
- *Revocations*: Objects that have been revoked by this release.
- *Deprecations*: Objects that have been deprecated by this release.
- *Unchanged*: Objects that have not changed with this release.

Within each change type, two lists are shown. On the left are _potential changes_, the contents of your knowledge base that you can add to your collection. On the right are the staged changes for the given change section. For instance, for "additions", the left list shows objects not present in the collection at all, and the right list shows objects which have been added in this release. For "changes", the left list shows objects with newer versions available in the knowledge base, and the right list shows staged changes.

You can move objects from the left ("potential") list to the right ("staged") list or vice versa by clicking the button on the left or right of the object row. You can also move the entire contents of the list (e.g staging all group changes) by clicking the double arrow button between the two lists.

Clicking on an object within the list will open a preview dialog to show the contents of the object.

#### Importing a group into a collection
When editing a collection, there is an option to import a group and all of it's related objects into the collection being edited.

### Handling Relationships

Unlike other object types, relationships are handled automatically by the system. When a collection is saved, the relationships included are determined automatically according to the other contents of the collection.

 -  All relationships between objects in the collection are included at their most recent version.
    - New relationships between objects already in the collection are included even if their attached objects did not change or the changes to said objects were not staged.
    - Existing relationships are updated if newer versions are available even if the objects they are attached to did not change or the changes to said objects were not staged.
    - New and updated relationships are added at the version they existed at when the collection is saved; further updates to relationships after saving will not be included. 
 - Relationships are only included if both of their attached objects are in the collection. 
 - Relationships conveying revocations will be included only if the revoked version of the object they are attached to is included (staged) in the collection. Objects which have revoked versions not included in the collection won't trigger the inclusion of revoking relationships. 

A summary of the relationships included is provided when saving the relationship.

### Marking Releases

After drafting multiple iterations of a new release, it comes time to mark one as the actual version to be released. This can be done prior to saving the collection by checking the "is release version?" checkbox. This has several effects:

- Versions marked as releases will be considered when determining the changes between collection releases. The next version you create after the release will be compared to this prior release when staging changes.
- Collection releases will show up independently within the collections list. 

These effects will occur even if the collection you marked as release was never published, and you cannot un-mark a collection version as a release. Therefore it is very important to be sure that the version you mark as a release is actually the one you intend to publish.

### Accessing Collection Data

The data from a collection can be accessed as a raw STIX bundle from the collection view page. A hyperlink is provided for use in scripts or tools which are built to pull collections over HTTP, and the download button can also be used to download the collection data as a JSON file. These resources provide the means to publish your collections for other users of the ATT&CK Workbench, whether it be by uploading the JSON to GitHub, mailing a floppy disk, or some other means of data transmission.


## Teams

Workbench now supports the ability to create teams in order to allow admins to keep track of users and the changes they make within workbench.

### View a team

Admins have an option within the "More" dropdown option to select teams.  This brings up a list of every team present in your instance of workbench.  You can search teams by their name or description.

### Creating a team

Within the page showing the list of teams, there is an option to create a new team.  Teams require a name and have an optional description field.  Users can be added or removed from a team at any time.

### Editing a team

When viewing a team, click the edit icon in the toolbar to edit it.  You can edit the name, description, or user list of a team at any time.
