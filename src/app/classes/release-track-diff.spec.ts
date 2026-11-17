import { indexAttackReleaseDiffs } from './release-track-diff';
import { Collection } from './stix/collection';

describe('imported ATT&CK release comparisons', () => {
  const objectRef = 'attack-pattern--example';
  function release(
    version: string,
    modified: string,
    options: any = {}
  ): Collection {
    return new Collection({
      stix: {
        type: 'x-mitre-collection',
        id: 'x-mitre-collection--enterprise',
        name: 'Enterprise ATT&CK',
        created: '2020-01-01T00:00:00.000Z',
        modified,
        created_by_ref: 'identity--custom',
        x_mitre_version: version,
        x_mitre_contents: [
          {
            object_ref: objectRef,
            object_modified: '2024-01-01T00:00:00.000Z',
          },
        ],
        ...options,
      },
      workspace: { imported: '2026-01-01T00:00:00.000Z' },
    });
  }

  it('lists every release containing the object newest first, including unchanged versions', () => {
    const older = release('17.0', '2025-04-01T00:00:00.000Z');
    const newer = release('18.0', '2025-10-01T00:00:00.000Z');
    const index = indexAttackReleaseDiffs(
      [older, newer, newer],
      new Set([objectRef])
    );
    expect(index.get(objectRef)?.map(option => option.label)).toEqual([
      'Enterprise ATT&CK v18.0',
      'Enterprise ATT&CK v17.0',
    ]);
    expect(index.get(objectRef)?.[0].baseline).toEqual({
      object_ref: objectRef,
      object_modified: new Date('2024-01-01T00:00:00.000Z'),
    });
  });

  it('excludes other collection names and unimported releases', () => {
    const local = release('18.0', '2025-10-01T00:00:00.000Z');
    local.imported = null;
    const index = indexAttackReleaseDiffs(
      [
        local,
        release('1.0', '2025-10-01T00:00:00.000Z', {
          name: 'My release track',
        }),
      ],
      new Set([objectRef])
    );
    expect(index.size).toBe(0);
  });

  it('supports all three ATT&CK domains and excludes objects outside the board', () => {
    const collections = [
      'Enterprise ATT&CK',
      'Mobile ATT&CK',
      'ICS ATT&CK',
    ].map(name =>
      release('18.0', '2025-10-01T00:00:00.000Z', {
        name,
        id: `x-mitre-collection--${name}`,
      })
    );
    expect(
      indexAttackReleaseDiffs(collections, new Set([objectRef])).get(objectRef)
    ).toHaveLength(3);
    expect(indexAttackReleaseDiffs(collections, new Set()).size).toBe(0);
  });

  it('never offers an invalid revision that could fall back to latest', () => {
    const collection = release('18.0', '2025-10-01T00:00:00.000Z');
    collection.contents[0].object_modified = new Date('invalid');
    expect(
      indexAttackReleaseDiffs([collection], new Set([objectRef])).size
    ).toBe(0);
  });
});
