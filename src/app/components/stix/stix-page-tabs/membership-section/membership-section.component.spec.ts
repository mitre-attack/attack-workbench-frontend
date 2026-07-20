import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';

import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { MembershipSectionComponent } from './membership-section.component';
import {
  MembershipSectionDataService,
  MembershipTrack,
} from 'src/app/services/connectors/rest-api/membership-section-data.service';

describe('MembershipSectionComponent', () => {
  let component: MembershipSectionComponent;
  let fixture: ComponentFixture<MembershipSectionComponent>;
  let membershipDataService: any;
  let authenticationService: any;
  let router: any;

  const defaultTracks: MembershipTrack[] = [
    {
      id: 'core-objects',
      name: 'Core Objects',
      description: 'Core objects',
      type: 'STANDARD',
      current_draft: null,
      production_releases: [],
      releases: [],
      versions: [],
    },
    {
      id: 'enterprise-attack',
      name: 'Enterprise ATT&CK',
      description: 'Enterprise ATT&CK',
      type: 'VIRTUAL',
      current_draft: null,
      production_releases: [],
      releases: [],
      versions: [],
    },
  ];

  beforeEach(async () => {
    membershipDataService = jasmine.createSpyObj(
      'MembershipSectionDataService',
      ['getDefaultTracks', 'loadMemberships']
    );

    membershipDataService.getDefaultTracks.and.callFake(() =>
      defaultTracks.map(track => ({ ...track }))
    );

    membershipDataService.loadMemberships.and.returnValue(
      of(defaultTracks.map(track => ({ ...track })))
    );

    authenticationService = jasmine.createSpyObj('AuthenticationService', [
      'isAuthorized',
    ]);
    authenticationService.isAuthorized.and.returnValue(true);

    router = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [MembershipSectionComponent],
      providers: [
        {
          provide: MembershipSectionDataService,
          useValue: membershipDataService,
        },
        {
          provide: AuthenticationService,
          useValue: authenticationService,
        },
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

  it('should display the two type-based tracks', () => {
    expect(component.memberships.length).toBe(2);
    expect(component.memberships[0].name).toBe('Core Objects');
    expect(component.memberships[0].type).toBe('STANDARD');
    expect(component.memberships[1].name).toBe('Enterprise ATT&CK');
    expect(component.memberships[1].type).toBe('VIRTUAL');
  });

  it('should mark Enterprise ATT&CK as virtual', () => {
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

  it('should render Clear and Compare buttons', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Clear');
    expect(element.textContent).toContain('Compare (0/2)');
  });

  it('should navigate authorized users to the release track dashboard', () => {
    const track = component.memberships[0];

    component.viewTrack(track);

    expect(router.navigate).toHaveBeenCalledWith([
      '/dashboard/release-management',
      track.id,
    ]);
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
});
