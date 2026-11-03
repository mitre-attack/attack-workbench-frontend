import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { DataQualityComponent } from './data-quality.component';
import {
  ReleaseTrackCoverageReport,
  RestApiConnectorService,
} from 'src/app/services/connectors/rest-api/rest-api-connector.service';
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
    getReleaseTrackCoverageReport: vi.fn(),
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
    mockReportService.getReleaseTrackCoverageReport.mockReturnValue(
      of({
        untracked_latest_revisions: [],
        never_enrolled_objects: [],
        summary: {
          untracked_latest_revision_count: 0,
          never_enrolled_object_count: 0,
        },
      })
    );
    await TestBed.configureTestingModule({
      declarations: [DataQualityComponent],
      imports: [CommonModule],
      schemas: [NO_ERRORS_SCHEMA],
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

  it('keeps report objects navigable when ATT&CK ID or name is absent', () => {
    mockReportService.getReleaseTrackCoverageReport.mockReturnValue(
      of({
        untracked_latest_revisions: [
          {
            stix: {
              id: 'attack-pattern--latest',
              type: 'attack-pattern',
              name: 'Latest',
            },
            workspace: { attack_id: 'T0001' },
          },
        ],
        never_enrolled_objects: [
          {
            stix: { id: 'x-mitre-analytic--new', type: 'x-mitre-analytic' },
            workspace: {},
          },
        ],
        summary: {
          untracked_latest_revision_count: 1,
          never_enrolled_object_count: 1,
        },
      })
    );
    component.loadReleaseTrackCoverage();

    expect(component.untrackedLatestRevisionsConfig.stixObjects).toEqual([
      expect.objectContaining({
        stixID: 'attack-pattern--latest',
        attackType: 'technique',
        attackID: 'T0001',
        name: 'Latest',
      }),
    ]);
    expect(component.neverEnrolledObjectsConfig.stixObjects).toEqual([
      expect.objectContaining({
        stixID: 'x-mitre-analytic--new',
        attackType: 'analytic',
        attackID: 'x-mitre-analytic--new',
        name: 'x-mitre-analytic--new',
      }),
    ]);
  });

  it('does not present loading or failed coverage as an empty successful report', () => {
    const response = new Subject<ReleaseTrackCoverageReport>();
    mockReportService.getReleaseTrackCoverageReport.mockReturnValue(response);
    component.loadReleaseTrackCoverage();
    fixture.detectChanges();
    const text = () => fixture.nativeElement.textContent as string;
    expect(text()).not.toContain('No untracked latest revisions found.');
    expect(text()).not.toContain(
      'No objects without recorded release-track membership found.'
    );

    response.error(new Error('Report unavailable'));
    fixture.detectChanges();
    expect(text()).toContain('Failed to load release-track coverage report');
    expect(text()).not.toContain('No untracked latest revisions found.');
    expect(text()).not.toContain(
      'No objects without recorded release-track membership found.'
    );

    mockReportService.getReleaseTrackCoverageReport.mockReturnValue(
      of({
        untracked_latest_revisions: [],
        never_enrolled_objects: [],
        summary: {
          untracked_latest_revision_count: 0,
          never_enrolled_object_count: 0,
        },
      })
    );
    component.loadReleaseTrackCoverage();
    fixture.detectChanges();
    expect(text()).not.toContain(
      'Failed to load release-track coverage report'
    );
    expect(text()).toContain('No untracked latest revisions found.');
    expect(text()).toContain(
      'No objects without recorded release-track membership found.'
    );
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
