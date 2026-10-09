import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';

import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { MembershipSectionComponent } from './membership-section.component';
import { WorkbenchChipComponent } from 'src/app/components/workbench-chip/workbench-chip.component';
import {
  MembershipSectionDataService,
  MembershipTrack,
} from 'src/app/services/connectors/rest-api/membership-section-data.service';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';

describe('MembershipSectionComponent', () => {
  let component: MembershipSectionComponent;
  let fixture: ComponentFixture<MembershipSectionComponent>;
  let membershipDataService: any;
  let authenticationService: any;
  let releaseTracksConnector: any;
  let dialog: any;
  let router: any;

  const membershipTracks: MembershipTrack[] = [
    {
      id: 'release-track--standard',
      name: 'Core Release Track',
      description: 'Standard release track',
      type: 'standard',
      current_draft: null,
      production_releases: [],
      releases: [],
      versions: [],
    },
    {
      id: 'release-track--virtual',
      name: 'Enterprise Release Track',
      description: 'Virtual release track',
      type: 'virtual',
      current_draft: null,
      production_releases: [],
      releases: [],
      versions: [],
    },
  ];

  beforeEach(async () => {
    membershipDataService = {
      loadMemberships: vi.fn(),
    };

    membershipDataService.loadMemberships.mockReturnValue(
      of(membershipTracks.map(track => ({ ...track })))
    );

    authenticationService = {
      isAuthorized: vi.fn().mockReturnValue(true),
    };

    router = { navigate: vi.fn() };
    dialog = { open: vi.fn() };
    releaseTracksConnector = {
      listReleaseTracks: vi.fn(),
      addCandidates: vi.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [MembershipSectionComponent],
      imports: [WorkbenchChipComponent],
      providers: [
        {
          provide: MembershipSectionDataService,
          useValue: membershipDataService,
        },
        {
          provide: AuthenticationService,
          useValue: authenticationService,
        },
        {
          provide: ReleaseTracksConnectorService,
          useValue: releaseTracksConnector,
        },
        { provide: MatDialog, useValue: dialog },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MembershipSectionComponent);

    component = fixture.componentInstance;

    component.config = {
      mode: 'view',
      object: {
        stixID: 'attack-pattern--063b5b92-5361-481a-9c3f-95492ed9a2d8',
        name: 'Service Stop',
        type: 'attack-pattern',
      },
    };

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose the object reference', () => {
    expect(component.objectRef).toBe(
      'attack-pattern--063b5b92-5361-481a-9c3f-95492ed9a2d8'
    );
  });

  it('should load memberships through the data service', () => {
    expect(membershipDataService.loadMemberships).toHaveBeenCalledWith(
      'attack-pattern--063b5b92-5361-481a-9c3f-95492ed9a2d8',
      component.membershipObject,
      component.config
    );
  });

  it('should display the object release-track memberships', () => {
    expect(component.memberships.length).toBe(2);
    expect(component.memberships[0].name).toBe('Core Release Track');
    expect(component.memberships[0].type).toBe('standard');
    expect(component.memberships[1].name).toBe('Enterprise Release Track');
    expect(component.memberships[1].type).toBe('virtual');
  });

  it('should mark a virtual release track as virtual', () => {
    const enterpriseTrack = component.memberships[1];

    expect(component.getTrackType(enterpriseTrack)).toBe('VIRTUAL');

    expect(component.isVirtualTrack(enterpriseTrack)).toBe(true);
  });

  it('should label a work-in-progress draft with a placeholder date', () => {
    const membership = {
      ...component.memberships[0],
      current_draft: {
        status: 'work-in-progress',
        in_current_draft: true,
      },
    };

    expect(component.getDraftStatusLabel(membership)).toBe('Work in Progress');
    expect(component.getDraftDateLabel(membership)).toBe('As of TBD');
  });

  it('should identify a draft that is awaiting review', () => {
    const membership = {
      ...component.memberships[0],
      current_draft: {
        status: 'awaiting-review',
        in_current_draft: true,
      },
    };

    expect(component.getDraftStatusLabel(membership)).toBe('In Review');
    expect(component.isDraftInReview(membership)).toBe(true);
  });

  it('should identify a staged draft', () => {
    const membership = {
      ...component.memberships[0],
      tier: 'staged',
      status: 'reviewed',
      current_draft: {
        tier: 'staged',
        status: 'reviewed',
        in_current_draft: true,
      },
    };

    expect(component.getDraftStatusLabel(membership)).toBe('Staged');
    expect(component.isDraftStaged(membership)).toBe(true);
    expect(component.isDraftInReview(membership)).toBe(false);
  });

  it('should render Clear and Compare buttons', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Clear');
    expect(element.textContent).toContain('Compare (0/2)');
  });

  it('should navigate authorized users to the release track dashboard', () => {
    const track = component.memberships[0];

    component.toggleReleaseSelection(
      { id: 'release--1', version: '1.0' },
      track,
      true
    );

    component.viewTrack(track);

    expect(router.navigate).toHaveBeenCalledWith([
      '/dashboard/release-management',
      track.id,
    ]);
  });

  it('should enable View Track only for a track with a selected release', () => {
    const selectedTrack = component.memberships[0];
    const otherTrack = component.memberships[1];

    component.toggleReleaseSelection(
      { id: 'release--1', version: '1.0' },
      selectedTrack,
      true
    );

    expect(component.hasSelectedReleaseForTrack(selectedTrack)).toBe(true);
    expect(component.hasSelectedReleaseForTrack(otherTrack)).toBe(false);
  });

  it('should allow no more than two selected releases', () => {
    const membership = component.memberships[0];

    component.toggleReleaseSelection(
      { id: 'release--1', version: '1.0' },
      membership,
      true
    );

    component.toggleReleaseSelection(
      { id: 'release--2', version: '2.0' },
      membership,
      true
    );

    component.toggleReleaseSelection(
      { id: 'release--3', version: '3.0' },
      membership,
      true
    );

    expect(component.selectedReleaseCount).toBe(2);
  });

  it('should clear selected releases', () => {
    const membership = component.memberships[0];

    component.toggleReleaseSelection(
      { id: 'release--1', version: '1.0' },
      membership,
      true
    );

    component.clearSelection();

    expect(component.selectedReleaseCount).toBe(0);
  });

  it('should disable View Track after clearing the selected release', () => {
    const membership = component.memberships[0];

    component.toggleReleaseSelection(
      { id: 'release--1', version: '1.0' },
      membership,
      true
    );
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const viewTrackButton =
      element.querySelector<HTMLButtonElement>('.view-track-button');
    const clearButton = element.querySelector<HTMLButtonElement>(
      '.membership-action-button'
    );

    expect(viewTrackButton?.disabled).toBe(false);

    clearButton?.click();
    fixture.detectChanges();

    expect(component.selectedReleaseCount).toBe(0);
    expect(viewTrackButton?.disabled).toBe(true);
  });

  it('should show an empty state when the object has no memberships', () => {
    component.memberships = [];
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'This object is not in any release tracks yet.'
    );
    expect(fixture.nativeElement.textContent).toContain('Add to Release Track');
  });

  it('should add the object to the selected standard release track', () => {
    component.memberships = [];
    releaseTracksConnector.listReleaseTracks.mockReturnValue(
      of({
        data: [
          {
            id: 'release-track--available',
            name: 'Available Track',
            type: 'standard',
          },
        ],
      })
    );
    releaseTracksConnector.addCandidates.mockReturnValue(of({}));
    dialog.open.mockReturnValue({
      afterClosed: () => of('release-track--available'),
    });
    const reload = vi.spyOn(component, 'loadMembershipData');

    component.addToReleaseTrack();

    expect(releaseTracksConnector.addCandidates).toHaveBeenCalledWith(
      'release-track--available',
      ['attack-pattern--063b5b92-5361-481a-9c3f-95492ed9a2d8']
    );
    expect(reload).toHaveBeenCalled();
  });
});
