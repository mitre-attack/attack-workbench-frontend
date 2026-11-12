import { SelectionModel } from '@angular/cdk/collections';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatStepper } from '@angular/material/stepper';
import { ActivatedRoute } from '@angular/router';
import {
  Analytic,
  Asset,
  Campaign,
  DataComponent,
  DataSource,
  DetectionStrategy,
  Group,
  Matrix,
  Mitigation,
  Relationship,
  Software,
  Tactic,
  Technique,
} from 'src/app/classes/stix';
import {
  Collection,
  CollectionDiffCategories,
} from 'src/app/classes/stix/collection';
import { ConfirmationDialogComponent } from 'src/app/components/confirmation-dialog/confirmation-dialog.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { UserAccount } from 'src/app/classes/authn/user-account';
import { logger } from '../../../../../utils/logger';
import { v4 as uuid } from 'uuid';
import { PhaseProgress } from 'src/app/components/loading-overlay/loading-overlay.component';
import type * as XLSXNS from 'xlsx';

@Component({
  selector: 'app-collection-import',
  templateUrl: './collection-import.component.html',
  styleUrls: ['./collection-import.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class CollectionImportComponent implements OnInit {
  @ViewChild(MatStepper) public stepper: MatStepper;
  @ViewChild('fileInput') public fileInput!: ElementRef<HTMLInputElement>;

  public url = '';
  public loadingStep1 = false;
  public loadingStep2 = false;
  public importProgress = 0; // 0-100 (legacy)
  public phaseProgress: PhaseProgress[] = []; // Multi-phase progress
  public select: SelectionModel<string>;
  // ids of objects which have changed (object-version not already in knowledge base)
  public changed_ids: string[] = [];
  // ids of objects which have not changed (object-version not already in knowledge base)
  public unchanged_ids: string[] = [];
  public errorObjects: any[] = []; // list of objects that did not have enough required fields to be imported
  public import_errors: any;
  public save_errors: string[] = [];
  public successfully_saved = new Set<string>();
  public collectionBundle: any;
  public csvWarning: boolean;

  public get user(): UserAccount {
    return this.authenticationService.currentUser;
  }

  public object_import_categories = {
    technique: new CollectionDiffCategories<Technique>(),
    tactic: new CollectionDiffCategories<Tactic>(),
    campaign: new CollectionDiffCategories<Campaign>(),
    software: new CollectionDiffCategories<Software>(),
    relationship: new CollectionDiffCategories<Relationship>(),
    mitigation: new CollectionDiffCategories<Mitigation>(),
    matrix: new CollectionDiffCategories<Matrix>(),
    group: new CollectionDiffCategories<Group>(),
    data_source: new CollectionDiffCategories<DataSource>(),
    data_component: new CollectionDiffCategories<DataComponent>(),
    asset: new CollectionDiffCategories<Asset>(),
    analytic: new CollectionDiffCategories<Analytic>(),
    detection_strategy: new CollectionDiffCategories<DetectionStrategy>(),
  };

  // list of headers that comes from mitre-generated excel files and the mapping to support collection objects
  public replacementList = [
    ['ID', 'attack_id'],
    ['STIX ID', 'id'],
    ['descriptions', 'description'],
    ['platforms', 'x_mitre_platforms'],
    ['version', 'x_mitre_version'],
    ['domain', 'x_mitre_domains'],
    ['data sources', 'x_mitre_data_sources'],
    ['is sub-technique', 'x_mitre_is_subtechnique'],
    ['last modified', 'modified'],
    ['first seen', 'first_seen'],
    ['last seen', 'last_seen'],
    ['first seen citation', 'x_mitre_first_seen_citation'],
    ['last seen citation', 'x_mitre_last_seen_citation'],
    ['target ref', 'target_ref'],
    ['source ref', 'source_ref'],
    ['source name', 'source_name'],
    ['target name', 'target_name'],
    ['source type', 'source_type'],
    ['target type', 'target_type'],
    ['source ID', 'source_id'],
    ['target ID', 'target_id'],
    ['mapping description', 'description'],
    ['mapping type', 'relationship_type'],
    ['collection layers', 'x_mitre_collection_layers'],
  ];

  private typeUrlMap = {
    'attack-pattern': 'techniques',
    'malware': 'software',
    'tool': 'software',
    'intrusion-set': 'groups',
    'campaign': 'campaigns',
    'course-of-action': 'mitigations',
    'x-mitre-tactic': 'tactics',
    'x-mitre-data-source': 'datasources',
    'x-mitre-data-component': 'datacomponents',
    'x-mitre-asset': 'assets',
    'x-mitre-matrix': 'matrices',
    'x-mitre-detection-strategy': 'detectionstrategies',
    'x-mitre-analytic': 'analytics',
  };

  constructor(
    public route: ActivatedRoute,
    public http: HttpClient,
    public snackbar: MatSnackBar,
    public restAPIConnectorService: RestApiConnectorService,
    private dialog: MatDialog,
    private authenticationService: AuthenticationService
  ) {
    // intentionally left blank
  }

  ngOnInit(): void {
    this.csvWarning = false;
    if (this.route.snapshot.queryParams['url']) {
      // get URL
      this.url = decodeURIComponent(this.route.snapshot.queryParams['url']);
      this.getCollectionFromURL();
    }
  }

  /**
   * Load collection from file input
   * @param event file input event
   */
  public getCollectionFromFile(event: any) {
    const file = event.target.files[0];
    const filename = file.name.split('.')[0];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['json', 'csv', 'xlsx'];

    if (!fileExtension || !validExtensions.includes(fileExtension)) {
      this.snackbar.open(
        `Unsupported file format: ${fileExtension}`,
        'dismiss',
        {
          duration: 2000,
          panelClass: 'warn',
        }
      );
      return;
    }

    this.loadingStep1 = true;
    this.errorObjects = [];
    const reader = new FileReader();

    reader.onload = async (e: any) => {
      const str = String(e.target.result);
      try {
        const result = e.target.result;
        if (fileExtension === 'json') {
          // parse .json
          const collectionBundle = JSON.parse(str);
          this.previewCollection(collectionBundle);
        } else {
          // parse .csv or .xlsx
          const XLSX: typeof XLSXNS = await import('xlsx');
          const workbook: XLSXNS.WorkBook = XLSX.read(result, {
            type: 'binary',
          });
          const collectionBundle = this.buildXlsxRequest(
            XLSX,
            workbook,
            filename
          );
          this.csvWarning = true;
          this.previewCollection(collectionBundle);
        }
      } catch (exception) {
        this.snackbar.open(exception.message, 'dismiss', {
          duration: 2000,
          panelClass: 'warn',
        });
        this.loadingStep1 = false;
      }
    };

    reader.onerror = () => {
      this.snackbar.open('Error reading file.', 'dismiss', {
        duration: 2000,
        panelClass: 'warn',
      });
      this.loadingStep1 = false;
    };

    if (fileExtension === 'json') {
      reader.readAsText(file, 'utf-8');
    } else reader.readAsArrayBuffer(file);
  }

  /**
   * Helper function to parse csv and excel files into collections
   * @param wb Workbook or csv to be parsed
   * @param filename input file name
   * @returns a collection to be uploaded to workbench
   */
  public buildXlsxRequest(
    XLSX: typeof XLSXNS,
    wb: XLSXNS.WorkBook,
    filename: string
  ): any {
    const timestamp = new Date().toISOString();
    const collection = [
      {
        name: filename,
        type: 'x-mitre-collection',
        id: 'x-mitre-collection--' + uuid(),
        x_mitre_deprecated: false,
        x_mitre_version: '0.1',
        created: timestamp,
        revoked: false,
        object_marking_refs: [],
        x_mitre_domains: [],
        spec_version: '2.1',
        created_by_ref: this.user.id,
        x_mitre_modified_by_ref: this.user.id,
        modified: timestamp,
        description: '',
        x_mitre_contents: [],
      },
    ];

    const domains = new Set<string>();
    const attackObjects = [];

    // helpers for parsing relationship source/target objects
    const relationships = [];
    const objectLookup = new Map<string, string>(); // attackId -> stixId
    const componentLookup = new Map<string, string>(); // data component name -> stixId

    // helpers for parsing data component parent objects
    const components = [];
    const sourceLookup = new Map<string, string>(); // data source name => stixId

    function zipObject(keys: string[], values: any[]) {
      const out: Record<string, any> = {};
      for (let i = 0; i < keys.length; i++) {
        out[keys[i]] = values[i];
      }
      return out;
    }

    for (const sheetname of wb.SheetNames) {
      const data: string[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetname], {
        header: 1,
      });
      const headerRow = this.getHeader(data);

      data.forEach(row => {
        // create an object for the row
        const rowData = zipObject(headerRow, row);

        if (rowData.reference && rowData.citation && 'url' in rowData) {
          return; // citation detected, skip
        }

        const sdo = this.parseObject(rowData, timestamp);
        if (sdo.x_mitre_domains?.length) {
          sdo.x_mitre_domains.forEach((d: string) => domains.add(d));
        }

        if (!sdo.id) {
          // report object error if object cannot be identified
          this.errorObjects.push(sdo);
          return;
        }

        // update object lookup maps
        if (sdo.attack_id) {
          objectLookup.set(sdo.attack_id, sdo.id);
          if (sdo.type && sdo.type == 'x-mitre-data-source' && sdo.name) {
            sourceLookup.set(sdo.name, sdo.id);
          }
        } else if (
          sdo.type &&
          sdo.type == 'x-mitre-data-component' &&
          sdo.name
        ) {
          // attempt to parse data component name
          let name = sdo.name.split(':');
          if (name.length > 1) name = name[1].trim();
          else name = name[0].trim();
          componentLookup.set(name, sdo.id);
        }

        // add objects to relevant lists
        if (sdo.type && sdo.type == 'relationship') relationships.push(sdo);
        else if (sdo.type && sdo.type == 'x-mitre-data-component')
          components.push(sdo);
        else {
          attackObjects.push(sdo);
        }
      });
    }

    // parse relationship source/target objects
    relationships.forEach(r => {
      // source
      if (r.source_id && objectLookup.get(r.source_id)) {
        r.source_ref = objectLookup.get(r.source_id);
      } else if (
        r.source_type &&
        [
          'x-mitre-data-component',
          'datacomponent',
          'data-component',
          'data component',
        ].includes(r.source_type) &&
        r.source_name &&
        componentLookup.get(r.source_name)
      ) {
        // no ATT&CK ID - try to ID by name
        r.source_ref = componentLookup.get(r.source_name);
      }

      // target object
      if (r.target_id && objectLookup.get(r.target_id)) {
        r.target_ref = objectLookup.get(r.target_id);
      } // data components are not valid target objects

      if (r.source_ref && r.target_ref) {
        // if valid relationship, add to collection bundle
        attackObjects.push(r);
      } else {
        this.errorObjects.push(r);
      }
    });

    // try to parse data component source references
    components.forEach(d => {
      // attempt to parse data component/data source name
      const names = d.name.split(':');
      if (names.length > 1) {
        d.name = names[1].trim();

        const source_name = names[0].trim();
        d.x_mitre_data_source_ref = sourceLookup.get(source_name);
        if (d.x_mitre_data_source_ref) {
          attackObjects.push(d);
        } else {
          this.errorObjects.push(d);
        }
      }
    });

    // set collection domains
    collection[0].x_mitre_domains = Array.from(domains.values());

    // add objects to collection contents
    attackObjects.forEach(obj => {
      collection[0].x_mitre_contents.push({
        object_ref: obj.id,
        object_modified: obj.modified,
      });
    });

    // build bundle object
    const bundle = {
      type: 'bundle',
      id: 'bundle--' + uuid(),
      spec_version: '2.1',
      objects: collection.concat(attackObjects),
    };

    return bundle;
  }

  /**
   * Get the header row of the Excel spreadsheet for variable conversion
   * @param data the spreadsheet data
   * @returns the header row of the spreadsheet
   */
  public getHeader(data: any) {
    const header: string[] = data.splice(0, 1)[0];

    // update headers to transfer between excel spreadsheet and variables
    this.replacementList.forEach(i => {
      if (header.includes(i[0])) {
        header[header.indexOf(i[0])] = i[1];
      }
    });

    if (!header.includes('type')) header.push('type');
    header.push('spec_version', 'external_references');

    return header;
  }

  /**
   * Parse the given object variables into correct types
   * @param i the object to parse
   * @param timestamp default timestamp to use for created/modified dates
   * @returns the parsed object
   */
  public parseObject(i: any, timestamp: string) {
    // try to generate a stix id from type or ATT&CK ID
    if (!i.id) this.generateId(i);

    // parse variables into correct types
    i.attack_id = i.attack_id ? i.attack_id : '';
    i.description = i.description ? i.description : '';
    i.type = i.id ? i.id.split('--')[0] : '';
    i.x_mitre_version = i.x_mitre_version
      ? i.x_mitre_version.toString()
      : '1.0';
    i.spec_version = '2.1';
    i.x_mitre_is_subtechnique = Boolean(i.x_mitre_is_subtechnique);
    i.created = i.created ? new Date(i.created).toISOString() : timestamp;
    i.modified = i.modified ? new Date(i.modified).toISOString() : timestamp;
    i.x_mitre_platforms = i.x_mitre_platforms
      ? i.x_mitre_platforms.split(',').map((p: string) => p.trim())
      : [];
    i.x_mitre_data_sources = i.x_mitre_data_sources
      ? i.x_mitre_data_sources.split(',').map((ds: string) => ds.trim())
      : [];
    i.x_mitre_contributors = i.contributors
      ? i.contributors.split(',').map((c: string) => c.trim())
      : [];
    i.x_mitre_detection = i.detection ? i.detection : '';
    i.x_mitre_domains = i.x_mitre_domains
      ? i.x_mitre_domains.split(',').map((d: string) => d.trim())
      : [];
    i.x_mitre_collection_layers = i.x_mitre_collection_layers
      ? i.x_mitre_collection_layers.split(',').map((l: string) => l.trim())
      : [];

    // parse object aliases
    i = this.parseAliases(i);

    // add ATT&CK ID entry to external references
    if (i.attack_id.length && this.typeUrlMap[i.type]) {
      i.external_references = [
        {
          source_name: 'mitre-attack',
          external_id: i.attack_id,
          url: `https://attack.mitre.org/${this.typeUrlMap[i.type]}/${i.attack_id.replace(/\./g, '/')}`,
        },
      ];
    }

    return i;
  }

  /**
   * Parse object aliases, if applicable
   * @param i the object to parse
   * @returns the object with parsed aliases
   */
  public parseAliases(i: any) {
    // software aliases
    if (i.aliases && ['malware', 'tool'].includes(i.type)) {
      i.x_mitre_aliases = i.aliases.split(',').map((a: string) => a.trim());
      i.x_mitre_aliases.splice(0, 0, i.name);
    }

    // group aliases
    if (i['associated groups'] && i.type == 'intrusion-set') {
      i.aliases = i['associated groups']
        .split(',')
        .map((g: string) => g.trim());
      i.aliases.splice(0, 0, i.name);
    }

    // campaign aliases
    if (i.type == 'campaign') {
      if (i['associated campaigns']) {
        i.aliases = i['associated campaigns']
          .split(',')
          .map((c: string) => c.trim());
        i.aliases.splice(0, 0, i.name);
      }
      if (
        !i['first_seen'] ||
        !i['x_mitre_first_seen_citation'] ||
        !i['last_seen'] ||
        !i['x_mitre_last_seen_citation']
      ) {
        i.id = '';
      }
    }

    return i;
  }

  /**
   * Download collection from URL
   */
  public getCollectionFromURL() {
    this.loadingStep1 = true;
    const headers: HttpHeaders = new HttpHeaders({
      ExcludeCredentials: 'true',
    });
    const subscription_getBundle = this.http
      .get(this.url, { headers: headers })
      .subscribe({
        //get the raw collection bundle from the endpoint
        next: collectionBundle => this.previewCollection(collectionBundle),
        error: err => {
          logger.error(err);
          this.snackbar.open(err.message, 'dismiss', {
            duration: 2000,
            panelClass: 'warn',
          });
          this.loadingStep1 = false;
        },
        complete: () => {
          subscription_getBundle.unsubscribe();
        }, //prevent memory leaks
      });
  }

  /**
   * Fetch collection to preview
   * @param collectionBundle collection to preview
   */
  public previewCollection(collectionBundle) {
    // send the collection bundle to the backend
    const subscription_preview = this.restAPIConnectorService
      .previewCollectionBundle(collectionBundle)
      .subscribe({
        next: preview_results => {
          if (preview_results.error) {
            // errors occurred when fetching collection preview
            this.import_errors = preview_results.error;
          }

          if (!preview_results.preview) {
            // collection bundle cannot be imported, show errors on next step
            this.loadingStep1 = false;
            this.stepper.next();
          } else {
            // successfully fetched preview
            this.parsePreview(collectionBundle, preview_results.preview);
          }
        },
        error: () => {
          this.loadingStep1 = false;
        },
        complete: () => {
          subscription_preview.unsubscribe();
        },
      });
  }

  /**
   * Parse collection bundle for preview
   * @param collectionBundle the collection bundle
   * @param preview fetched preview results
   */
  public parsePreview(collectionBundle: any, preview: Collection) {
    this.collectionBundle = collectionBundle; //save for later

    //build ID to category lookup
    const idToCategory = {};

    for (const category in preview.import_categories) {
      for (const stixId of preview.import_categories[category])
        idToCategory[stixId] = category;
    }
    //build ID to name lookup
    const idToSdo = {};
    for (const object of collectionBundle.objects) {
      if ('id' in object) idToSdo[object.id] = { stix: object };
    }

    for (const object of collectionBundle.objects) {
      // look up the category for the object
      if (!(object.id in idToCategory)) {
        // does not belong to a change category
        this.unchanged_ids.push(object.id);
        continue;
      }
      // track that this object has changed
      this.changed_ids.push(object.id);
      // determine the change category
      const category = idToCategory[object.id];
      // wrap the object as if it came from the back-end
      const raw: Record<string, any> = { stix: object, workspace: {} };
      // parse the object & add it to the appropriate category for rendering
      switch (object.type) {
        case 'attack-pattern': //technique
          this.object_import_categories.technique[category].push(
            new Technique(raw)
          );
          break;
        case 'x-mitre-tactic': //tactic
          this.object_import_categories.tactic[category].push(new Tactic(raw));
          break;
        case 'malware': //software
        case 'tool':
          this.object_import_categories.software[category].push(
            new Software(object.type, raw)
          );
          break;
        case 'relationship': //relationship
          // build source and target objects if the source/target objects aren't being uploaded simultaneously (in case where only relationships are uploaded)
          if (object.source_ref in idToSdo) {
            raw.source_object = idToSdo[object.source_ref];
          } else {
            raw.source_object = {
              stix: {
                attackID: object.source_id ? object.source_id : '',
                created: object.created,
                description: object.description,
                id: object.source_ref,
                modified: object.modified,
                name: object.source_name,
                spec_version: object.spec_version,
                type: object.relationship_type,
                external_references: object.source_id
                  ? [
                      {
                        source_name: 'mitre-attack',
                        external_id: object.source_id,
                      },
                    ]
                  : [],
              },
            };
          }
          if (object.target_ref in idToSdo) {
            raw.target_object = idToSdo[object.target_ref];
          } else {
            raw.target_object = {
              stix: {
                attackID: object.target_id ? object.target_id : '',
                created: object.created,
                description: object.description,
                id: object.target_ref,
                modified: object.modified,
                name: object.target_name,
                spec_version: object.spec_version,
                type: object.relationship_type,
                external_references: object.target_id
                  ? [
                      {
                        source_name: 'mitre-attack',
                        external_id: object.target_id,
                      },
                    ]
                  : [],
              },
            };
          }
          // eslint-disable-next-line no-case-declarations
          const rel = new Relationship(raw);
          this.object_import_categories.relationship[category].push(rel);
          break;
        case 'course-of-action': //mitigation
          this.object_import_categories.mitigation[category].push(
            new Mitigation(raw)
          );
          break;
        case 'x-mitre-matrix': //matrix
          this.object_import_categories.matrix[category].push(new Matrix(raw));
          break;
        case 'intrusion-set': //group
          this.object_import_categories.group[category].push(new Group(raw));
          break;
        case 'x-mitre-data-source': // data source
          this.object_import_categories.data_source[category].push(
            new DataSource(raw)
          );
          break;
        case 'x-mitre-data-component': // data component
          this.object_import_categories.data_component[category].push(
            new DataComponent(raw)
          );
          break;
        case 'campaign': // campaign
          this.object_import_categories.campaign[category].push(
            new Campaign(raw)
          );
          break;
        case 'x-mitre-asset': // asset
          this.object_import_categories.asset[category].push(new Asset(raw));
          break;
        case 'x-mitre-analytic': // analytic
          this.object_import_categories.analytic[category].push(
            new Analytic(raw)
          );
          break;
        case 'x-mitre-detection-strategy': // detection strategy
          this.object_import_categories.detection_strategy[category].push(
            new DetectionStrategy(raw)
          );
          break;
      }
    }
    // set up selection
    this.select = new SelectionModel(true, this.changed_ids);

    this.stepper.next();
  }

  /**
   * helper function to set an id for objects that are missing their stix id column
   * @param object stix object being imported to collection
   */
  public generateId(object: any): void {
    if (object.type) {
      // generate STIX ID from type
      switch (object.type) {
        case 'datasource':
          object.id = 'x-mitre-data-source--' + uuid();
          return;
        case 'datacomponent':
          object.id = 'x-mitre-data-component--' + uuid();
          return;
        case 'malware':
        case 'tool':
          object.id = object.type + '--' + uuid();
          return;
        case 'analytic':
          object.id = 'x-mitre-analytic--' + uuid();
          return;
        case 'detectionstrategy':
          object.id = 'x-mitre-detection-strategy--' + uuid();
          return;
      }
    }
    if (object.attack_id) {
      const regexMap = [
        { regex: /^AN\d{4}$/, stix: 'x-mitre-analytic' },
        { regex: /^A\d{4}$/, stix: 'x-mitre-asset' },
        { regex: /^C\d{4}$/, stix: 'campaign' },
        { regex: /^DS\d{4}$/, stix: 'x-mitre-data-source' },
        { regex: /^DET\d{4}$/, stix: 'x-mitre-detection-strategy' },
        { regex: /^G\d{4}$/, stix: 'intrusion-set' },
        { regex: /^M\d{4}$/, stix: 'course-of-action' },
        { regex: /^TA\d{4}$/, stix: 'x-mitre-tactic' },
        { regex: /^T\d{4}$/, stix: 'attack-pattern' }, // technique
        { regex: /^T\d{4}.\d{3}$/, stix: 'attack-pattern' }, // sub-technique
      ];
      // generate STIX ID from ATT&CK ID
      for (const entry of regexMap) {
        if (entry.regex.test(object.attack_id)) {
          object.id = `${entry.stix}--${uuid()}`;
        }
      }
    }
    // relationships don't have attack ids, so check for target and source fields here
    if (object.source_name && object.target_name && object.relationship_type) {
      object.id = 'relationship--' + uuid();
    }
  }

  /**
   * Select all objects for import
   */
  public selectAll() {
    for (const id of this.changed_ids) this.select.select(id);
  }

  /**
   * deselect all objects for import
   */
  public deselectAll() {
    this.select.clear();
  }

  /**
   * Perform the import of the collection
   */
  public import() {
    const prompt = this.dialog.open(ConfirmationDialogComponent, {
      maxWidth: '25em',
      data: {
        message: `Are you sure you want to import ${this.select.selected.length} objects?`,
        yes_suffix: 'import the collection',
      },
      autoFocus: false, // prevents auto focus on buttons
    });
    const promptSubscription = prompt.afterClosed().subscribe({
      next: result => {
        if (result) {
          // filter bundle for objects that were not selected
          this.loadingStep2 = true;
          setTimeout(() => {
            //make sure the loading icon renders before the parsing/writing
            const newBundle = JSON.parse(JSON.stringify(this.collectionBundle)); //deep copy
            const objects = [];
            // filter objects to selected or unchanged
            for (const object of newBundle.objects) {
              if (
                this.unchanged_ids.includes(object.id) ||
                this.select.selected.includes(object.id)
              ) {
                // object is selected or unchanged
                objects.push(object);
              }
            }
            newBundle.objects = objects;
            const force = this.import_errors ? true : false; // force import if the collection bundle has errors

            // Use streaming import for progress updates
            this.importProgress = 0;
            // Initialize multi-phase progress tracking
            this.phaseProgress = [
              {
                phase: 'processing',
                label: 'Processing Objects',
                progress: 0,
                active: false,
              },
              {
                phase: 'references',
                label: 'Importing References',
                progress: 0,
                active: false,
              },
              {
                phase: 'saving',
                label: 'Saving Collection',
                progress: 0,
                active: false,
              },
            ];
            logger.log('Starting streaming import...');
            const subscription = this.restAPIConnectorService
              .streamCollectionBundleImport(newBundle, force)
              .subscribe({
                next: event => {
                  logger.log('SSE Event received:', event.type, event.data);
                  if (event.type === 'progress') {
                    // Update phase progress
                    const phase = event.data.phase;
                    const phasePercentage = event.data.phasePercentage || 0;

                    // Find and update the appropriate phase
                    const phaseIndex = this.phaseProgress.findIndex(
                      p => p.phase === phase
                    );
                    if (phaseIndex !== -1) {
                      // Mark all previous phases as complete
                      for (let i = 0; i < phaseIndex; i++) {
                        this.phaseProgress[i].progress = 100;
                        this.phaseProgress[i].active = false;
                      }
                      // Update current phase
                      this.phaseProgress[phaseIndex].progress = phasePercentage;
                      this.phaseProgress[phaseIndex].active = true;
                      // Keep future phases at 0
                      for (
                        let i = phaseIndex + 1;
                        i < this.phaseProgress.length;
                        i++
                      ) {
                        this.phaseProgress[i].progress = 0;
                        this.phaseProgress[i].active = false;
                      }
                    }

                    logger.log(
                      'Phase progress updated:',
                      phase,
                      phasePercentage
                    );
                  } else if (event.type === 'complete') {
                    // Import complete - mark all phases as 100%
                    this.phaseProgress.forEach(p => {
                      p.progress = 100;
                      p.active = false;
                    });
                    logger.log(
                      'Import complete, waiting 1 second before transitioning to done'
                    );
                    // Wait 1 second to show all progress bars at 100% before transitioning
                    setTimeout(() => {
                      this.handleImportSuccess(new Collection(event.data));
                    }, 1000);
                  }
                },
                error: error => {
                  // Check if it's a timeout error (504 Gateway Timeout or network timeout)
                  if (error.status === 504 || error.status === 0) {
                    logger.warn(
                      'Import request timed out, but import may still be processing. Starting polling...'
                    );
                    // Import is likely still running - poll for completion
                    this.pollForImportCompletion(
                      newBundle.objects[0]?.id || newBundle.collection?.id
                    );
                  } else {
                    // Real error - show it and stop loading
                    this.loadingStep2 = false;
                    this.importProgress = 0;
                    logger.error('Import failed with error:', error);
                    this.snackbar.open(
                      `Import failed: ${error.error?.message || error.message || 'Unknown error'}`,
                      'Dismiss',
                      { duration: 10000 }
                    );
                  }
                },
                complete: () => {
                  subscription.unsubscribe();
                }, //prevent memory leaks
              });
          });
        }
      },
      complete: () => {
        promptSubscription.unsubscribe();
      }, //prevent memory leaks
    });
  }

  /**
   * Handle successful import results
   */
  private handleImportSuccess(results: Collection): void {
    if (results.import_categories.errors.length > 0) {
      logger.warn(
        'Collection import completed with errors:',
        results.import_categories.errors
      );
    }
    this.save_errors = results.import_categories.errors;
    const save_error_ids = new Set(
      this.save_errors.map(err => err['object_ref'])
    );
    for (const category in results.import_categories) {
      if (category == 'errors') continue;
      for (const id of results.import_categories[category])
        if (!save_error_ids.has(id)) this.successfully_saved.add(id);
    }
    this.loadingStep2 = false;
    this.stepper.next();
  }

  /**
   * Poll for import completion when the initial request times out
   */
  private pollForImportCompletion(_expectedCollectionId: string): void {
    // Show informative message to user
    this.snackbar.open(
      'Large import detected. Processing may take several minutes. Checking for completion...',
      'Dismiss',
      { duration: 8000 }
    );

    // Poll every 5 seconds for up to 15 minutes
    const maxAttempts = 180; // 15 minutes (180 * 5 seconds)
    let attempts = 0;

    const pollInterval = setInterval(() => {
      attempts++;

      // Get all collections and find the one that was just imported
      this.restAPIConnectorService.getAllCollections().subscribe({
        next: result => {
          // Look for a recently modified collection that matches our import
          // Since we don't have the exact collection ID before import, we look for
          // the most recently modified collection
          if (result && result.data && result.data.length > 0) {
            // Cast to Collection array since getAllCollections returns collections
            const collections = result.data as Collection[];

            // Sort by modified date descending
            const sortedCollections = [...collections].sort(
              (a: Collection, b: Collection) => {
                const dateA = new Date(a.modified).getTime();
                const dateB = new Date(b.modified).getTime();
                return dateB - dateA;
              }
            );

            // Check if the most recent collection was modified within the last few minutes
            const mostRecent = sortedCollections[0];
            const modifiedTime = new Date(mostRecent.modified).getTime();
            const now = Date.now();
            const timeDiff = now - modifiedTime;

            // If modified within last 5 minutes, assume it's our import
            if (timeDiff < 300000) {
              // 5 minutes in milliseconds
              clearInterval(pollInterval);
              logger.log(
                'Import detected as complete. Collection:',
                mostRecent
              );

              // The collection from getAllCollections includes import_categories
              // so we can use it directly
              this.snackbar.open('Import completed successfully!', 'Dismiss', {
                duration: 5000,
              });
              this.handleImportSuccess(mostRecent);
            }
          }

          // Check if we've exceeded max attempts
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            this.loadingStep2 = false;
            this.snackbar.open(
              'Import status check timed out after 15 minutes. The import may still be processing. Please check the collections page.',
              'Dismiss',
              { duration: 15000 }
            );
          }
        },
        error: () => {
          // Only log errors, don't stop polling unless max attempts reached
          logger.warn('Error polling for import completion');

          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            this.loadingStep2 = false;
            this.snackbar.open(
              'Unable to verify import completion. Please check the collections page.',
              'Dismiss',
              { duration: 10000 }
            );
          }
        },
      });
    }, 5000); // Poll every 5 seconds
  }

  /**
   * Cancel the collection import and revert to previous step
   */
  public cancelImport(): void {
    this.import_errors = undefined;
    this.stepper.reset();
    this.loadingStep1 = false;
    this.loadingStep2 = false;
    this.csvWarning = false;
    this.errorObjects = [];
  }

  /**
   * Download a log of errors from the import
   */
  public downloadErrorLog() {
    this.restAPIConnectorService.triggerBrowserDownload(
      this.save_errors,
      'import-errors.json'
    );
  }
}
