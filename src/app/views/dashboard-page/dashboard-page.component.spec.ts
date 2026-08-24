import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DashboardPageComponent } from './dashboard-page.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';

describe('DashboardPageComponent', () => {
  let component: DashboardPageComponent;
  let fixture: ComponentFixture<DashboardPageComponent>;
  let mockRestApiConnector: any;

  const attackObjects = [
    {
      stix: {
        created: '2024-01-10T00:00:00.000Z',
        id: 'attack-pattern--001',
        modified: '2024-03-15T00:00:00.000Z',
        type: 'attack-pattern',
        x_mitre_domains: ['enterprise-attack'],
      },
    },
    {
      stix: {
        created: '2024-01-10T00:00:00.000Z',
        id: 'attack-pattern--001',
        modified: '2025-01-15T00:00:00.000Z',
        type: 'attack-pattern',
        x_mitre_domains: ['enterprise-attack'],
      },
    },
    {
      stix: {
        created: '2024-02-10T00:00:00.000Z',
        id: 'attack-pattern--002',
        modified: '2024-04-15T00:00:00.000Z',
        type: 'attack-pattern',
        x_mitre_domains: ['enterprise-attack', 'mobile-attack'],
      },
    },
    {
      stix: {
        created: '2024-03-10T00:00:00.000Z',
        id: 'intrusion-set--001',
        modified: '2024-05-15T00:00:00.000Z',
        type: 'intrusion-set',
        x_mitre_domains: ['enterprise-attack'],
      },
    },
    {
      stix: {
        created: '2024-02-01T00:00:00.000Z',
        id: 'relationship--001',
        modified: '2024-04-20T00:00:00.000Z',
        type: 'relationship',
        relationship_type: 'uses',
      },
    },
    {
      stix: {
        created: '2024-02-01T00:00:00.000Z',
        id: 'relationship--001',
        modified: '2025-01-20T00:00:00.000Z',
        type: 'relationship',
        relationship_type: 'uses',
      },
    },
    {
      stix: {
        created: '2024-04-01T00:00:00.000Z',
        id: 'relationship--002',
        modified: '2024-05-20T00:00:00.000Z',
        type: 'relationship',
        relationship_type: 'mitigates',
      },
    },
  ];

  beforeEach(async () => {
    mockRestApiConnector = {
      getAllObjects: vi.fn(() => of(attackObjects)),
    };

    await TestBed.configureTestingModule({
      declarations: [DashboardPageComponent],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should aggregate objects by object type', () => {
    const techniques = component.objectTypeSummary.find(
      summary => summary.typeKey === 'technique'
    );
    const enterprise = component.sunburstSegments.find(
      node => node.id === 'domain:enterprise-attack'
    );
    const mobile = component.sunburstSegments.find(
      node => node.id === 'domain:mobile-attack'
    );

    expect(component.totalObjects).toBe(3);
    expect(component.totalAssignments).toBe(4);
    expect(component.totalRelationships).toBe(2);
    expect(techniques?.count).toBe(2);
    expect(enterprise?.value).toBe(3);
    expect(mobile?.value).toBe(1);
    expect(
      component.objectTypeSummary.some(
        summary => summary.typeKey === 'relationship'
      )
    ).toBe(false);
  });

  it('should use x_mitre_domains for matrix domains', () => {
    component.buildDashboard([
      {
        stix: {
          created: '2024-01-10T00:00:00.000Z',
          id: 'x-mitre-matrix--enterprise',
          type: 'x-mitre-matrix',
          x_mitre_domains: ['enterprise-attack'],
        },
      },
      {
        stix: {
          created: '2024-01-10T00:00:00.000Z',
          id: 'mobile-attack',
          type: 'x-mitre-matrix',
          x_mitre_domains: ['mobile-attack'],
        },
      },
      {
        stix: {
          created: '2024-01-10T00:00:00.000Z',
          id: 'x-mitre-matrix--ics',
          type: 'x-mitre-matrix',
          x_mitre_domains: ['ics-attack'],
        },
      },
    ]);

    const enterprise = component.sunburstSegments.find(
      node => node.id === 'domain:enterprise-attack'
    );
    const mobile = component.sunburstSegments.find(
      node => node.id === 'domain:mobile-attack'
    );
    const ics = component.sunburstSegments.find(
      node => node.id === 'domain:ics-attack'
    );
    const matrixSummary = component.objectTypeSummary.find(
      summary => summary.typeKey === 'matrix'
    );

    expect(component.totalObjects).toBe(3);
    expect(component.totalAssignments).toBe(3);
    expect(matrixSummary?.count).toBe(3);
    expect(enterprise?.value).toBe(1);
    expect(mobile?.value).toBe(1);
    expect(ics?.value).toBe(1);
    expect(
      component.sunburstSegments.some(node => node.id === 'domain:no-domain')
    ).toBe(false);
  });

  it('should summarize totals by object type across all domains', () => {
    expect(component.objectTypeSummary.map(summary => summary.typeKey)).toEqual(
      [
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
      ]
    );
    expect(
      component.objectTypeSummary.find(
        summary => summary.typeKey === 'technique'
      )
    ).toEqual(expect.objectContaining({ label: 'Techniques', count: 2 }));
    expect(
      component.objectTypeSummary.find(summary => summary.typeKey === 'group')
    ).toEqual(expect.objectContaining({ label: 'Groups', count: 1 }));
    expect(
      component.objectTypeSummary.find(summary => summary.typeKey === 'matrix')
    ).toEqual(expect.objectContaining({ label: 'Matrices', count: 0 }));
  });

  it('should aggregate relationships by relationship type', () => {
    const usesRelationships = component.relationshipSunburstSegments.find(
      node => node.id === 'relationship-type:uses'
    );
    const mitigatesRelationships = component.relationshipSunburstSegments.find(
      node => node.id === 'relationship-type:mitigates'
    );

    expect(usesRelationships?.value).toBe(1);
    expect(mitigatesRelationships?.value).toBe(1);
  });

  it('should deduplicate object and relationship versions by stix id', () => {
    const techniques = component.objectTypeSummary.find(
      summary => summary.typeKey === 'technique'
    );
    const enterprise = component.sunburstSegments.find(
      node => node.id === 'domain:enterprise-attack'
    );
    const enterpriseTechniques = component.sunburstSegments.find(
      node => node.id === 'domain:enterprise-attack/type:technique'
    );
    const usesRelationships = component.relationshipSunburstSegments.find(
      node => node.id === 'relationship-type:uses'
    );
    const timelineTechniques = component.objectGrowthLineSeries.find(
      series => series.key === 'technique'
    );

    expect(component.totalObjects).toBe(3);
    expect(component.totalRelationships).toBe(2);
    expect(techniques?.count).toBe(2);
    expect(enterprise?.value).toBe(3);
    expect(enterpriseTechniques?.value).toBe(2);
    expect(timelineTechniques?.total).toBe(2);
    expect(usesRelationships?.value).toBe(1);
  });

  it('should build timeline chart data from dated objects', () => {
    const techniques = component.objectGrowthLineSeries.find(
      series => series.key === 'technique'
    );
    const groups = component.objectGrowthLineSeries.find(
      series => series.key === 'group'
    );

    expect(component.objectGrowthYearTicks).toEqual([
      expect.objectContaining({ label: '2024', x: '30.00' }),
    ]);
    expect(component.objectGrowthYAxisLabels).toEqual(['2', '1', '0']);
    expect(techniques).toEqual(
      expect.objectContaining({ label: 'Techniques', total: 2 })
    );
    expect(techniques?.markers).toHaveLength(3);
    expect(groups).toEqual(
      expect.objectContaining({ label: 'Groups', total: 1 })
    );
    expect(component.objectGrowthTotal).toBe(3);
    expect(
      component.objectGrowthLineSeries.some(
        series => series.key === 'relationship'
      )
    ).toBe(false);

    component.selectObjectGrowthDomain('mobile-attack');
    expect(
      component.objectGrowthLineSeries.map(series => [series.key, series.total])
    ).toEqual([['technique', 1]]);
  });

  it('should render a selected timeline series above other object types', () => {
    const techniques = component.objectGrowthLineSeries.find(
      series => series.key === 'technique'
    );
    const groups = component.objectGrowthLineSeries.find(
      series => series.key === 'group'
    );

    component.selectObjectGrowthType('technique');

    const displaySeries = component.objectGrowthLineSeriesForDisplay;

    expect(component.selectedObjectGrowthType).toBe('technique');
    expect(displaySeries[displaySeries.length - 1]?.key).toBe('technique');
    expect(component.isObjectGrowthSeriesSelected(techniques!)).toBe(true);
    expect(component.isObjectGrowthSeriesDimmed(groups!)).toBe(true);

    component.selectObjectGrowthType('technique');

    expect(component.selectedObjectGrowthType).toBeUndefined();
    expect(component.isObjectGrowthSeriesDimmed(groups!)).toBe(false);
  });

  it('should assign unique timeline colors for known object types', () => {
    const objectTypes = [
      ['x-mitre-matrix', 'matrix'],
      ['x-mitre-tactic', 'tactic'],
      ['attack-pattern', 'technique'],
      ['intrusion-set', 'group'],
      ['malware', 'software'],
      ['campaign', 'campaign'],
      ['course-of-action', 'mitigation'],
      ['x-mitre-asset', 'asset'],
      ['x-mitre-detection-strategy', 'detection-strategy'],
      ['x-mitre-analytic', 'analytic'],
      ['x-mitre-data-component', 'data-component'],
      ['marking-definition', 'marking-definition'],
    ];
    component.buildDashboard(
      objectTypes.map(([stixType], index) => ({
        stix: {
          created: '2024-01-10T00:00:00.000Z',
          id: `${stixType}--${index}`,
          type: stixType,
          x_mitre_domains: ['enterprise-attack'],
        },
      }))
    );

    const colors = component.objectGrowthLineSeries.map(series => series.color);

    expect(
      component.objectGrowthLineSeries.map(series => series.key).sort()
    ).toEqual(objectTypes.map(([, typeKey]) => typeKey).sort());
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('should exclude notes, collections, data sources, and identities from dashboard object charts', () => {
    component.buildDashboard([
      {
        stix: {
          created: '2024-01-10T00:00:00.000Z',
          id: 'attack-pattern--tracked',
          type: 'attack-pattern',
          x_mitre_domains: ['enterprise-attack'],
        },
      },
      {
        stix: {
          created: '2024-01-10T00:00:00.000Z',
          id: 'x-mitre-collection--excluded',
          type: 'x-mitre-collection',
          x_mitre_domains: ['enterprise-attack'],
        },
      },
      {
        stix: {
          created: '2024-01-10T00:00:00.000Z',
          id: 'note--excluded',
          type: 'note',
          x_mitre_domains: ['enterprise-attack'],
        },
      },
      {
        stix: {
          created: '2024-01-10T00:00:00.000Z',
          id: 'x-mitre-data-source--excluded',
          type: 'x-mitre-data-source',
          x_mitre_domains: ['enterprise-attack'],
        },
      },
      {
        stix: {
          created: '2024-01-10T00:00:00.000Z',
          id: 'identity--excluded',
          type: 'identity',
          x_mitre_domains: ['enterprise-attack'],
        },
      },
    ]);

    const chartTypeKeys = [
      ...component.sunburstSegments.map(segment => segment.key),
      ...component.objectGrowthLineSeries.map(series => series.key),
    ];

    expect(component.totalObjects).toBe(1);
    expect(component.totalAssignments).toBe(1);
    expect(component.objectGrowthTotal).toBe(1);
    expect(chartTypeKeys).not.toContain('collection');
    expect(chartTypeKeys).not.toContain('note');
    expect(chartTypeKeys).not.toContain('data-source');
    expect(chartTypeKeys).not.toContain('identity');
  });

  it('should use the same object type colors in the sunburst and timeline', () => {
    const timelineTechnique = component.objectGrowthLineSeries.find(
      series => series.key === 'technique'
    );
    const enterpriseTechnique = component.sunburstSegments.find(
      node => node.id === 'domain:enterprise-attack/type:technique'
    );
    const mobileTechnique = component.sunburstSegments.find(
      node => node.id === 'domain:mobile-attack/type:technique'
    );

    expect(enterpriseTechnique?.color).toBe(timelineTechnique?.color);
    expect(mobileTechnique?.color).toBe(timelineTechnique?.color);
  });

  it('should drill into domain and type without status nodes', () => {
    component.selectNodeById('domain:enterprise-attack');

    expect(component.selectedPathLabel).toBe('ATT&CK Objects / Enterprise');
    expect(component.selectedChildren.map(child => child.label)).toEqual([
      'Techniques',
      'Groups',
    ]);

    component.selectNodeById('domain:enterprise-attack/type:technique');

    expect(component.selectedPathLabel).toBe(
      'ATT&CK Objects / Enterprise / Techniques'
    );
    expect(component.selectedChildren).toEqual([]);
    expect(
      component.sunburstSegments.some(node => node.id.includes('/status:'))
    ).toBe(false);
  });

  it('should drill into a selected relationship type without status nodes', () => {
    component.selectRelationshipNodeById('relationship-type:uses');

    expect(component.selectedRelationshipPathLabel).toBe(
      'Relationships / Uses'
    );
    expect(component.selectedRelationshipChildren).toEqual([]);
    expect(
      component.relationshipSunburstSegments.some(node =>
        node.id.includes('/status:')
      )
    ).toBe(false);
  });
});
