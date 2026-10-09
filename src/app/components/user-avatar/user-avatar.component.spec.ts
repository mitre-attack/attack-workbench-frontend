import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserAvatarComponent } from './user-avatar.component';

describe('UserAvatarComponent', () => {
  let component: UserAvatarComponent;
  let fixture: ComponentFixture<UserAvatarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserAvatarComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UserAvatarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show first and last initials for a display name with middle names', () => {
    component.name = 'Example Middle User';

    expect(component.initials).toBe('EU');
  });

  it('should show first and last initials for a two-word display name', () => {
    component.name = 'Release Analyst';

    expect(component.initials).toBe('RA');
  });

  it('should show first and last initials for the modified by user display name', () => {
    component.name = 'Review User';

    expect(component.initials).toBe('RU');
  });

  it('should show the first two letters for usernames', () => {
    component.name = 'exampleuser';

    expect(component.initials).toBe('EX');
  });

  it('should show the first two letters for usernames that match display initials', () => {
    component.name = 'releaseuser';

    expect(component.initials).toBe('RE');
  });

  it('should ignore prefixes and suffixes when building display initials', () => {
    component.name = 'Dr. Example Middle User Jr.';

    expect(component.initials).toBe('EU');
  });

  it('should ignore professional suffixes when building display initials', () => {
    component.name = 'Release Analyst, PhD';

    expect(component.initials).toBe('RA');
  });

  it('should build initials from the remaining name when only a prefix is ignored', () => {
    component.name = 'Dr. Example';

    expect(component.initials).toBe('EX');
  });

  it('should assign the same background to the same name', () => {
    component.name = 'Stable User';
    const background = component.background;

    component.name = 'Stable User';

    expect(component.background).toBe(background);
  });
});
