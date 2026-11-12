import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterModule, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { DataQualityComponent } from './data-quality.component';
import {
  ReleaseTrackCoverageReport,
  RestApiConnectorService,
  UntrackedLatestRevision,
} from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { Relationship } from 'src/app/classes/stix/relationship';
import { DeprecationService } from 'src/app/services/helpers/deprecation.service';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';

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
  const authentication = { isAuthorized: vi.fn() };
  const releaseTracks = { listReleaseTracks: vi.fn(), addCandidates: vi.fn() };
  const destination = {
    track_id: 'release-track--destination',
    type: 'standard',
    name: 'Destination',
  };

  function enrollmentReport(): ReleaseTrackCoverageReport {
    return {
      untracked_latest_revisions: [untrackedRevision()],
      never_enrolled_objects: [
        {
          stix: {
            id: 'x-mitre-analytic--new',
            type: 'x-mitre-analytic',
            name: 'New analytic',
          },
          workspace: { attack_id: 'AN0001' },
        },
      ],
      summary: {
        untracked_latest_revision_count: 1,
        never_enrolled_object_count: 1,
      },
    };
  }

  function displayCoverage(report = enrollmentReport()): void {
    mockReportService.getReleaseTrackCoverageReport.mockReturnValue(of(report));
    component.loadReleaseTrackCoverage();
    fixture.detectChanges();
  }

  async function openCandidateMenu(label: string): Promise<HTMLElement> {
    const table = coverageTable(label);
    if (
      !table.closest('mat-expansion-panel').classList.contains('mat-expanded')
    ) {
      toggleCoveragePanel(label);
    }
    table
      .querySelector<HTMLButtonElement>('td.mat-column-enroll button')
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const trigger = table.querySelector('td.mat-column-enroll button');
    return document.getElementById(trigger.getAttribute('aria-controls'));
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    authentication.isAuthorized.mockReturnValue(true);
    releaseTracks.listReleaseTracks.mockReturnValue(
      of({ data: [destination] })
    );
    releaseTracks.addCandidates.mockReturnValue(of({}));
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
      imports: [
        CommonModule,
        RouterModule,
        MatTableModule,
        MatPaginatorModule,
        MatExpansionModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        NoopAnimationsModule,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideRouter([]),
        { provide: RestApiConnectorService, useValue: mockReportService },
        { provide: DeprecationService, useValue: lifecycle },
        { provide: MatDialog, useValue: dialog },
        { provide: AuthenticationService, useValue: authentication },
        { provide: ReleaseTracksConnectorService, useValue: releaseTracks },
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

  function untrackedRevision(index = 0): UntrackedLatestRevision {
    return {
      stix: {
        id: `attack-pattern--latest-${index}`,
        type: 'attack-pattern',
        name: `Latest ${index}`,
        modified: '2026-11-03T10:20:30.000Z',
      },
      workspace: { attack_id: `T${index}` },
      last_enrolled_revision: {
        modified: '2025-10-21T15:10:28.402Z',
        x_mitre_version: '1.0',
        release_tracks: [
          {
            id: 'release-track--current',
            name: 'Current track name',
            type: 'standard',
            tier: 'candidate',
            status: 'pending',
          },
          {
            id: 'release-track--deleted',
            type: 'standard',
            tier: 'member',
            status: 'reviewed',
          },
        ],
      },
      unenrolled_revision_count: 2,
    };
  }

  function coverageTable(label: string): HTMLTableElement {
    return fixture.nativeElement.querySelector(`table[aria-label="${label}"]`);
  }

  function toggleCoveragePanel(label: string): void {
    coverageTable(label)
      .closest('mat-expansion-panel')
      .querySelector<HTMLElement>('mat-expansion-panel-header')
      .click();
    fixture.detectChanges();
  }

  it('renders revision context, UTC dates, fallback metadata, and accessible links', () => {
    const report: ReleaseTrackCoverageReport = {
      untracked_latest_revisions: [untrackedRevision()],
      never_enrolled_objects: [
        {
          stix: {
            id: 'x-mitre-analytic--new',
            type: 'x-mitre-analytic',
            name: 'New analytic',
            created: '2026-01-02T03:04:05.000Z',
            modified: '2026-02-03T04:05:06.000Z',
            x_mitre_version: '2.1',
          },
          workspace: { attack_id: 'AN0001' },
        },
        {
          stix: { id: 'x-mitre-analytic--missing', type: 'x-mitre-analytic' },
          workspace: {},
        },
      ],
      summary: {
        untracked_latest_revision_count: 1,
        never_enrolled_object_count: 2,
      },
    };
    mockReportService.getReleaseTrackCoverageReport.mockReturnValue(of(report));
    component.loadReleaseTrackCoverage();
    fixture.detectChanges();
    toggleCoveragePanel('Untracked latest revisions');
    toggleCoveragePanel('Never enrolled objects');

    const untracked = coverageTable('Untracked latest revisions');
    expect(untracked.textContent).toContain('Nov 3, 2026, 10:20:30 UTC');
    expect(untracked.textContent).toContain('Oct 21, 2025, 15:10:28 UTC');
    expect(untracked.textContent).toContain('Version 1.0');
    expect(untracked.querySelector('.mat-column-type').textContent).toContain(
      'Type'
    );
    expect(untracked.querySelector('td.mat-column-type').textContent).toContain(
      'technique'
    );
    expect(
      untracked
        .querySelector('td.mat-column-unenrolledCount')
        .textContent.trim()
    ).toBe('2');
    const trackLinks =
      untracked.querySelectorAll<HTMLAnchorElement>('.dq-track-links a');
    expect(trackLinks).toHaveLength(1);
    expect(trackLinks[0].textContent.trim()).toBe('Current track name');
    expect(trackLinks[0].getAttribute('href')).toBe(
      '/dashboard/release-management/release-track--current'
    );
    expect(untracked.querySelector('.dq-track-links').textContent).toContain(
      'release-track--deleted'
    );

    const neverEnrolled = coverageTable('Never enrolled objects');
    expect(neverEnrolled.textContent).toContain('Jan 2, 2026, 03:04:05 UTC');
    expect(neverEnrolled.textContent).toContain('Feb 3, 2026, 04:05:06 UTC');
    expect(
      neverEnrolled.querySelector('td.mat-column-version').textContent.trim()
    ).toBe('2.1');
    const missing = neverEnrolled.querySelectorAll('tr.mat-mdc-row')[1];
    expect(
      missing.querySelector('.mat-column-attackID a').textContent.trim()
    ).toBe('x-mitre-analytic--missing');
    expect(
      missing.querySelector('.mat-column-name a').getAttribute('href')
    ).toBe('/analytic/x-mitre-analytic--missing');
    for (const column of ['created', 'modified', 'version']) {
      expect(
        missing.querySelector(`.mat-column-${column}`).textContent.trim()
      ).toBe('—');
    }

    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    trackLinks[0].click();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0][0].toString()).toBe(
      '/dashboard/release-management/release-track--current'
    );
    navigate.mockClear();
    untracked.querySelector<HTMLElement>('tr.mat-mdc-row').click();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0][0].toString()).toBe(
      '/technique/attack-pattern--latest-0'
    );
    navigate.mockClear();
    missing.querySelector<HTMLAnchorElement>('.mat-column-name a').click();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0][0].toString()).toBe(
      '/analytic/x-mitre-analytic--missing'
    );
    navigate.mockRestore();
  });

  it('keeps untracked objects readable when optional identifiers and revision metadata are absent', () => {
    const revision = untrackedRevision();
    delete revision.workspace.attack_id;
    delete revision.stix.name;
    delete revision.stix.modified;
    delete revision.last_enrolled_revision.x_mitre_version;
    mockReportService.getReleaseTrackCoverageReport.mockReturnValue(
      of({
        untracked_latest_revisions: [revision],
        never_enrolled_objects: [],
        summary: {
          untracked_latest_revision_count: 1,
          never_enrolled_object_count: 0,
        },
      } satisfies ReleaseTrackCoverageReport)
    );
    component.loadReleaseTrackCoverage();
    fixture.detectChanges();
    toggleCoveragePanel('Untracked latest revisions');

    const table = coverageTable('Untracked latest revisions');
    expect(
      table.querySelector('td.mat-column-modified').textContent.trim()
    ).toBe('—');
    expect(table.querySelector('.dq-version')).toBeNull();
    expect(
      table.querySelector('td.mat-column-lastEnrolled').textContent
    ).toContain('Oct 21, 2025, 15:10:28 UTC');
    for (const column of ['attackID', 'name']) {
      const anchor = table.querySelector(`td.mat-column-${column} a`);
      expect(anchor.textContent.trim()).toBe(revision.stix.id);
      expect(anchor.getAttribute('href')).toBe(
        '/technique/attack-pattern--latest-0'
      );
    }
  });

  it('paginates independently after asynchronous loading and collapsed sections, then resets on reload', () => {
    const response = new Subject<ReleaseTrackCoverageReport>();
    mockReportService.getReleaseTrackCoverageReport.mockReturnValue(response);
    component.loadReleaseTrackCoverage();
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('mat-paginator'))).toHaveLength(
      0
    );

    const report: ReleaseTrackCoverageReport = {
      untracked_latest_revisions: Array.from({ length: 11 }, (_, index) =>
        untrackedRevision(index)
      ),
      never_enrolled_objects: Array.from({ length: 12 }, (_, index) => ({
        stix: {
          id: `x-mitre-analytic--${index}`,
          type: 'x-mitre-analytic',
          name: `Analytic ${index}`,
        },
        workspace: {},
      })),
      summary: {
        untracked_latest_revision_count: 11,
        never_enrolled_object_count: 12,
      },
    };
    response.next(report);
    fixture.detectChanges();
    const table = () => coverageTable('Untracked latest revisions');
    const neverTable = () => coverageTable('Never enrolled objects');
    expect(
      table().closest('mat-expansion-panel').classList.contains('mat-expanded')
    ).toBe(false);
    toggleCoveragePanel('Untracked latest revisions');
    toggleCoveragePanel('Never enrolled objects');
    expect(table().querySelectorAll('tr.mat-mdc-row')).toHaveLength(10);
    expect(neverTable().querySelectorAll('tr.mat-mdc-row')).toHaveLength(10);

    const paginators = fixture.nativeElement.querySelectorAll('mat-paginator');
    paginators[0].querySelector('.mat-mdc-paginator-navigation-next').click();
    fixture.detectChanges();
    expect(table().querySelectorAll('tr.mat-mdc-row')).toHaveLength(1);
    expect(table().textContent).toContain('Latest 10');
    expect(neverTable().querySelectorAll('tr.mat-mdc-row')).toHaveLength(10);
    paginators[1].querySelector('.mat-mdc-paginator-navigation-next').click();
    fixture.detectChanges();
    expect(neverTable().querySelectorAll('tr.mat-mdc-row')).toHaveLength(2);
    expect(table().querySelectorAll('tr.mat-mdc-row')).toHaveLength(1);
    toggleCoveragePanel('Untracked latest revisions');
    toggleCoveragePanel('Untracked latest revisions');
    expect(table().querySelectorAll('tr.mat-mdc-row')).toHaveLength(1);

    response.complete();
    mockReportService.getReleaseTrackCoverageReport.mockReturnValue(of(report));
    component.loadReleaseTrackCoverage();
    fixture.detectChanges();
    expect(table().querySelectorAll('tr.mat-mdc-row')).toHaveLength(10);
    expect(neverTable().querySelectorAll('tr.mat-mdc-row')).toHaveLength(10);
    expect(component.untrackedPage.pageIndex).toBe(0);
    expect(component.neverEnrolledPage.pageIndex).toBe(0);
  });

  it('offers only standard tracks, including historical memberships, and enrolls the selected row from either report', async () => {
    const initial = enrollmentReport();
    displayCoverage(initial);
    releaseTracks.listReleaseTracks.mockReturnValue(
      of({
        data: [
          destination,
          {
            track_id: 'release-track--current',
            type: 'standard',
            name: 'Current track name',
          },
          {
            track_id: 'release-track--virtual',
            type: 'virtual',
            name: 'Virtual aggregation',
          },
        ],
      })
    );
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    const pending = new Subject<unknown>();
    releaseTracks.addCandidates.mockReturnValue(pending);
    const menu = await openCandidateMenu('Untracked latest revisions');
    expect(menu.textContent).toContain('Current track name');
    expect(menu.textContent).toContain('Destination');
    expect(menu.textContent).not.toContain('Virtual aggregation');
    const choice = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('[mat-menu-item]')
    ).find(button => button.textContent.trim() === 'Destination');
    choice.click();
    fixture.detectChanges();
    component.enrollCandidate(
      initial.untracked_latest_revisions[0],
      destination
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(releaseTracks.addCandidates).toHaveBeenCalledExactlyOnceWith(
      destination.track_id,
      [initial.untracked_latest_revisions[0].stix.id]
    );
    expect(component.untrackedLatestRevisionCount).toBe(1);
    expect(
      coverageTable('Never enrolled objects').querySelector<HTMLButtonElement>(
        'td.mat-column-enroll button'
      ).disabled
    ).toBe(true);
    mockReportService.getReleaseTrackCoverageReport.mockReturnValue(
      of({
        ...initial,
        untracked_latest_revisions: [],
        summary: {
          untracked_latest_revision_count: 0,
          never_enrolled_object_count: 1,
        },
      })
    );
    pending.next({});
    pending.complete();
    fixture.detectChanges();
    expect(component.untrackedLatestRevisionCount).toBe(0);
    expect(component.neverEnrolledObjectCount).toBe(1);

    releaseTracks.addCandidates.mockReturnValue(of({}));
    const neverMenu = await openCandidateMenu('Never enrolled objects');
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
    Array.from(neverMenu.querySelectorAll<HTMLButtonElement>('[mat-menu-item]'))
      .find(button => button.textContent.trim() === 'Destination')
      .click();
    fixture.detectChanges();
    expect(releaseTracks.addCandidates).toHaveBeenLastCalledWith(
      destination.track_id,
      ['x-mitre-analytic--new']
    );
    expect(component.neverEnrolledObjectCount).toBe(0);
    expect(navigate).not.toHaveBeenCalled();
    navigate.mockRestore();
  });

  it('distinguishes track-loading failures from no standard tracks and permits retry', async () => {
    displayCoverage();
    releaseTracks.listReleaseTracks.mockReturnValue(of(null));
    const menu = await openCandidateMenu('Untracked latest revisions');
    expect(menu.textContent).toContain(
      'Available release tracks could not be loaded.'
    );
    expect(menu.textContent).not.toContain(
      'No standard release tracks available.'
    );
    releaseTracks.listReleaseTracks.mockReturnValue(of({ data: [] }));
    Array.from(menu.querySelectorAll<HTMLButtonElement>('[mat-menu-item]'))
      .find(button => button.textContent.trim() === 'Retry loading tracks')
      .click();
    fixture.detectChanges();
    expect(menu.textContent).toContain('No standard release tracks available.');
    expect(releaseTracks.addCandidates).not.toHaveBeenCalled();
  });

  it.each([
    { message: 'An enrollment conflict requires review.' },
    'An enrollment conflict requires review.',
  ])(
    'keeps rejected objects visible and displays structured or text API errors: %j',
    async responseError => {
      displayCoverage();
      releaseTracks.addCandidates.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: responseError,
            })
        )
      );
      const menu = await openCandidateMenu('Never enrolled objects');
      menu.querySelector<HTMLButtonElement>('[mat-menu-item]').click();
      fixture.detectChanges();
      const table = coverageTable('Never enrolled objects');
      expect(table.textContent).toContain('New analytic');
      expect(table.querySelector('[role="alert"]').textContent).toContain(
        'An enrollment conflict requires review.'
      );
      expect(component.neverEnrolledObjectCount).toBe(1);
      expect(
        table.querySelector<HTMLButtonElement>('td.mat-column-enroll button')
          .disabled
      ).toBe(false);
    }
  );

  it('blocks another enrollment when the write succeeds but refreshing the report fails', () => {
    const report = enrollmentReport();
    displayCoverage(report);
    component.loadCandidateTracks();
    mockReportService.getReleaseTrackCoverageReport.mockReturnValue(
      throwError(() => new Error('offline'))
    );
    component.enrollCandidate(
      report.untracked_latest_revisions[0],
      destination
    );
    fixture.detectChanges();
    expect(component.enrollmentRefreshError).toContain('Enrollment succeeded');
    expect(component.untrackedLatestRevisionCount).toBe(1);
    component.enrollCandidate(report.never_enrolled_objects[0], destination);
    expect(releaseTracks.addCandidates).toHaveBeenCalledTimes(1);
    expect(
      coverageTable('Never enrolled objects').querySelector<HTMLButtonElement>(
        'td.mat-column-enroll button'
      ).disabled
    ).toBe(true);
    displayCoverage();
    expect(component.enrollmentRefreshError).toBeUndefined();
  });

  it('clamps the affected page after enrollment without collapsing or resetting the other report', () => {
    const report = enrollmentReport();
    report.untracked_latest_revisions = Array.from({ length: 11 }, (_, index) =>
      untrackedRevision(index)
    );
    report.never_enrolled_objects = Array.from({ length: 12 }, (_, index) => ({
      stix: {
        id: `x-mitre-analytic--${index}`,
        type: 'x-mitre-analytic',
        name: `Analytic ${index}`,
      },
      workspace: {},
    }));
    report.summary = {
      untracked_latest_revision_count: 11,
      never_enrolled_object_count: 12,
    };
    displayCoverage(report);
    toggleCoveragePanel('Untracked latest revisions');
    toggleCoveragePanel('Never enrolled objects');
    component.untrackedPage.pageIndex = 1;
    component.neverEnrolledPage.pageIndex = 1;
    component.loadCandidateTracks();
    mockReportService.getReleaseTrackCoverageReport.mockReturnValue(
      of({
        ...report,
        untracked_latest_revisions: report.untracked_latest_revisions.slice(
          0,
          10
        ),
        summary: {
          untracked_latest_revision_count: 10,
          never_enrolled_object_count: 12,
        },
      })
    );
    component.enrollCandidate(
      report.untracked_latest_revisions[10],
      destination
    );
    fixture.detectChanges();
    expect(component.untrackedPage.pageIndex).toBe(0);
    expect(component.neverEnrolledPage.pageIndex).toBe(1);
    expect(coverageTable('Never enrolled objects').textContent).toContain(
      'Analytic 10'
    );
    expect(
      coverageTable('Untracked latest revisions')
        .closest('mat-expansion-panel')
        .classList.contains('mat-expanded')
    ).toBe(true);
  });

  it('does not offer or submit candidate enrollment without dashboard management permission', () => {
    const report = enrollmentReport();
    authentication.isAuthorized.mockReturnValue(false);
    displayCoverage(report);
    expect(
      fixture.nativeElement.querySelector('td.mat-column-enroll button')
    ).toBeNull();
    component.loadCandidateTracks();
    component.enrollCandidate(
      report.untracked_latest_revisions[0],
      destination
    );
    expect(releaseTracks.listReleaseTracks).not.toHaveBeenCalled();
    expect(releaseTracks.addCandidates).not.toHaveBeenCalled();
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
