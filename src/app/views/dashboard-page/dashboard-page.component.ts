import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { finalize, take } from 'rxjs/operators';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  AttackTypeToPlural,
  StixTypeToAttackType,
} from 'src/app/utils/type-mappings';
import { AttackType, StixType } from 'src/app/utils/types';

type DashboardLevel = 'root' | 'domain' | 'type' | 'relationship-type';

interface RawAttackObject {
  stix?: {
    created?: string;
    id?: string;
    modified?: string;
    type?: string | StixType;
    relationship_type?: string;
    x_mitre_domains?: string[];
  };
}

interface DashboardNode {
  id: string;
  key: string;
  label: string;
  value: number;
  level: DashboardLevel;
  depth: number;
  children: DashboardNode[];
  parent?: DashboardNode;
  path?: string;
  color?: string;
  startAngle?: number;
  endAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
}

interface ObjectTypeSummary {
  typeKey: AttackType;
  label: string;
  count: number;
  color: string;
}

interface DomainFilterOption {
  key: string;
  label: string;
}

interface TimelineObject {
  typeKey: AttackType;
  domains: string[];
  created?: Date;
}

interface DashboardObjectRecord {
  object: RawAttackObject;
  typeKey: AttackType;
  created?: Date;
}

interface TimelineBucket {
  key: string;
  objects: TimelineObject[];
}

interface TimelineSeries {
  key: string;
  label: string;
  color: string;
  points?: string;
  markers: TimelineMarker[];
  total: number;
}

interface TimelineMarker {
  x: string;
  y: string;
  count: number;
}

interface TimelineAxisTick {
  x: string;
  label: string;
}

const NO_DOMAIN_KEY = 'no-domain';
const NO_RELATIONSHIP_TYPE_KEY = 'unspecified';
const ROOT_ID = 'root';
const RELATIONSHIP_ROOT_ID = 'relationships-root';
const CHART_VIEW_BOX = '0 0 320 180';
const OBJECT_SUNBURST_ROOT_LABEL = 'ATT&CK Objects';
const RELATIONSHIP_SUNBURST_ROOT_LABEL = 'Relationships';
const RING_INNER_RADIUS = 50;
const RING_WIDTH = 56;
const RING_GAP = 1.5;

const CHART_PLOT = {
  left: 30,
  right: 10,
  top: 12,
  bottom: 30,
};

const DOMAIN_LABELS: Record<string, string> = {
  'enterprise-attack': 'Enterprise',
  'mobile-attack': 'Mobile',
  'ics-attack': 'ICS',
  [NO_DOMAIN_KEY]: 'No Domain',
};

const DOMAIN_PALETTE = [
  '#005b94',
  '#599e2f',
  '#eb6635',
  '#6d5bd0',
  '#00838f',
  '#b26a00',
  '#455a64',
];

const RELATIONSHIP_TYPE_PALETTE = [
  '#6d5bd0',
  '#00838f',
  '#b26a00',
  '#005b94',
  '#599e2f',
  '#eb6635',
  '#455a64',
];

const OBJECT_TYPE_PALETTE: Partial<Record<AttackType, string>> = {
  'matrix': '#0072b2',
  'tactic': '#d55e00',
  'technique': '#009e73',
  'group': '#aa4499',
  'software': '#e69f00',
  'campaign': '#56b4e9',
  'mitigation': '#882255',
  'asset': '#332288',
  'detection-strategy': '#44aa99',
  'analytic': '#cc6677',
  'data-component': '#999933',
  'marking-definition': '#6699cc',
};

const EXCLUDED_ATTACK_TYPES = new Set<AttackType>([
  'collection',
  'note',
  'data-source',
  'identity',
]);

const SUMMARY_OBJECT_TYPES: AttackType[] = [
  'matrix',
  'tactic',
  'technique',
  'group',
  'software',
  'campaign',
  'mitigation',
  'asset',
  'detection-strategy',
  'analytic',
  'data-component',
];

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class DashboardPageComponent implements OnInit {
  public loadingObjects = false;
  public loadError?: string;
  public includeRevoked = false;
  public includeDeprecated = false;

  public totalObjects = 0;
  public totalAssignments = 0;
  public totalRelationships = 0;
  public objectTypeSummary: ObjectTypeSummary[] = [];
  public objectGrowthLineSeries: TimelineSeries[] = [];
  public objectGrowthYearTicks: TimelineAxisTick[] = [];
  public objectGrowthYAxisLabels: string[] = [];
  public timelineDomainOptions: DomainFilterOption[] = [];
  public selectedObjectGrowthDomain = 'all';
  public selectedObjectGrowthType?: string;
  public readonly chartViewBox = CHART_VIEW_BOX;
  public sunburstSegments: DashboardNode[] = [];
  public selectedNode?: DashboardNode;
  public selectedBreadcrumb: DashboardNode[] = [];
  public selectedChildren: DashboardNode[] = [];
  public selectedPathLabel = OBJECT_SUNBURST_ROOT_LABEL;
  public selectedNodeIds = new Set<string>();
  public sunburstViewBox = '-164 -164 328 328';

  public relationshipSunburstSegments: DashboardNode[] = [];
  public selectedRelationshipNode?: DashboardNode;
  public selectedRelationshipBreadcrumb: DashboardNode[] = [];
  public selectedRelationshipChildren: DashboardNode[] = [];
  public selectedRelationshipPathLabel = RELATIONSHIP_SUNBURST_ROOT_LABEL;
  public selectedRelationshipNodeIds = new Set<string>();
  public relationshipSunburstViewBox = '-108 -108 216 216';

  private readonly nodeById = new Map<string, DashboardNode>();
  private readonly relationshipNodeById = new Map<string, DashboardNode>();
  private timelineObjects: TimelineObject[] = [];
  private rootNode?: DashboardNode;
  private relationshipRootNode?: DashboardNode;

  constructor(private restApiConnector: RestApiConnectorService) {}

  ngOnInit(): void {
    this.loadObjects();
  }

  public loadObjects(): void {
    this.loadingObjects = true;
    this.loadError = undefined;

    this.restApiConnector
      .getAllObjects({
        revoked: this.includeRevoked,
        deprecated: this.includeDeprecated,
      })
      .pipe(
        take(1),
        finalize(() => {
          this.loadingObjects = false;
        })
      )
      .subscribe({
        next: response => {
          this.buildDashboard(this.unwrapObjects(response));
        },
        error: () => {
          this.loadError = 'Unable to load knowledge base dashboard data.';
          this.resetDashboard();
        },
      });
  }

  public toggleRevoked(includeRevoked: boolean): void {
    this.includeRevoked = includeRevoked;
    this.loadObjects();
  }

  public toggleDeprecated(includeDeprecated: boolean): void {
    this.includeDeprecated = includeDeprecated;
    this.loadObjects();
  }

  public buildDashboard(objects: RawAttackObject[]): void {
    const aggregates = new Map<string, Map<AttackType, number>>();
    const objectTypeAggregates = new Map<AttackType, number>();
    const relationshipAggregates = new Map<string, number>();
    const timelineObjects: TimelineObject[] = [];
    let assignmentCount = 0;
    const {
      objectRecords,
      relationshipRecords,
      totalObjects,
      totalRelationships,
    } = this.deduplicateObjectsByStixId(objects);

    for (const record of relationshipRecords) {
      this.incrementCount(
        relationshipAggregates,
        this.relationshipTypeForObject(record.object)
      );
    }

    for (const record of objectRecords) {
      this.incrementCount(objectTypeAggregates, record.typeKey);

      const domains = this.domainsForObject(record.object);
      timelineObjects.push(this.timelineObjectForObject(record, domains));
      for (const domain of domains) {
        this.incrementAggregate(aggregates, domain, record.typeKey);
        assignmentCount += 1;
      }
    }

    this.totalObjects = totalObjects;
    this.totalAssignments = assignmentCount;
    this.totalRelationships = totalRelationships;
    this.objectTypeSummary = this.buildObjectTypeSummary(objectTypeAggregates);
    this.timelineObjects = timelineObjects;
    this.timelineDomainOptions = this.buildTimelineDomainOptions(aggregates);
    if (
      this.selectedObjectGrowthDomain !== 'all' &&
      !this.timelineDomainOptions.some(
        option => option.key === this.selectedObjectGrowthDomain
      )
    ) {
      this.selectedObjectGrowthDomain = 'all';
    }
    this.objectGrowthLineSeries = this.buildObjectGrowthLineSeries(
      this.timelineObjects,
      this.selectedObjectGrowthDomain
    );
    this.ensureSelectedObjectGrowthTypeIsAvailable();
    this.rootNode = this.buildSunburstTree(aggregates);
    this.layoutSunburst(this.rootNode);
    this.nodeById.clear();
    this.indexNodes(this.rootNode);
    this.sunburstSegments = this.flattenNodes(this.rootNode).filter(
      node => node.level !== 'root'
    );
    this.sunburstViewBox = this.sunburstViewBoxForSegments(
      this.sunburstSegments
    );
    this.selectNode(this.rootNode);

    this.relationshipRootNode = this.buildRelationshipSunburstTree(
      relationshipAggregates
    );
    this.layoutSunburst(this.relationshipRootNode);
    this.relationshipNodeById.clear();
    this.indexNodes(this.relationshipRootNode, this.relationshipNodeById);
    this.relationshipSunburstSegments = this.flattenNodes(
      this.relationshipRootNode
    ).filter(node => node.level !== 'root');
    this.relationshipSunburstViewBox = this.sunburstViewBoxForSegments(
      this.relationshipSunburstSegments
    );
    this.selectRelationshipNode(this.relationshipRootNode);
  }

  public selectNode(node?: DashboardNode): void {
    if (!node) return;
    this.selectedNode = node;
    this.selectedBreadcrumb = this.buildBreadcrumb(node);
    this.selectedChildren = [...node.children].sort(
      (a, b) => b.value - a.value
    );
    this.selectedPathLabel = this.selectedBreadcrumb
      .map(crumb => crumb.label)
      .join(' / ');
    this.selectedNodeIds = this.buildSelectedNodeSet(node);
  }

  public selectNodeById(id: string): void {
    this.selectNode(this.nodeById.get(id));
  }

  public selectRelationshipNode(node?: DashboardNode): void {
    if (!node) return;
    this.selectedRelationshipNode = node;
    this.selectedRelationshipBreadcrumb = this.buildBreadcrumb(node);
    this.selectedRelationshipChildren = [...node.children].sort(
      (a, b) => b.value - a.value
    );
    this.selectedRelationshipPathLabel = this.selectedRelationshipBreadcrumb
      .map(crumb => crumb.label)
      .join(' / ');
    this.selectedRelationshipNodeIds = this.buildSelectedNodeSet(node);
  }

  public selectRelationshipNodeById(id: string): void {
    this.selectRelationshipNode(this.relationshipNodeById.get(id));
  }

  public isSegmentDimmed(segment: DashboardNode): boolean {
    return (
      this.selectedNode?.level !== 'root' &&
      !this.selectedNodeIds.has(segment.id)
    );
  }

  public isRelationshipSegmentDimmed(segment: DashboardNode): boolean {
    return (
      this.selectedRelationshipNode?.level !== 'root' &&
      !this.selectedRelationshipNodeIds.has(segment.id)
    );
  }

  public formatCount(count: number): string {
    return count.toLocaleString();
  }

  public segmentTooltip(segment: DashboardNode): string {
    return `${this.buildBreadcrumb(segment)
      .map(crumb => crumb.label)
      .join(' / ')}: ${this.formatCount(segment.value)}`;
  }

  public trackNode(_index: number, node: DashboardNode): string {
    return node.id;
  }

  public trackObjectTypeSummary(
    _index: number,
    summary: ObjectTypeSummary
  ): string {
    return summary.typeKey;
  }

  public trackTimelineSeries(_index: number, series: TimelineSeries): string {
    return series.key;
  }

  public trackDomainFilter(_index: number, option: DomainFilterOption): string {
    return option.key;
  }

  public get objectGrowthTotal(): number {
    return this.objectGrowthLineSeries.reduce(
      (sum, series) => sum + series.total,
      0
    );
  }

  public get objectGrowthLineSeriesForDisplay(): TimelineSeries[] {
    if (!this.selectedObjectGrowthType) return this.objectGrowthLineSeries;
    const selectedSeries = this.objectGrowthLineSeries.find(
      series => series.key === this.selectedObjectGrowthType
    );
    if (!selectedSeries) return this.objectGrowthLineSeries;
    return [
      ...this.objectGrowthLineSeries.filter(
        series => series.key !== this.selectedObjectGrowthType
      ),
      selectedSeries,
    ];
  }

  public selectObjectGrowthDomain(domainKey: string): void {
    this.selectedObjectGrowthDomain = domainKey;
    this.objectGrowthLineSeries = this.buildObjectGrowthLineSeries(
      this.timelineObjects,
      domainKey
    );
    this.ensureSelectedObjectGrowthTypeIsAvailable();
  }

  public selectObjectGrowthType(typeKey: string): void {
    this.selectedObjectGrowthType =
      this.selectedObjectGrowthType === typeKey ? undefined : typeKey;
  }

  public isObjectGrowthSeriesSelected(series: TimelineSeries): boolean {
    return this.selectedObjectGrowthType === series.key;
  }

  public isObjectGrowthSeriesDimmed(series: TimelineSeries): boolean {
    return (
      !!this.selectedObjectGrowthType &&
      this.selectedObjectGrowthType !== series.key
    );
  }

  private resetDashboard(): void {
    this.totalObjects = 0;
    this.totalAssignments = 0;
    this.totalRelationships = 0;
    this.objectTypeSummary = [];
    this.objectGrowthLineSeries = [];
    this.objectGrowthYearTicks = [];
    this.objectGrowthYAxisLabels = [];
    this.timelineDomainOptions = [];
    this.selectedObjectGrowthDomain = 'all';
    this.selectedObjectGrowthType = undefined;
    this.timelineObjects = [];
    this.sunburstSegments = [];
    this.rootNode = this.createNode(
      ROOT_ID,
      'root',
      OBJECT_SUNBURST_ROOT_LABEL
    );
    this.selectedNode = this.rootNode;
    this.selectedBreadcrumb = [this.rootNode];
    this.selectedChildren = [];
    this.selectedPathLabel = OBJECT_SUNBURST_ROOT_LABEL;
    this.selectedNodeIds = new Set([ROOT_ID]);
    this.sunburstViewBox = this.sunburstViewBoxForSegments([]);
    this.relationshipSunburstSegments = [];
    this.relationshipRootNode = this.createNode(
      RELATIONSHIP_ROOT_ID,
      'root',
      RELATIONSHIP_SUNBURST_ROOT_LABEL
    );
    this.selectedRelationshipNode = this.relationshipRootNode;
    this.selectedRelationshipBreadcrumb = [this.relationshipRootNode];
    this.selectedRelationshipChildren = [];
    this.selectedRelationshipPathLabel = RELATIONSHIP_SUNBURST_ROOT_LABEL;
    this.selectedRelationshipNodeIds = new Set([RELATIONSHIP_ROOT_ID]);
    this.relationshipSunburstViewBox = this.sunburstViewBoxForSegments([]);
  }

  private unwrapObjects(response: any): RawAttackObject[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  }

  private objectTypeKey(object: RawAttackObject): AttackType | undefined {
    const stixType = object?.stix?.type;
    if (!stixType) return undefined;
    if (!(stixType in StixTypeToAttackType)) return undefined;

    const attackType = StixTypeToAttackType[stixType as StixType];
    if (EXCLUDED_ATTACK_TYPES.has(attackType)) return undefined;
    return attackType;
  }

  private domainsForObject(object: RawAttackObject): string[] {
    const domains = object?.stix?.x_mitre_domains;
    if (!domains?.length) return [NO_DOMAIN_KEY];
    return [...new Set(domains.filter(domain => !!domain))];
  }

  private relationshipTypeForObject(object: RawAttackObject): string {
    return object?.stix?.relationship_type || NO_RELATIONSHIP_TYPE_KEY;
  }

  private timelineObjectForObject(
    record: DashboardObjectRecord,
    domains: string[]
  ): TimelineObject {
    return {
      typeKey: record.typeKey,
      domains,
      created: record.created,
    };
  }

  private deduplicateObjectsByStixId(objects: RawAttackObject[]): {
    objectRecords: DashboardObjectRecord[];
    relationshipRecords: DashboardObjectRecord[];
    totalObjects: number;
    totalRelationships: number;
  } {
    const objectRecordsById = new Map<string, DashboardObjectRecord>();
    const relationshipRecordsById = new Map<string, DashboardObjectRecord>();
    const fallbackObjectRecords: DashboardObjectRecord[] = [];
    const fallbackRelationshipRecords: DashboardObjectRecord[] = [];

    for (const object of objects) {
      const typeKey = this.objectTypeKey(object);
      if (!typeKey) continue;

      const record = this.dashboardObjectRecord(object, typeKey);
      const stixId = object?.stix?.id;
      if (!stixId) {
        if (typeKey === 'relationship')
          fallbackRelationshipRecords.push(record);
        else fallbackObjectRecords.push(record);
        continue;
      }

      const records =
        typeKey === 'relationship'
          ? relationshipRecordsById
          : objectRecordsById;
      const existing = records.get(stixId);
      if (!existing) {
        records.set(stixId, record);
        continue;
      }

      if (this.isNewerVersion(record.object, existing.object)) {
        existing.object = record.object;
        existing.typeKey = record.typeKey;
      }
      if (
        record.created &&
        (!existing.created || record.created < existing.created)
      ) {
        existing.created = record.created;
      }
    }

    return {
      objectRecords: [
        ...Array.from(objectRecordsById.values()),
        ...fallbackObjectRecords,
      ],
      relationshipRecords: [
        ...Array.from(relationshipRecordsById.values()),
        ...fallbackRelationshipRecords,
      ],
      totalObjects: objectRecordsById.size + fallbackObjectRecords.length,
      totalRelationships:
        relationshipRecordsById.size + fallbackRelationshipRecords.length,
    };
  }

  private dashboardObjectRecord(
    object: RawAttackObject,
    typeKey: AttackType
  ): DashboardObjectRecord {
    return {
      object,
      typeKey,
      created: this.parseDate(object?.stix?.created),
    };
  }

  private isNewerVersion(
    candidate: RawAttackObject,
    current: RawAttackObject
  ): boolean {
    const candidateDate =
      this.parseDate(candidate?.stix?.modified) ||
      this.parseDate(candidate?.stix?.created);
    const currentDate =
      this.parseDate(current?.stix?.modified) ||
      this.parseDate(current?.stix?.created);
    if (!candidateDate) return false;
    if (!currentDate) return true;
    return candidateDate > currentDate;
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private incrementAggregate(
    aggregates: Map<string, Map<AttackType, number>>,
    domainKey: string,
    typeKey: AttackType
  ): void {
    let typeMap = aggregates.get(domainKey);
    if (!typeMap) {
      typeMap = new Map();
      aggregates.set(domainKey, typeMap);
    }
    typeMap.set(typeKey, (typeMap.get(typeKey) || 0) + 1);
  }

  private incrementCount<TKey>(aggregates: Map<TKey, number>, key: TKey): void {
    aggregates.set(key, (aggregates.get(key) || 0) + 1);
  }

  private buildObjectTypeSummary(
    aggregates: Map<AttackType, number>
  ): ObjectTypeSummary[] {
    return SUMMARY_OBJECT_TYPES.map(typeKey => ({
      typeKey,
      label: this.objectTypeLabel(typeKey),
      count: aggregates.get(typeKey) || 0,
      color: this.colorForObjectType(typeKey),
    }));
  }

  private buildTimelineDomainOptions(
    aggregates: Map<string, Map<AttackType, number>>
  ): DomainFilterOption[] {
    return Array.from(aggregates.keys())
      .filter(domainKey => domainKey !== NO_DOMAIN_KEY)
      .map(domainKey => ({
        key: domainKey,
        label: this.domainLabel(domainKey),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private buildObjectGrowthLineSeries(
    objects: TimelineObject[],
    domainKey: string
  ): TimelineSeries[] {
    const filteredObjects = objects.filter(object => {
      if (domainKey === 'all') return true;
      return object.domains.includes(domainKey);
    });
    const buckets = this.buildMonthlyBuckets(
      filteredObjects,
      object => object.created,
      true
    );
    if (!buckets.length) {
      this.objectGrowthYearTicks = [];
      this.objectGrowthYAxisLabels = [];
      return [];
    }
    this.objectGrowthYearTicks = this.timelineYearTicksForBuckets(buckets);

    const objectsWithMonth = filteredObjects
      .map(object => ({
        ...object,
        monthKey: this.monthKey(object.created),
      }))
      .filter(
        (object): object is TimelineObject & { monthKey: string } =>
          !!object.monthKey
      );
    const seriesKeys = Array.from(
      new Set(objectsWithMonth.map(object => object.typeKey))
    );
    const seriesCounts = new Map<AttackType, number[]>();
    let maxCount = 0;

    for (const typeKey of seriesKeys) {
      const counts = buckets.map(bucket => {
        return objectsWithMonth.filter(
          object => object.typeKey === typeKey && object.monthKey <= bucket.key
        ).length;
      });
      seriesCounts.set(typeKey, counts);
      maxCount = Math.max(maxCount, ...counts);
    }
    this.objectGrowthYAxisLabels = [
      this.formatCount(maxCount),
      this.formatCount(Math.ceil(maxCount / 2)),
      '0',
    ];

    return seriesKeys
      .map((typeKey, index) => {
        const counts = seriesCounts.get(typeKey) || [];
        const total = counts[counts.length - 1] || 0;
        const markers = counts.map((count, countIndex) => ({
          x: this.chartX(countIndex, buckets.length),
          y: this.chartY(count, maxCount),
          count,
        }));
        const points = markers
          .map(marker => `${marker.x},${marker.y}`)
          .join(' ');

        return {
          key: typeKey,
          label: this.objectTypeLabel(typeKey),
          color: this.colorForObjectType(typeKey, index),
          points,
          markers,
          total,
        };
      })
      .filter(series => series.total > 0)
      .sort((a, b) => {
        const totalSort = b.total - a.total;
        if (totalSort !== 0) return totalSort;
        return a.label.localeCompare(b.label);
      });
  }

  private buildMonthlyBuckets(
    objects: TimelineObject[],
    dateForObject: (object: TimelineObject) => Date | undefined,
    fillGaps: boolean
  ): TimelineBucket[] {
    const objectsWithDate = objects
      .map(object => ({ object, date: dateForObject(object) }))
      .filter(
        (entry): entry is { object: TimelineObject; date: Date } => !!entry.date
      );
    if (!objectsWithDate.length) return [];

    const monthKeys = Array.from(
      new Set(objectsWithDate.map(entry => this.monthKey(entry.date)))
    ).sort();
    const bucketKeys = fillGaps
      ? this.monthRange(monthKeys[0], monthKeys[monthKeys.length - 1])
      : monthKeys;

    return bucketKeys.map(key => ({
      key,
      objects: objectsWithDate
        .filter(entry => this.monthKey(entry.date) === key)
        .map(entry => entry.object),
    }));
  }

  private timelineYearTicksForBuckets(
    buckets: TimelineBucket[]
  ): TimelineAxisTick[] {
    const ticks: TimelineAxisTick[] = [];
    let previousYear: string | undefined;

    buckets.forEach((bucket, index) => {
      const year = bucket.key.slice(0, 4);
      if (year === previousYear) return;
      ticks.push({
        x: this.chartX(index, buckets.length),
        label: year,
      });
      previousYear = year;
    });

    return ticks;
  }

  private chartX(index: number, totalPoints: number): string {
    const width = 320 - CHART_PLOT.left - CHART_PLOT.right;
    if (totalPoints <= 1) {
      return (CHART_PLOT.left + width / 2).toFixed(2);
    }
    return (CHART_PLOT.left + (index / (totalPoints - 1)) * width).toFixed(2);
  }

  private chartY(value: number, maxValue: number): string {
    const height = 180 - CHART_PLOT.top - CHART_PLOT.bottom;
    const ratio = maxValue > 0 ? value / maxValue : 0;
    return (CHART_PLOT.top + (1 - ratio) * height).toFixed(2);
  }

  private colorForObjectType(typeKey: string, index = 0): string {
    const objectTypeColor = OBJECT_TYPE_PALETTE[typeKey as AttackType];
    if (objectTypeColor) return objectTypeColor;
    return RELATIONSHIP_TYPE_PALETTE[index % RELATIONSHIP_TYPE_PALETTE.length];
  }

  private ensureSelectedObjectGrowthTypeIsAvailable(): void {
    if (
      this.selectedObjectGrowthType &&
      !this.objectGrowthLineSeries.some(
        series => series.key === this.selectedObjectGrowthType
      )
    ) {
      this.selectedObjectGrowthType = undefined;
    }
  }

  private monthKey(date?: Date): string | undefined {
    if (!date) return undefined;
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
      2,
      '0'
    )}`;
  }

  private monthDate(key: string): Date {
    const [year, month] = key.split('-').map(value => parseInt(value, 10));
    return new Date(Date.UTC(year, month - 1, 1));
  }

  private monthRange(startKey: string, endKey: string): string[] {
    const start = this.monthDate(startKey);
    const end = this.monthDate(endKey);
    const keys: string[] = [];
    const current = new Date(start);

    while (current <= end) {
      const key = this.monthKey(current);
      if (key) keys.push(key);
      current.setUTCMonth(current.getUTCMonth() + 1);
    }

    return keys;
  }

  private buildSunburstTree(
    aggregates: Map<string, Map<AttackType, number>>
  ): DashboardNode {
    const root = this.createNode(ROOT_ID, 'root', OBJECT_SUNBURST_ROOT_LABEL);

    const sortedDomains = this.sortedDomainEntries(aggregates);

    sortedDomains.forEach(([domainKey, typeMap], domainIndex) => {
      const domainNode = this.createNode(
        this.domainNodeId(domainKey),
        domainKey,
        this.domainLabel(domainKey),
        'domain',
        root
      );
      domainNode.color = DOMAIN_PALETTE[domainIndex % DOMAIN_PALETTE.length];
      root.children.push(domainNode);

      const sortedTypes = Array.from(typeMap.entries()).sort(
        ([left], [right]) =>
          this.objectTypeLabel(left).localeCompare(this.objectTypeLabel(right))
      );

      for (const [typeKey, count] of sortedTypes) {
        const typeNode = this.createNode(
          this.typeNodeId(domainKey, typeKey),
          typeKey,
          this.objectTypeLabel(typeKey),
          'type',
          domainNode
        );
        typeNode.color = this.colorForObjectType(typeKey);
        typeNode.value = count;
        domainNode.children.push(typeNode);
      }

      domainNode.value = domainNode.children.reduce(
        (sum, child) => sum + child.value,
        0
      );
    });

    root.value = root.children.reduce((sum, child) => sum + child.value, 0);
    return root;
  }

  private buildRelationshipSunburstTree(
    aggregates: Map<string, number>
  ): DashboardNode {
    const root = this.createNode(
      RELATIONSHIP_ROOT_ID,
      'root',
      RELATIONSHIP_SUNBURST_ROOT_LABEL
    );

    const sortedTypes = Array.from(aggregates.entries()).sort(
      ([left], [right]) =>
        this.relationshipTypeLabel(left).localeCompare(
          this.relationshipTypeLabel(right)
        )
    );

    sortedTypes.forEach(([relationshipType, count], typeIndex) => {
      const typeNode = this.createNode(
        this.relationshipTypeNodeId(relationshipType),
        relationshipType,
        this.relationshipTypeLabel(relationshipType),
        'relationship-type',
        root
      );
      typeNode.color =
        RELATIONSHIP_TYPE_PALETTE[typeIndex % RELATIONSHIP_TYPE_PALETTE.length];
      typeNode.value = count;
      root.children.push(typeNode);
    });

    root.value = root.children.reduce((sum, child) => sum + child.value, 0);
    return root;
  }

  private layoutSunburst(root: DashboardNode): void {
    root.depth = 0;
    root.startAngle = 0;
    root.endAngle = Math.PI * 2;
    this.layoutChildren(root, 0, Math.PI * 2);
  }

  private layoutChildren(
    parent: DashboardNode,
    startAngle: number,
    endAngle: number
  ): void {
    let cursor = startAngle;
    const availableAngle = endAngle - startAngle;

    for (const child of parent.children) {
      const angle =
        parent.value > 0 ? availableAngle * (child.value / parent.value) : 0;
      child.depth = parent.depth + 1;
      child.startAngle = cursor;
      child.endAngle = cursor + angle;
      child.innerRadius = RING_INNER_RADIUS + (child.depth - 1) * RING_WIDTH;
      child.outerRadius =
        RING_INNER_RADIUS + child.depth * RING_WIDTH - RING_GAP;
      child.path = this.describeArc(
        child.innerRadius,
        child.outerRadius,
        child.startAngle,
        child.endAngle
      );
      this.layoutChildren(child, child.startAngle, child.endAngle);
      cursor += angle;
    }
  }

  private describeArc(
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    endAngle: number
  ): string {
    if (endAngle - startAngle >= Math.PI * 2) {
      endAngle = startAngle + Math.PI * 2 - 0.0001;
    }

    const outerStart = this.polarToCartesian(outerRadius, startAngle);
    const outerEnd = this.polarToCartesian(outerRadius, endAngle);
    const innerEnd = this.polarToCartesian(innerRadius, endAngle);
    const innerStart = this.polarToCartesian(innerRadius, startAngle);
    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
      'Z',
    ].join(' ');
  }

  private polarToCartesian(
    radius: number,
    angle: number
  ): { x: string; y: string } {
    const adjustedAngle = angle - Math.PI / 2;
    return {
      x: (Math.cos(adjustedAngle) * radius).toFixed(3),
      y: (Math.sin(adjustedAngle) * radius).toFixed(3),
    };
  }

  private createNode(
    id: string,
    key: string,
    label: string,
    level: DashboardLevel = 'root',
    parent?: DashboardNode
  ): DashboardNode {
    return {
      id,
      key,
      label,
      value: 0,
      level,
      depth: parent ? parent.depth + 1 : 0,
      children: [],
      parent,
    };
  }

  private indexNodes(node: DashboardNode, nodeById = this.nodeById): void {
    nodeById.set(node.id, node);
    for (const child of node.children) this.indexNodes(child, nodeById);
  }

  private flattenNodes(node: DashboardNode): DashboardNode[] {
    const nodes = [node];
    for (const child of node.children) {
      nodes.push(...this.flattenNodes(child));
    }
    return nodes;
  }

  private sunburstViewBoxForSegments(segments: DashboardNode[]): string {
    const centerRadius = 47;
    const padding = 4;
    const maxOuterRadius = segments.reduce(
      (max, segment) => Math.max(max, segment.outerRadius || 0),
      centerRadius
    );
    const bounds = Math.ceil(maxOuterRadius + padding);
    return `${-bounds} ${-bounds} ${bounds * 2} ${bounds * 2}`;
  }

  private buildBreadcrumb(node: DashboardNode): DashboardNode[] {
    const crumbs: DashboardNode[] = [];
    let current: DashboardNode | undefined = node;
    while (current) {
      crumbs.unshift(current);
      current = current.parent;
    }
    return crumbs;
  }

  private buildSelectedNodeSet(node: DashboardNode): Set<string> {
    const selected = new Set<string>();
    for (const crumb of this.buildBreadcrumb(node)) selected.add(crumb.id);
    this.collectDescendants(node, selected);
    return selected;
  }

  private collectDescendants(node: DashboardNode, selected: Set<string>): void {
    for (const child of node.children) {
      selected.add(child.id);
      this.collectDescendants(child, selected);
    }
  }

  private domainNodeId(domainKey: string): string {
    return `domain:${domainKey}`;
  }

  private sortedDomainEntries(
    aggregates: Map<string, Map<AttackType, number>>
  ): [string, Map<AttackType, number>][] {
    return Array.from(aggregates.entries()).sort(([left], [right]) =>
      this.domainLabel(left).localeCompare(this.domainLabel(right))
    );
  }

  private typeNodeId(domainKey: string, typeKey: AttackType): string {
    return `${this.domainNodeId(domainKey)}/type:${typeKey}`;
  }

  private relationshipTypeNodeId(relationshipType: string): string {
    return `relationship-type:${relationshipType}`;
  }

  private domainLabel(domain: string): string {
    return DOMAIN_LABELS[domain] || this.titleCase(domain);
  }

  private objectTypeLabel(type: string): string {
    return this.titleCase(AttackTypeToPlural[type as AttackType] || type);
  }

  private relationshipTypeLabel(relationshipType: string): string {
    if (relationshipType === NO_RELATIONSHIP_TYPE_KEY) {
      return 'Unspecified Type';
    }
    return this.titleCase(relationshipType);
  }

  private titleCase(value: string): string {
    return value
      .replace(/-/g, ' ')
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => {
        if (word.toLowerCase() === 'ics') return 'ICS';
        return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
      })
      .join(' ');
  }
}
