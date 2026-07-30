import {
  Component,
  OnInit,
  Input,
  ViewEncapsulation,
  ViewChild,
  AfterViewInit,
  ElementRef,
  EventEmitter,
  Output,
  OnDestroy,
} from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatPaginator } from '@angular/material/paginator';
import { SelectionModel } from '@angular/cdk/collections';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { fromEvent, Observable, of, Subscription } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  tap,
} from 'rxjs/operators';
import {
  EmbeddedRelationship,
  StixObject,
} from 'src/app/classes/stix/stix-object';
import { StixDialogComponent } from 'src/app/views/stix/stix-dialog/stix-dialog.component';
import {
  Paginated,
  RestApiConnectorService,
} from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { AddDialogComponent } from '../../add-dialog/add-dialog.component';
import { Collection } from 'src/app/classes/stix/collection';
import { logger } from 'src/app/utils/logger';
import { StixTypeToAttackType } from 'src/app/utils/type-mappings';
import { AttackType } from 'src/app/utils/types';

@Component({
  selector: 'app-stix-list',
  templateUrl: './stix-list.component.html',
  styleUrls: ['./stix-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
  animations: [
    trigger('detailExpand', [
      transition(':enter', [
        style({ height: '0px', minHeight: '0px' }),
        animate('100ms cubic-bezier(0.4, 0.0, 0.2, 1)', style({ height: '*' })),
      ]),
      transition(':leave', [
        animate(
          '100ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ height: '0px', minHeight: '0px' })
        ),
      ]),
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate(
          '500ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ opacity: '1' })
        ),
      ]),
    ]),
  ],
  standalone: false,
})
export class StixListComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() public config: StixListConfig = {};

  @Output() public onRowAction = new EventEmitter<string>();
  @Output() public onSelect = new EventEmitter<StixObject>();
  @Output() public refresh = new EventEmitter();

  // used to conditionally hide data component relationships with techniques
  @Output() public detectsHasData = new EventEmitter<boolean>();

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild('search') search: ElementRef;

  // search query
  public searchQuery = '';
  private searchSubscription: Subscription;

  // objects to render
  public data$: Observable<Paginated<StixObject>>;
  public totalObjectCount = 0;

  // options provided to the user for grouping and filtering
  public filterOptions: FilterGroup[] = [];
  public showControls = true;

  // current grouping and filtering selections
  public filter: string[] = [];
  public userIdsUsedInSearch = [];

  // TABLE STUFF
  public tableColumns: string[] = [];
  public tableColumns_controls: string[]; //including select behavior
  public tableColumns_settings: Map<string, any> = new Map<string, any>(); // property to display for each displayProperty
  public tableDetail: any[];
  public expandedElement: StixObject | null;

  public collectionColumnsToDisplay: string[];

  // Selection stuff
  public selection: SelectionModel<string>;

  // all possible each type of filter
  private platformSubscription: Subscription;
  private platformMap = new Map<string, Map<string, string[]>>();
  private domains: FilterValue[] = [
    { value: 'domain.enterprise-attack', label: 'enterprise', disabled: false },
    { value: 'domain.mobile-attack', label: 'mobile', disabled: false },
    { value: 'domain.ics-attack', label: 'ics', disabled: false },
  ];
  private statuses: FilterValue[] = [
    {
      value: 'status.work-in-progress',
      label: 'show only work in progress',
      disabled: false,
    },
    {
      value: 'status.awaiting-review',
      label: 'show only awaiting review',
      disabled: false,
    },
    { value: 'status.reviewed', label: 'show only reviewed', disabled: false },
  ];
  private states: FilterValue[] = [
    { value: 'state.deprecated', label: 'include deprecated', disabled: false },
    { value: 'state.revoked', label: 'include revoked', disabled: false },
  ];

  private statesExclusive: FilterValue[] = [
    {
      value: 'state.exclusive.deprecated',
      label: 'show only deprecated',
      disabled: false,
    },
    {
      value: 'state.exclusive.revoked',
      label: 'show only revoked',
      disabled: false,
    },
  ];

  public get userSearchString(): string {
    if (this.userIdsUsedInSearch.length === 0) {
      return 'filter by users';
    } else {
      return `${this.userIdsUsedInSearch.length} user${this.userIdsUsedInSearch.length === 1 ? '' : 's'} selected`;
    }
  }

  constructor(
    public dialog: MatDialog,
    private restAPIConnectorService: RestApiConnectorService,
    private router: Router,
    private authenticationService: AuthenticationService
  ) {}

  ngOnInit(): void {
    // build query options for platforms
    this.platformSubscription = this.restAPIConnectorService
      .getAllAllowedValues()
      .subscribe({
        next: data => {
          for (const values of data) {
            // setup domain map (domainName->platforms)
            const domainMap = new Map<string, string[]>();
            if (values.properties) {
              // extract domain->platforms properties from allowedValues structure
              const properties = values.properties.find(
                p => p.propertyName == 'x_mitre_platforms'
              );
              if (properties?.domains) {
                properties.domains.forEach(domain => {
                  domainMap.set(domain.domainName, domain.allowedValues);
                });
              }
            }
            // set attackType->domainMap
            this.platformMap.set(values['objectType'], domainMap);
          }
        },
        complete: () => {
          // build the stix list table
          this.showControls = this.config.showControls ?? true;
          this.buildTable();
          this.setUpControls();
          this.applyControls();
        },
      });
  }

  ngAfterViewInit() {
    // set up listener to search input
    if (this.config.type != 'relationship') {
      this.searchSubscription = fromEvent(this.search.nativeElement, 'keyup')
        .pipe(
          filter(Boolean),
          debounceTime(250),
          distinctUntilChanged(),
          tap(_ => {
            if (this.paginator) this.paginator.pageIndex = 0;
            this.applyControls();
          })
        )
        .subscribe();
    }
  }

  /**
   * Build the stix list table to display
   */
  protected buildTable(): void {
    // filter options
    this.filterOptions = [];
    if (!('showFilters' in this.config)) this.config.showFilters = true;

    // parse the config
    const sticky_allowed = !(
      this.config.rowAction && this.config.rowAction.position == 'start'
    );
    // Column presets take precedence
    if (this.config.columnsPreset === 'id-name') {
      this.addColumn('ID', 'attackID', 'plain', false);
      this.addColumn('name', 'name', 'plain', sticky_allowed, ['name']);
      this.tableDetail = [];
      return;
    }
    if (this.config.columnsPreset === 'all-objects') {
      this.addIdAndNameColumns(sticky_allowed);
      this.addColumn('type', 'attackType', 'plain');
      this.addDomainColumn();
      this.addColumn('modified', 'modified', 'timestamp');
      this.tableDetail = [];
      return;
    }
    if ('type' in this.config) {
      // set columns according to type
      switch (this.config.type.replace(/_/g, '-')) {
        case 'collection':
        case 'collection-created':
          this.addNameColumn(sticky_allowed);
          this.addColumn('latest version', 'version', 'version');
          this.addColumn('modified', 'modified', 'timestamp');
          this.tableDetail = [
            {
              field: 'description',
              display: 'descriptive',
            },
          ];
          this.collectionColumnsToDisplay = [
            'action',
            'version',
            'released',
            'description',
          ];
          break;
        case 'collection-imported':
          this.addNameColumn(sticky_allowed);
          this.addColumn('latest version', 'version', 'version');
          this.addColumn('imported', 'imported', 'timestamp');
          this.addColumn('modified', 'modified', 'timestamp');
          this.tableDetail = [
            {
              field: 'description',
              display: 'descriptive',
            },
          ];
          this.collectionColumnsToDisplay = [
            'action',
            'version',
            'description',
          ];
          break;
        case 'mitigation':
        case 'tactic':
        case 'data-component':
          this.addStateColumnOnly();
          this.addIdAndNameColumns(sticky_allowed);
          this.addDomainColumn();
          this.addColumn('modified', 'modified', 'timestamp');
          break;
        case 'matrix':
          this.addStateColumnOnly();
          this.addNameColumn(sticky_allowed);
          this.addColumn('modified', 'modified', 'timestamp');
          break;
        case 'detection-strategy':
        case 'campaign':
          this.addStateColumnOnly();
          this.addIdAndNameColumns(sticky_allowed);
          this.addColumn('modified', 'modified', 'timestamp');
          break;
        case 'analytic':
          this.addStateColumnOnly();
          this.addColumn('ID', 'attackID', 'plain', false);
          this.addColumn(
            'related detection strategy',
            'relatedDetections',
            'related_ref_list',
            false,
            undefined,
            'name'
          );
          this.addColumn('platform', 'platform', 'plain');
          this.addDomainColumn();
          this.addColumn('modified', 'modified', 'timestamp');
          break;
        case 'group':
          this.addStateColumnOnly();
          this.addIdAndNameColumns(sticky_allowed);
          this.addColumn('associated groups', 'aliases', 'list');
          this.addColumn('modified', 'modified', 'timestamp');
          break;
        case 'software':
          this.addStateColumnOnly();
          this.addIdAndNameColumns(sticky_allowed);
          this.addColumn('type', 'type', 'plain');
          this.addDomainColumn();
          this.addColumn('modified', 'modified', 'timestamp');
          break;
        case 'data-source':
        case 'technique':
          this.addStateColumnOnly();
          this.addIdAndNameColumns(sticky_allowed);
          this.addDomainColumn();
          this.addPlatformsColumn();
          this.addColumn('modified', 'modified', 'timestamp');
          break;
        case 'asset':
          this.addStateColumnOnly();
          this.addIdAndNameColumns(sticky_allowed);
          this.addPlatformsColumn();
          this.addColumn('sectors', 'sectors', 'list');
          this.addColumn('modified', 'modified', 'timestamp');
          break;
        case 'relationship':
          if (this.config.compactRelationshipColumns) {
            // Only show source ID, type, target ID, and description
            this.addColumn('source', 'source_ID', 'plain');
            this.addColumn('type', 'relationship_type', 'plain', false, [
              'text-deemphasis',
              'relationship-joiner',
            ]);
            this.addColumn('target', 'target_ID', 'plain');
            this.addColumn('description', 'description', 'descriptive', false);
            this.addColumn('created', 'created', 'timestamp', false);
            this.addColumn('modified', 'modified', 'timestamp', false);
          } else {
            this.addStateColumnOnly();
            if (
              this.config.relationshipType &&
              this.config.relationshipType !== 'detects'
            ) {
              this.addColumn('source', 'source_ID', 'plain');
              this.addColumn(
                '',
                'source_name',
                'plain',
                this.config.targetRef ? sticky_allowed : false,
                ['relationship-name']
              );
            } else
              this.addColumn(
                'source',
                'source_name',
                'plain',
                this.config.targetRef ? sticky_allowed : false,
                ['relationship-name']
              );
            this.addColumn('type', 'relationship_type', 'plain', false, [
              'text-deemphasis',
              'relationship-joiner',
            ]);
            this.addColumn('target', 'target_ID', 'plain');
            this.addColumn(
              '',
              'target_name',
              'plain',
              this.config.sourceRef ? sticky_allowed : false,
              ['relationship-name']
            );
            if (!(
              this.config.relationshipType &&
              this.config.relationshipType == 'subtechnique-of'
            ))
              this.addColumn(
                'description',
                'description',
                'descriptive',
                false
              );
          }
          break;
        case 'marking-definition':
          this.addColumn('definition type', 'definition_type', 'plain');
          this.addColumn('created', 'created', 'timestamp');
          this.addColumn('definition', 'definition_string', 'descriptive');
          break;
        case 'note':
          this.addColumn('title', 'title', 'plain');
          this.addColumn('content', 'content', 'plain');
          this.addColumn('modified', 'modified', 'timestamp');
          break;
        default:
          this.addColumn('type', 'attackType', 'plain');
          this.addColumn('modified', 'modified', 'timestamp');
      }
    } else {
      this.addStateColumnOnly();
      this.addColumn('type', 'attackType', 'plain');
      this.addIdAndNameColumns(true);
      this.addColumn('modified', 'modified', 'timestamp');
    }
  }

  private addStateColumnOnly(): void {
    this.addColumn('', 'state', 'icon');
  }

  private addIdAndNameColumns(stickyAllowed: boolean): void {
    this.addColumn('ID', 'attackID', 'plain', false);
    this.addColumn('name', 'name', 'plain', stickyAllowed, ['name']);
  }

  private addNameColumn(stickyAllowed: boolean): void {
    this.addColumn('name', 'name', 'plain', stickyAllowed, ['name']);
  }

  private addDomainColumn(): void {
    this.addColumn('domain', 'domains', 'list');
  }

  private addPlatformsColumn(type: column_types = 'list'): void {
    this.addColumn('platforms', 'platforms', type);
  }

  /**
   * Set up controls, including control columns and filters
   */
  private setUpControls(): void {
    //controls cols setup
    const controls_before = []; // control columns which occur before the main columns
    const controls_after = []; // control columns which occur after the main columns

    //selection setup
    if ('select' in this.config && this.config.select != 'disabled') {
      if ('selectionModel' in this.config) {
        this.selection = this.config.selectionModel;
      } else {
        this.selection = new SelectionModel<string>(
          this.config.select == 'many'
        );
      }
      controls_before.unshift('select'); // add select column to view
    }

    // open-dialog icon setup
    if (this.config.clickBehavior && this.config.clickBehavior == 'dialog') {
      controls_after.push('open-dialog');
    }

    // open-link icon setup
    if (
      this.config.clickBehavior &&
      ['linkToObjectPage', 'linkToObjectRef'].includes(
        this.config.clickBehavior
      )
    ) {
      controls_after.push('open-link');
    }

    // row action setup
    if (this.config.rowAction) {
      if (this.config.rowAction.position == 'start')
        controls_before.push('start-action');
      else controls_after.push('end-action');
    }
    this.tableColumns_controls = controls_before.concat(
      this.tableColumns,
      controls_after
    );

    let filterList = this.config.filterList
      ? this.config.filterList
      : ['state', 'workflow_status'];
    if (filterList.includes('workflow_status')) {
      this.filterOptions.push({
        name: 'workflow status',
        values: this.statuses,
      });
    }
    if (
      filterList.includes('state') &&
      filterList.includes('state_exclusive')
    ) {
      filterList = filterList.filter(obj => obj != 'state_exclusive');
      logger.error(
        "Cannot have both 'state' and 'state_exclusive' filters active.  Defaulting to 'state'"
      );
    }
    if (filterList.includes('state')) {
      this.filterOptions.push({
        name: 'state',
        values: this.states,
      });
    }
    if (filterList.includes('state_exclusive')) {
      this.filterOptions.push({
        name: 'state (exclusive)',
        values: this.statesExclusive,
      });
    }
    const filterByDomain: boolean = this.config.type
      ? [
          'data-component',
          'data-source',
          'mitigation',
          'software',
          'tactic',
          'technique',
          'analytic',
        ].includes(this.config.type)
      : false;
    const filterByPlatform: boolean = this.config.type
      ? ['data-source', 'software', 'technique'].includes(this.config.type)
      : false;
    if (filterByDomain) {
      this.filterOptions.push({
        name: 'domain',
        values: this.domains,
      });
    }
    if (filterByPlatform) {
      // only build platform filters if config.type is defined and object has 'x_mitre_platforms' field
      const platforms: FilterValue[] = this.buildPlatformFilter(
        this.config.type
      );
      if (platforms.length) {
        this.filterOptions.push({
          name: 'platform',
          values: platforms,
        });
      }
    }

    // get data from config (if we are not connecting to back-end)
    if (
      'stixObjects' in this.config &&
      this.config.stixObjects !== undefined &&
      !(this.config.stixObjects instanceof Observable)
    ) {
      this.totalObjectCount = this.config.stixObjects.length;
      this.applyControls();
    }
  }

  /**
   * Add a column to the table
   * @param {string} label the label to display the field under; column name
   * @param {string} field the field to display
   * @param {string} display how to format the column data
   * @param {boolean} [sticky] is the column sticky? If true, the column will be static in the X scrolling of the view
   * @param {string[]} [classes] list of css classes to apply to the cell
   */
  protected addColumn(
    label: string,
    field: string,
    display: column_types,
    sticky?: boolean,
    classes?: string[],
    relatedRefProperty?: keyof EmbeddedRelationship
  ) {
    this.tableColumns.push(field);
    this.tableColumns_settings.set(field, {
      label,
      display,
      sticky,
      classes,
      relatedRefProperty,
    });
  }

  public openUserSelectModal(): void {
    const select = new SelectionModel<string>(true);

    // a for-of loop does not work for this statement
    for (let i = 0; i < this.userIdsUsedInSearch.length; i++) {
      select.toggle(this.userIdsUsedInSearch[i]);
    }

    const prompt = this.dialog.open(AddDialogComponent, {
      data: {
        select,
        type: 'user',
        buttonLabel: 'SEARCH',
        title: 'Select users to filter by',
        clearSelection: true,
      },
      minHeight: '50vh',
      maxHeight: '75vh',
    });
    const subscription = prompt.afterClosed().subscribe({
      next: result => {
        if (result) {
          this.userIdsUsedInSearch = select.selected;
          this.applyControls();
        }
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
  }

  /**
   * Handles row click events. Open the panel, or open a modal depending on object type
   * @param {StixObject} object of the row that was clicked
   */
  public rowClick(element: StixObject) {
    if (this.config.clickBehavior == 'none') return;

    if (this.config.clickBehavior == 'dialog') {
      const prompt = this.dialog.open(StixDialogComponent, {
        data: {
          object: element,
          editable: this.config.allowEdits,
          sidebarControl: this.config.allowEdits ? 'events' : 'disable',
        },
        maxHeight: '75vh',
        autoFocus: false, // prevents auto focus on toolbar buttons
      });

      const subscription = prompt.afterClosed().subscribe({
        next: () => {
          if (prompt.componentInstance.dirty) {
            // re-fetch values since an edit occurred
            this.applyControls();
            this.refresh.emit();
          }
        },
        complete: () => {
          subscription.unsubscribe();
        },
      });
      return;
    }

    if (this.config.clickBehavior == 'linkToSourceRef') {
      const source_ref = element['source_ref'];
      // Get type to navigate from source_ref
      const type = StixTypeToAttackType[source_ref.split('--')[0]];
      this.router.navigateByUrl(`/${type}/${source_ref}`);
      return;
    }

    if (this.config.clickBehavior == 'linkToTargetRef') {
      const target_ref = element['target_ref'];
      // Get type to navigate from target_ref
      const type = StixTypeToAttackType[target_ref.split('--')[0]];
      this.router.navigateByUrl(`/${type}/${target_ref}`);
      return;
    }

    if (this.config.clickBehavior == 'linkToObjectRef') {
      // technically a note can be linked to many objects, we will select the first object
      const object_ref = element['object_refs'][0];
      // Get type to navigate from target_ref
      const type = StixTypeToAttackType[object_ref.split('--')[0]];

      // collection objs have a different URL structure
      let url = `/${type}/${object_ref}`;
      if (type === 'collection') {
        const collectionSub = this.restAPIConnectorService
          .getCollection(object_ref)
          .subscribe({
            next: result => {
              url = `${url}/modified/${result[0].modified.toISOString()}`;
              this.router.navigateByUrl(url);
            },
            complete: () => {
              collectionSub.unsubscribe();
            },
          });
      } else {
        this.router.navigateByUrl(url);
      }
      return;
    }

    if (this.isCollectionType()) {
      this.expandedElement = this.expandedElement === element ? null : element;
      return;
    }

    // by default, link to the object page
    if (
      this.config.clickBehavior == 'linkToObjectPage' ||
      !this.config.clickBehavior
    ) {
      this.onRowAction.emit(); // close any open dialogs
      this.router.navigateByUrl(
        '/' + element.attackType + '/' + element.stixID
      );
      return;
    }
  }

  public toggleSelection(element: StixObject): void {
    this.selection.toggle(element.stixID);
    const selectedObjectRefs = this.config.selectedObjectRefs;
    if (!selectedObjectRefs) return;

    if (this.selection.isSelected(element.stixID)) {
      selectedObjectRefs.set(element.stixID, {
        id: element.stixID,
        modified: element.modified.toISOString(),
      });
    } else {
      selectedObjectRefs.delete(element.stixID);
    }
  }

  public isCollectionType(): boolean {
    return ['collection', 'collection-created', 'collection-imported'].includes(
      this.config.type
    );
  }

  // AUTHENTICATION FUNCTIONS

  public getAccessibleCollectionRoutes(collection) {
    return collection.routes.filter(route =>
      this.canShowCollectionRoute(collection.attackType, route)
    );
  }

  private canShowCollectionRoute(attackType: string, route): boolean {
    if (route.label == 'edit') {
      return (
        this.authenticationService.canEdit(attackType) &&
        !this.config.uneditableObject
      );
    }
    return true;
  }

  public routeTo(url, queryParams): void {
    this.router.navigate([url], { queryParams: queryParams });
  }

  /**
   * Filter the given objects to those which include the query. Searches all string and string[] properties
   * @template T the input type
   * @param {string} query
   * @param {T[]} objects
   * @returns {T[]}
   * @memberof StixListComponent
   */
  private filterObjects<T>(query: string, objects: T[]): T[] {
    return objects.filter(obj => {
      return Object.keys(obj).some(key => {
        if (typeof obj[key] === 'string')
          return obj[key].toLowerCase().includes(query.toLowerCase());
        else if (Array.isArray(obj[key])) {
          return obj[key].some(val => {
            if (typeof val === 'string') {
              return val.toLowerCase().includes(query.toLowerCase());
            }
          });
        }
      });
    });
  }

  /**
   * Enable all filters for the given filter name
   * @param {string} name name of the filter group
   */
  private enableAllFilters(name: string) {
    for (const group of this.filterOptions) {
      if (group.name == name) {
        group.values.forEach(option => (option.disabled = false));
      }
    }
  }

  /**
   * Build platform filter values for the given attack type
   */
  private buildPlatformFilter(attackType: string): FilterValue[] {
    const platforms: FilterValue[] = [];
    const domainMap = this.platformMap.get(attackType);
    if (domainMap) {
      // add platforms related to this attackType
      const values = new Set<string>();
      for (const platforms of domainMap.values()) {
        platforms.forEach(platform => values.add(platform));
      }
      for (const value of values) {
        platforms.push({
          value: `platform.${value}`,
          label: value,
          disabled: false,
        });
      }
    }
    return platforms;
  }

  /**
   * Disable platform filters which are not in the list of selected domains.
   * All other platforms will be marked as enabled.
   * @param domains list of selected domain filters
   */
  private disablePlatformFilters(domains: string[]): void {
    if (!domains.length) return;
    // get set of valid platforms in the selected domains
    const validPlatforms = new Set<string>();
    const domainMap = this.platformMap.get(this.config.type);
    if (!domainMap) return; // platforms not supported for this attack type
    for (const domain of domains) {
      const platforms = domainMap.get(domain);
      if (platforms) {
        platforms.forEach(p => validPlatforms.add(p));
      }
    }
    // set enabledness of platform filters
    for (const group of this.filterOptions) {
      if (group.name == 'platform') {
        for (const option of group.values) {
          const platform = option.value.split('platform.')[1];
          // disable platform filters not in the list of valid platforms
          option.disabled = !validPlatforms.has(platform);
        }
      }
    }
  }

  /**
   * Disable domain filters which do not support the list of selected platforms.
   * All other domains will be marked as enabled.
   * @param platforms list of selected platform filters
   */
  private disableDomainFilters(platforms: string[]): void {
    if (!platforms.length) return;
    // get set of domains the selected platforms are supported by
    const validDomains = new Set<string>();
    const domainMap = this.platformMap.get(this.config.type);
    if (!domainMap) return; // domains not supported for this attack type
    for (const [domain, domainPlatforms] of domainMap.entries()) {
      // get intersection of selected platforms and the domain platforms
      const filtered = domainPlatforms.filter(p => platforms.includes(p));
      if (filtered.length) validDomains.add(domain);
    }
    // set enabledness of domain filters
    for (const group of this.filterOptions) {
      if (group.name == 'domain') {
        for (const option of group.values) {
          const domain = option.value.split('domain.')[1];
          // disable domain filters not in the list of valid domains
          option.disabled = !validDomains.has(domain);
        }
      }
    }
  }

  private hasLocalStixObjects(): boolean {
    return (
      'stixObjects' in this.config && this.config.stixObjects !== undefined
    );
  }

  /**
   * Apply all controls and fetch objects from the back-end if configured
   */
  public applyControls(): void {
    const filterStates = this.getFilterObjectStates();

    if (this.hasLocalStixObjects()) {
      this.applyControlsToLocalData(filterStates);
    } else {
      this.applyControlsToBackendData(filterStates);
    }
  }

  private applyControlsToLocalData(filterStates): void {
    if (this.config.stixObjects instanceof Observable) {
      // pull objects out of observable
      return;
    }
    // filter on STIX objects specified in the config
    let filtered = this.filterExcludedAttackTypes(this.config.stixObjects);
    filtered = this.filterLocalObjects(filtered, filterStates);
    filtered = this.sortObjects(filtered);

    if (this.paginator) this.totalObjectCount = filtered.length;

    // filter to only ones within the correct index range
    const { startIndex, endIndex } = this.getPaginationRange();
    const paged = filtered.slice(startIndex, endIndex);

    this.data$ = of({
      data: paged,
      pagination: {
        total: this.config.stixObjects.length,
        offset: startIndex,
        limit: this.paginator ? this.paginator.pageSize : 0,
      },
    });

    this.emitDetectsHasData(paged.length > 0);
  }

  private applyControlsToBackendData(filterStates): void {
    // fetch objects from backend
    const limit = this.paginator ? this.paginator.pageSize : 10;
    const offset = this.paginator ? this.paginator.pageIndex * limit : 0;

    const options = {
      limit: limit,
      offset: offset,
      excludeIDs: this.config.excludeIDs,
      search: this.searchQuery,
      state: filterStates.state,
      includeRevoked: filterStates.revoked,
      includeDeprecated: filterStates.deprecated,
      platforms: filterStates.platforms,
      domains: filterStates.domains,
      lastUpdatedBy: this.userIdsUsedInSearch,
    };
    if (this.config.type == 'software')
      this.data$ = this.restAPIConnectorService.getAllSoftware(options);
    else if (this.config.type == 'campaign')
      this.data$ = this.restAPIConnectorService.getAllCampaigns(options);
    else if (this.config.type == 'group')
      this.data$ = this.restAPIConnectorService.getAllGroups(options);
    else if (this.config.type == 'matrix')
      this.data$ = this.restAPIConnectorService.getAllMatrices(options);
    else if (this.config.type == 'mitigation')
      this.data$ = this.restAPIConnectorService.getAllMitigations(options);
    else if (this.config.type == 'tactic')
      this.data$ = this.restAPIConnectorService.getAllTactics(options);
    else if (this.config.type == 'technique')
      this.data$ = this.restAPIConnectorService.getAllTechniques(options);
    else if (this.config.type?.includes('collection'))
      this.data$ = this.restAPIConnectorService.getAllCollections({
        search: this.searchQuery,
        versions: 'all',
      });
    else if (this.config.type == 'relationship')
      this.data$ = this.restAPIConnectorService.getRelatedTo({
        sourceRef: this.config.sourceRef,
        targetRef: this.config.targetRef,
        sourceType: this.config.sourceType,
        targetType: this.config.targetType,
        relationshipType: this.config.relationshipType,
        excludeSourceRefs: this.config.excludeSourceRefs,
        excludeTargetRefs: this.config.excludeTargetRefs,
        limit: limit,
        offset: offset,
        includeDeprecated: filterStates.deprecated,
      });
    else if (this.config.type == 'detection-strategy')
      this.data$ =
        this.restAPIConnectorService.getAllDetectionStrategies(options);
    else if (this.config.type == 'analytic')
      this.data$ = this.restAPIConnectorService.getAllAnalytics({
        ...options,
        includeRefs: true,
      });
    else if (this.config.type == 'data-source')
      this.data$ = this.restAPIConnectorService.getAllDataSources(options);
    else if (this.config.type == 'data-component')
      this.data$ = this.restAPIConnectorService.getAllDataComponents(options);
    else if (this.config.type == 'asset')
      this.data$ = this.restAPIConnectorService.getAllAssets(options);
    else if (this.config.type == 'marking-definition')
      this.data$ =
        this.restAPIConnectorService.getAllMarkingDefinitions(options);
    else if (this.config.type == 'note')
      this.data$ = this.restAPIConnectorService.getAllNotes(options);
    else
      this.data$ = this.restAPIConnectorService.getAllObjects({
        limit,
        offset,
        state: filterStates.state,
        revoked: filterStates.revoked,
        deprecated: filterStates.deprecated,
        deserialize: true,
        lastUpdatedBy: this.userIdsUsedInSearch,
        search: this.searchQuery,
      });
    let subscription: Subscription | undefined;
    subscription = this.data$.subscribe({
      next: data => {
        data.data = this.filterExcludedAttackTypes(data.data);
        this.totalObjectCount = data.pagination.total;
        this.emitDetectsHasData(data.data.length > 0);
      },
      complete: () => {
        if (subscription) subscription.unsubscribe();
      },
    });
  }

  private filterLocalObjects(
    objects: StixObject[],
    {
      deprecated,
      revoked,
      state,
      platforms,
      domains,
      exclusiveDeprecated,
      exclusiveRevoked,
    }: ReturnType<typeof this.getFilterObjectStates>
  ): StixObject[] {
    let filtered = objects;
    //filter by domains
    if (Array.isArray(domains) && domains.length > 0) {
      filtered = filtered.filter((obj: any) =>
        this.getArrayField(obj, 'domains').some((object_domain: any) =>
          domains.includes(object_domain)
        )
      );
    }

    //filter by platforms
    if (Array.isArray(platforms) && platforms.length > 0) {
      filtered = filtered.filter((obj: any) =>
        this.getArrayField(obj, 'platforms').some((object_platform: any) =>
          platforms.includes(object_platform)
        )
      );
    }

    // filter by workflow status
    if (state) {
      filtered = filtered.filter(
        (obj: any) => obj.workflow && obj.workflow.state == state
      );
    }

    // filter by deprecation status
    if (exclusiveDeprecated) {
      filtered = filtered.filter((obj: any) => obj.deprecated);
    } else if (deprecated || this.config.includeDeprecatedObjects) {
      filtered = filtered.filter((obj: any) => obj || obj.deprecated);
    } else {
      filtered = filtered.filter((obj: any) => !obj.deprecated);
    }

    // filter by revocation status
    if (exclusiveRevoked) {
      filtered = filtered.filter((obj: any) => obj.revoked);
    }

    // filter by users
    if (
      Array.isArray(this.userIdsUsedInSearch) &&
      this.userIdsUsedInSearch.length > 0
    ) {
      filtered = filtered.filter(
        (obj: any) =>
          obj.workflow &&
          this.userIdsUsedInSearch.includes(
            obj.workflow.created_by_user_account
          )
      );
    }

    // filter to objects matching searchString
    filtered = this.filterObjects(this.searchQuery, filtered);
    return filtered;
  }

  private getArrayField(object: any, field: string): any[] {
    const value = object?.[field];
    return Array.isArray(value) ? value : [];
  }

  private sortObjects(objects: StixObject[]): StixObject[] {
    return [...objects].sort((a, b) => {
      const x = a as any;
      const y = b as any;
      return x.hasOwnProperty('name') && y.hasOwnProperty('name')
        ? x.name.localeCompare(y.name)
        : x.stixID.localeCompare(y.stixID);
    });
  }

  private getPaginationRange(): {
    startIndex: number;
    endIndex: number;
  } {
    const startIndex = this.paginator
      ? this.paginator.pageIndex * this.paginator.pageSize
      : 0;
    const endIndex = this.paginator ? startIndex + this.paginator.pageSize : 10;

    return { startIndex, endIndex };
  }

  private emitDetectsHasData(hasData: boolean) {
    // used to conditionally hide data component relationships with techniques
    if (
      this.config.type === 'relationship' &&
      this.config.relationshipType === 'detects'
    ) {
      this.detectsHasData.emit(hasData);
    }
  }

  private filterExcludedAttackTypes(objects: StixObject[]): StixObject[] {
    if (!this.config.excludeAttackTypes?.length) return objects;

    return objects.filter(
      object =>
        !this.config.excludeAttackTypes.includes(
          object.attackType as AttackType
        )
    );
  }

  public showDeprecated(event) {
    if (event.checked) {
      this.filter.push('state.deprecated');
    } else {
      const i = this.filter.indexOf('state.deprecated');
      if (i >= 0) {
        this.filter.splice(i, 1);
      }
    }
    this.applyControls();
  }

  public ngOnDestroy() {
    // prevent memory leaks
    if (this.searchSubscription) this.searchSubscription.unsubscribe();
    if (this.platformSubscription) this.platformSubscription.unsubscribe();
  }

  /**
   * Captures the filter statuses and returns them as an object.
   */
  private getFilterObjectStates() {
    const deprecated = this.filter.includes('state.deprecated');
    const revoked = this.filter.includes('state.revoked');

    // exclusive deprecated filter
    const exclusiveDeprecated = this.filter.includes(
      'state.exclusive.deprecated'
    );
    // exclusive revoked filter
    const exclusiveRevoked = this.filter.includes('state.exclusive.revoked');

    // state exclusive logic
    if (exclusiveDeprecated || exclusiveRevoked) {
      const search = exclusiveDeprecated
        ? 'state.exclusive.revoked'
        : 'state.exclusive.deprecated';
      for (const group of this.filterOptions) {
        for (const option of group.values) {
          if (option.value == search) option.disabled = true;
        }
      }
    } else {
      this.enableAllFilters('state (exclusive)');
    }

    // state filter
    let state = this.filter.find(x => x.startsWith('status.'));
    if (state) {
      state = state.split('status.')[1];
      // disable other states
      for (const group of this.filterOptions) {
        for (const option of group.values) {
          if (
            option.value.startsWith('status.') &&
            !option.value.endsWith(state)
          )
            option.disabled = true;
        }
      }
    } else {
      // enable all states
      this.enableAllFilters('workflow status');
    }

    // platform filter
    let platforms: string[] = this.filter.filter(x =>
      x.startsWith('platform.')
    );
    if (platforms.length) {
      platforms = platforms.map(p => p.split('platform.')[1]);
      // disable domains that do not support selected platforms
      this.disableDomainFilters(platforms);
    } else {
      // enable all domains
      this.enableAllFilters('domain');
    }

    // domain filter
    let domains: string[] = this.filter.filter(x => x.startsWith('domain.'));
    if (domains.length) {
      domains = domains.map(d => d.split('domain.')[1]);
      // disable platforms not in selected domains
      this.disablePlatformFilters(domains);
    } else {
      // enable all platforms
      this.enableAllFilters('platform');
    }
    return {
      deprecated,
      revoked,
      state,
      platforms,
      domains,
      exclusiveDeprecated,
      exclusiveRevoked,
    };
  }
}

type selection_types = 'one' | 'many' | 'disabled';
type filter_types = 'state' | 'workflow_status' | 'state_exclusive';
type column_types =
  | 'version'
  | 'list'
  | 'plain'
  | 'timestamp'
  | 'descriptive'
  | 'relationship_name'
  | 'icon'
  | 'related_ref_list';
export interface StixListConfig {
  /* if specified, shows the given STIX objects in the table instead of loading from the back-end based on other configurations. */
  stixObjects?: Observable<StixObject[]> | StixObject[];

  /** STIX ID;s force the list to show relationships with the given source or target. Use with type=='relationship' */
  sourceRef?: string;
  targetRef?: string;
  /** ATT&CK Types force the list to show relationships only with those types, use with type == 'relationship' */
  sourceType?: AttackType;
  targetType?: AttackType;
  /** relationship type to get, use with type=='relationship' */
  relationshipType?: string;

  /** force the list to show only this type */
  type?: AttackType | 'collection-created' | 'collection-imported';
  /** exclude rows matching these ATT&CK object types */
  excludeAttackTypes?: AttackType[];

  /** can the user select in this list? allowed options:
   *     "one": user can select a single element at a time
   *     "many": user can select as many elements as they want
   *     "disabled": do not allow selection (the same as omitting the config field)
   */
  select?: selection_types;
  /**
   * If provided, use this selection model of STIX IDs for tracking selection
   * Only relevant if 'select' is also enabled. Also, will cause problems if multiple constructor pram is set according to 'select'.
   */
  selectionModel?: SelectionModel<string>;
  selectedObjectRefs?: Map<string, { id: string; modified: string }>;
  /** show links to view/edit pages for relevant objects? */
  showLinks?: boolean;
  /** default true, if false hides the filter dropdown menu */
  showFilters?: boolean;
  /** default true, if false hides all search/filter/control options */
  showControls?: boolean;
  /** Optional preset to override default columns */
  columnsPreset?: 'id-name' | 'all-objects';
  /** display the 'show deprecated' filter, default false
   *  this may be relevant when displaying a list of embedded relationships, where
   *  the list of STIX objects is provided in the 'stixObjects' configuration
   */
  showDeprecatedFilter?: boolean;
  /** include deprecated objects in list of STIX objects, default false*/
  includeDeprecatedObjects?: boolean;
  /** default ['state','workflow_status'], if decides which filters to show */
  filterList?: filter_types[];
  /** default: false, if false hides the user search in the filters*/
  showUserSearch?: boolean;
  /**
   * How should the table act when the row is clicked? default "expand"
   *     "expand": expand the row to show additional detail
   *     "dialog": open a dialog with the full object definition
   *     "linkToObjectPage": clicking redirects to the object's page
   *     "linkToSourceRef": clicking redirects to the source ref object
   *     "linkToTargetRef": clicking redirects user to target ref object
   *     "linkToObjectRef": clicking redirects user to first object in a Note's object ref array
   *     "none": row is not clickable
   */
  clickBehavior?:
    | 'expand'
    | 'dialog'
    | 'linkToObjectPage'
    | 'linkToSourceRef'
    | 'linkToTargetRef'
    | 'linkToObjectRef'
    | 'none';
  /**
   * Default false. If true, allows for edits of the objects in the table
   * when in dialog mode
   */
  allowEdits?: boolean;

  /**
   * Default false. If true, edits will be disabled for the object
   */
  uneditableObject?: boolean;

  excludeIDs?: string[]; //exclude objects with this ID from the list
  excludeSourceRefs?: string[]; //exclude relationships with this source_ref from the list
  excludeTargetRefs?: string[]; //exclude relationships with this target_ref from the list

  // if specified, adds an action button for each row
  rowAction?: {
    icon: string; // material icon for the button
    tooltip: string; // tooltip or descriptor of action
    position: 'start' | 'end'; //start: occurs before first column; end: occurs after last column
  };

  /**
   * Map of collections by stixID
   */
  collectionMap?: Map<string, Collection[]>;

  /**
   * If true, collapse relationship columns to source, type, target, description only
   */
  compactRelationshipColumns?: boolean;
}

export interface FilterValue {
  value: string;
  label: string;
  disabled: boolean;
}
export interface FilterGroup {
  disabled?: boolean; //is the entire group disabled
  name: string;
  values: FilterValue[];
}
