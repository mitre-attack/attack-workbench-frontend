import { ReleaseTrackObjectCardComponent } from './release-track-object-card.component';

describe('ReleaseTrackObjectCardComponent', () => {
  let component: ReleaseTrackObjectCardComponent;

  beforeEach(() => {
    component = new ReleaseTrackObjectCardComponent();
  });

  it('should show tier entry display fields when available', () => {
    component.item = {
      object_ref: 'attack-pattern--12345678-1234-1234-1234-123456789abc',
      object_modified: '2026-01-01T00:00:00.000Z',
      attack_id: 'T1234',
      name: 'Technique Name',
      description: 'Technique description\n\nAdditional details.',
      modified_by_user: {
        id: 'user-account--1234',
        username: 'reviewer1',
        displayName: 'Review User',
        name: 'Review User',
      },
    };

    expect(component.title).toBe('Technique Name');
    expect(component.subtitle).toBe('T1234');
    expect(component.description).toBe('Technique description');
    expect(component.modifiedByName).toBe('Review User');
  });

  it('should use username when modified by user has no display name', () => {
    component.item = {
      object_ref: 'attack-pattern--12345678-1234-1234-1234-123456789abc',
      modified_by_user: {
        username: 'reviewer1',
      },
    };

    expect(component.modifiedByName).toBe('reviewer1');
  });

  it('should preserve markdown syntax in descriptions for rendering', () => {
    component.item = {
      object_ref: 'attack-pattern--12345678-1234-1234-1234-123456789abc',
      description: '**Markdown** [description](https://example.com)',
    };

    expect(component.description).toBe(
      '**Markdown** [description](https://example.com)'
    );
  });

  it('should prefer display name over username and name', () => {
    component.item = {
      object_ref: 'attack-pattern--12345678-1234-1234-1234-123456789abc',
      modified_by_user: {
        username: 'releaseuser',
        displayName: 'Release Reviewer',
        name: 'Fallback Name',
      },
    };

    expect(component.modifiedByName).toBe('Release Reviewer');
  });

  it('should prefer modified by user info over staged identity ids', () => {
    component.item = {
      object_ref: 'attack-pattern--990e4d99-5c6f-4f34-b6f0-7221c55f39cb',
      object_modified: '2026-04-22T17:57:26.218Z',
      object_status: 'reviewed',
      object_staged_at: '2026-06-24T19:50:19.859Z',
      object_staged_by: 'identity--00000000-0000-4000-8000-000000000001',
      attack_id: 'T1640.001',
      name: '0 New Sub',
      modified_by_user: {
        id: 'identity--00000000-0000-4000-8000-000000000001',
        username: 'releaseuser',
        displayName: 'Release Reviewer',
        name: 'Release Reviewer',
      },
    };

    expect(component.modifiedByName).toBe('Release Reviewer');
  });
});
