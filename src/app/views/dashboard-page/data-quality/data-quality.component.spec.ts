import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { DataQualityComponent } from './data-quality.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { Relationship } from 'src/app/classes/stix/relationship';
import { DeprecationService } from 'src/app/services/helpers/deprecation.service';

describe('DataQualityComponent', () => {
  let component: DataQualityComponent;
  let fixture: ComponentFixture<DataQualityComponent>;

  const mockReportService = {
    getRelationship: vi.fn(),
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
  const lifecycle = { deprecate: vi.fn(), showError: vi.fn() };
  const dialog = { open: () => ({ afterClosed: () => of(true) }) };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      declarations: [DataQualityComponent],
      providers: [
        { provide: RestApiConnectorService, useValue: mockReportService },
        { provide: DeprecationService, useValue: lifecycle },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DataQualityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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

  for (const relationshipType of ['subtechnique-of', 'revoked-by']) {
    it(`explicitly retires duplicate ${relationshipType} SROs and stops on failure`, () => {
      const relationship = new Relationship();
      relationship.relationship_type = relationshipType;
      mockReportService.getRelationship.mockReturnValue(of([relationship]));
      lifecycle.deprecate.mockReturnValue(of(false));
      const group = {
        key: 'duplicates',
        sourceRef: 'attack-pattern--source',
        targetRef: 'attack-pattern--target',
        relationshipType,
        count: 3,
        relationships: [],
        selectedRelationship: 'relationship--keep',
        toDeprecate: [relationship.stixID, 'relationship--second'],
      };
      component.deprecateOthers(group);
      expect(lifecycle.deprecate).toHaveBeenCalledWith(relationship, true);
      expect(mockReportService.getRelationship).toHaveBeenCalledTimes(1);
      expect(group.toDeprecate).toHaveLength(2);
      expect(component.loadingParallel).toBe(false);
    });
  }
});
