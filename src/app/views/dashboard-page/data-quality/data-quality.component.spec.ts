import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { DataQualityComponent } from './data-quality.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';

describe('DataQualityComponent', () => {
  let component: DataQualityComponent;
  let fixture: ComponentFixture<DataQualityComponent>;

  const mockReportService = {
    getMissingLinkById: () => of([]),
    getParallelRelationships: () => of({}),
    getDomainConsistencyReport: () =>
      of({
        cross_domain_relationships: [
          {
            stix: {
              id: 'relationship--1',
              relationship_type: 'uses',
              source_ref: 'intrusion-set--1',
              target_ref: 'attack-pattern--1',
            },
            source_object: {
              workspace: { attack_id: 'G0001' },
              stix: {
                id: 'intrusion-set--1',
                type: 'intrusion-set',
                name: 'Group One',
              },
            },
            target_object: {
              workspace: { attack_id: 'T0001' },
              stix: {
                id: 'attack-pattern--1',
                type: 'attack-pattern',
                name: 'Technique One',
              },
            },
            source_domains: ['enterprise-attack'],
            target_domains: ['mobile-attack'],
          },
        ],
        objects_without_domains: [
          {
            workspace: { attack_id: 'T0002' },
            stix: {
              id: 'attack-pattern--2',
              type: 'attack-pattern',
              name: 'Domainless',
            },
          },
        ],
        summary: {
          cross_domain_relationship_count: 1,
          objects_without_domains_count: 1,
        },
      }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DataQualityComponent],
      providers: [
        { provide: RestApiConnectorService, useValue: mockReportService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DataQualityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the domain consistency report rows', () => {
    expect(component.crossDomainRelationships).toEqual([
      expect.objectContaining({
        stixId: 'relationship--1',
        relationshipType: 'uses',
        sourceId: 'G0001',
        targetId: 'T0001',
        sourceName: 'Group One',
        targetName: 'Technique One',
        sourceDomains: ['enterprise-attack'],
        targetDomains: ['mobile-attack'],
      }),
    ]);
    expect(
      component.objectLink(component.crossDomainRelationships[0].source)
    ).toEqual(['/', 'group', 'intrusion-set--1']);
    const config = component.stixConfigForObjectsWithoutDomains();
    expect(config.stixObjects).toEqual([
      expect.objectContaining({
        stixID: 'attack-pattern--2',
        attackID: 'T0002',
        name: 'Domainless',
      }),
    ]);
  });
});
