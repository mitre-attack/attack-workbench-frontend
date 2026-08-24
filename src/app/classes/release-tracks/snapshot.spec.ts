import { ReleaseTrackSnapshot } from './snapshot';

describe('ReleaseTrackSnapshot', () => {
  it('should preserve snapshot-local notes separately from track metadata', () => {
    const snapshot = new ReleaseTrackSnapshot({
      description: 'Long-lived track purpose',
      snapshot_description: 'Context for this release',
    });

    expect(snapshot.description).toBe('Long-lived track purpose');
    expect(snapshot.snapshot_description).toBe('Context for this release');
    expect(snapshot.serialize()).toEqual(
      expect.objectContaining({
        description: 'Long-lived track purpose',
        snapshot_description: 'Context for this release',
      })
    );
  });

  it('should preserve candidate and staged display fields', () => {
    const snapshot = new ReleaseTrackSnapshot({
      candidates: [
        {
          object_ref: 'attack-pattern--candidate',
          object_modified: '2026-01-01T00:00:00.000Z',
          object_status: 'work-in-progress',
          attack_id: 'T1234',
          name: 'Candidate Technique',
          description: 'Candidate description',
          modified_by_user: {
            id: 'user-account--candidate',
            username: 'candidateuser',
            name: 'Candidate Reviewer',
          },
        },
      ],
      staged: [
        {
          object_ref: 'attack-pattern--staged',
          object_modified: '2026-01-02T00:00:00.000Z',
          object_status: 'reviewed',
          attack_id: 'T5678',
          name: 'Staged Technique',
          description: 'Staged description',
          modified_by_user: {
            id: 'user-account--staged',
            username: 'stageduser',
            name: 'Staged Reviewer',
          },
        },
      ],
      members: [
        {
          object_ref: 'attack-pattern--member',
          object_modified: '2026-01-03T00:00:00.000Z',
          attack_id: 'T9999',
          name: 'Member Technique',
        },
      ],
    });

    expect(snapshot.candidates?.[0]).toEqual(
      expect.objectContaining({
        attack_id: 'T1234',
        name: 'Candidate Technique',
        description: 'Candidate description',
        modified_by_user: expect.objectContaining({
          name: 'Candidate Reviewer',
        }),
      })
    );
    expect(snapshot.staged?.[0]).toEqual(
      expect.objectContaining({
        attack_id: 'T5678',
        name: 'Staged Technique',
        description: 'Staged description',
        modified_by_user: expect.objectContaining({
          name: 'Staged Reviewer',
        }),
      })
    );
  });

  it('should preserve latest selectors for candidate and staged revisions', () => {
    const snapshot = new ReleaseTrackSnapshot({
      candidates: [
        {
          object_ref: 'attack-pattern--candidate',
          object_modified: 'latest',
          object_status: 'work-in-progress',
        },
      ],
      staged: [
        {
          object_ref: 'attack-pattern--staged',
          object_modified: 'latest',
          object_status: 'reviewed',
        },
      ],
    });

    expect(snapshot.candidates?.[0].object_modified).toBe('latest');
    expect(snapshot.staged?.[0].object_modified).toBe('latest');
    expect(snapshot.serialize()).toEqual(
      expect.objectContaining({
        candidates: [
          expect.objectContaining({
            object_modified: 'latest',
          }),
        ],
        staged: [
          expect.objectContaining({
            object_modified: 'latest',
          }),
        ],
      })
    );
  });

  it('should deserialize and serialize exact workflow revision timestamps', () => {
    const modified = '2026-01-04T00:00:00.000Z';
    const snapshot = new ReleaseTrackSnapshot({
      candidates: [
        {
          object_ref: 'attack-pattern--candidate',
          object_modified: modified,
          object_status: 'work-in-progress',
        },
      ],
      staged: [
        {
          object_ref: 'attack-pattern--staged',
          object_modified: modified,
          object_status: 'reviewed',
        },
      ],
    });

    expect(snapshot.candidates?.[0].object_modified).toEqual(
      new Date(modified)
    );
    expect(snapshot.staged?.[0].object_modified).toEqual(new Date(modified));
    expect(snapshot.serialize().candidates[0].object_modified).toBe(modified);
    expect(snapshot.serialize().staged[0].object_modified).toBe(modified);
  });
});
