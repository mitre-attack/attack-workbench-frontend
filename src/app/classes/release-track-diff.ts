import { Collection } from './stix/collection';

export interface ReleaseTrackDiffOption {
  id: string;
  label: string;
  kind: 'staged' | 'member' | 'attack-release';
  baseline: {
    object_ref: string;
    object_modified: Date | string;
  };
}

const ATTACK_COLLECTION_NAMES = new Set([
  'Enterprise ATT&CK',
  'Mobile ATT&CK',
  'ICS ATT&CK',
]);

/**
 * Build comparison choices from imported Enterprise, Mobile, and ICS
 * ATT&CK collections. Keep exact object-version references, order releases by
 * newest collection modification first, and skip duplicate release choices.
 *
 * @param collections The collection versions loaded from the API.
 * @param objectRefs The object IDs to include in the comparison lookup.
 * @returns A map from object ID to its available ATT&CK release comparisons.
 */
export function indexAttackReleaseDiffs(
  collections: Collection[],
  objectRefs: Set<string>
): Map<string, ReleaseTrackDiffOption[]> {
  const index = new Map<string, ReleaseTrackDiffOption[]>();
  const releases = collections
    .filter(
      collection =>
        collection.imported &&
        ATTACK_COLLECTION_NAMES.has(collection.name) &&
        collection.version &&
        Number.isFinite(new Date(collection.modified).getTime())
    )
    .sort((a, b) => +new Date(b.modified) - +new Date(a.modified));

  for (const release of releases) {
    const id = `${release.stixID}@${new Date(release.modified).toISOString()}`;
    for (const reference of release.contents) {
      if (
        !objectRefs.has(reference.object_ref) ||
        !reference.object_modified ||
        !Number.isFinite(new Date(reference.object_modified).getTime())
      )
        continue;
      const options = index.get(reference.object_ref) ?? [];
      if (options.some(option => option.id === id)) continue;
      options.push({
        id,
        label: `${release.name} v${release.version}`,
        kind: 'attack-release',
        baseline: {
          object_ref: reference.object_ref,
          object_modified: reference.object_modified,
        },
      });
      index.set(reference.object_ref, options);
    }
  }
  return index;
}
