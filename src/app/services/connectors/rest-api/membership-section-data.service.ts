import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';

export interface MembershipTrack {
  id: string;
  name: string;
  description: string;
  type: string;

  apiId?: string;
  track_id?: string;
  tier?: string;
  status?: string;

  current_draft?: any;
  currentDraft?: any;
  draft?: any;

  production_releases?: any[];
  productionReleases?: any[];
  releases?: any[];
  versions?: any[];

  track?: any;
  release_track?: any;

  [key: string]: any;
}

interface MembershipReference {
  id: string;
  tier?: string;
  status?: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root',
})
export class MembershipSectionDataService {
  private get apiUrl(): string {
    return environment.integrations.rest_api.url.replace(/\/+$/, '');
  }

  constructor(
    private readonly http: HttpClient,
    private readonly releaseTracksConnector: ReleaseTracksConnectorService
  ) {}

  public loadMemberships(
    objectRef: string,
    objectInput: any,
    configInput: any
  ): Observable<MembershipTrack[]> {
    const suppliedMemberships = this.extractMemberships(
      objectInput,
      configInput
    );

    const rawObject$ = suppliedMemberships.length
      ? of(objectInput ?? configInput?.object ?? null)
      : this.loadRawObject(objectRef, objectInput ?? configInput?.object);

    return forkJoin({
      rawObject: rawObject$,
      releaseTracksResponse: this.releaseTracksConnector
        .listReleaseTracks({
          limit: 100,
          offset: 0,
        })
        .pipe(
          catchError(error => {
            console.error('Failed to load release tracks', error);
            return of(null);
          })
        ),
      releasesResponse: this.releaseTracksConnector.listReleasesForObject(
        objectRef,
        { order: 'desc', limit: 100, offset: 0 }
      ),
      objectVersionsResponse: this.loadAllObjectVersions(
        objectRef,
        objectInput
      ),
    }).pipe(
      map(
        ({
          rawObject,
          releaseTracksResponse,
          releasesResponse,
          objectVersionsResponse,
        }) => {
          const memberships = suppliedMemberships.length
            ? suppliedMemberships
            : this.extractMemberships(rawObject, {
                object: rawObject,
              });

          const availableTracks = this.normalizeReleaseTrackList(
            releaseTracksResponse
          );

          return this.applyStatusChangeDates(
            this.applyTaggedReleases(
              this.buildTracks(availableTracks, memberships, objectRef),
              releasesResponse
            ),
            objectVersionsResponse
          );
        }
      ),
      switchMap(tracks =>
        this.loadVersionsForMembershipTracks(tracks, objectRef)
      )
    );
  }

  private loadRawObject(objectRef: string, objectInput: any): Observable<any> {
    const objectType =
      objectInput?.type ??
      objectInput?.stix?.type ??
      objectInput?.attackType ??
      this.getTypeFromStixId(objectRef);

    const resource = this.getResourceName(objectType);

    if (!resource) {
      console.warn(`Unable to determine REST resource for object ${objectRef}`);
      return of(objectInput ?? null);
    }

    const url = `${this.apiUrl}/${resource}/${encodeURIComponent(objectRef)}`;

    return this.http.get<any>(url).pipe(
      map(response => {
        if (Array.isArray(response)) {
          return response[0] ?? objectInput ?? null;
        }

        return response ?? objectInput ?? null;
      }),
      catchError(error => {
        console.error(`Failed to load raw object ${objectRef}`, error);
        return of(objectInput ?? null);
      })
    );
  }

  private loadAllObjectVersions(
    objectRef: string,
    objectInput: any
  ): Observable<any> {
    const objectType =
      objectInput?.type ??
      objectInput?.stix?.type ??
      objectInput?.attackType ??
      this.getTypeFromStixId(objectRef);
    const resource = this.getResourceName(objectType);

    if (!resource) {
      return of([]);
    }

    const url = `${this.apiUrl}/${resource}/${encodeURIComponent(objectRef)}`;

    return this.http.get<any>(url, { params: { versions: 'all' } }).pipe(
      catchError(error => {
        console.error(`Failed to load versions for object ${objectRef}`, error);
        return of([]);
      })
    );
  }

  private extractMemberships(
    objectInput: any,
    configInput: any
  ): MembershipReference[] {
    const releaseTracks =
      objectInput?.workspace?.release_tracks ??
      objectInput?.workspace?.releaseTracks ??
      objectInput?.release_tracks ??
      objectInput?.releaseTracks ??
      configInput?.object?.workspace?.release_tracks ??
      configInput?.object?.workspace?.releaseTracks ??
      configInput?.workspace?.release_tracks ??
      configInput?.workspace?.releaseTracks ??
      [];

    return Array.isArray(releaseTracks)
      ? releaseTracks.filter(membership => !!membership?.id)
      : [];
  }

  private normalizeReleaseTrackList(response: any): MembershipTrack[] {
    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response;
    }

    const tracks =
      response.data ??
      response.items ??
      response.results ??
      response.release_tracks ??
      response.releaseTracks ??
      response.tracks ??
      [];

    return Array.isArray(tracks) ? tracks : [];
  }

  private buildTracks(
    availableTracks: MembershipTrack[],
    memberships: MembershipReference[],
    objectRef: string
  ): MembershipTrack[] {
    const memberTracks = memberships.map(membership => {
      const metadata = availableTracks.find(
        track => this.getTrackApiId(track) === membership.id
      );

      const track: MembershipTrack = {
        ...(metadata ?? {}),
        ...membership,

        id: metadata?.track_id ?? metadata?.id ?? membership.id,

        apiId: membership.id,

        name:
          metadata?.name ??
          metadata?.title ??
          this.formatIdentifier(membership.id) ??
          'Release Track',

        description:
          metadata?.description?.trim() ||
          'Release track containing this ATT&CK object.',

        type: metadata?.type ?? metadata?.track_type ?? 'STANDARD',

        tier: membership.tier,
        status: membership.status,

        current_draft: this.createCurrentDraft(membership, metadata, objectRef),

        production_releases: [],
        releases: [],
        versions: [],
      };

      return track;
    });

    return memberTracks;
  }

  private loadVersionsForMembershipTracks(
    tracks: MembershipTrack[],
    objectRef: string
  ): Observable<MembershipTrack[]> {
    const requests = tracks.map(track => {
      if (!track.apiId) {
        return of(track);
      }

      return forkJoin({
        versionsResponse: this.releaseTracksConnector.listObjectVersions(
          track.apiId,
          objectRef
        ),
        snapshot: this.releaseTracksConnector.getLatestSnapshot(track.apiId),
      }).pipe(
        map(({ versionsResponse, snapshot }) =>
          this.applySnapshotStatusDate(
            this.applyVersionResponse(track, versionsResponse),
            snapshot,
            objectRef
          )
        ),
        catchError(error => {
          console.error(
            `Failed to load versions for track ${track.apiId}`,
            error
          );
          return of(track);
        })
      );
    });

    return requests.length ? forkJoin(requests) : of(tracks);
  }

  private applyVersionResponse(
    track: MembershipTrack,
    response: any
  ): MembershipTrack {
    const versions = this.normalizeVersionList(response);

    const responseDraft =
      response?.current_draft ??
      response?.currentDraft ??
      response?.draft ??
      null;

    const directReleases =
      response?.production_releases ??
      response?.productionReleases ??
      response?.releases ??
      null;

    const detectedDraft = versions.find(version =>
      this.isDraftVersion(version)
    );
    const currentDraft = responseDraft
      ? { ...(track.current_draft ?? {}), ...responseDraft }
      : versions.length
        ? detectedDraft
          ? { ...(track.current_draft ?? {}), ...detectedDraft }
          : null
        : (track.current_draft ?? null);

    const versionReleases = versions.filter(version =>
      this.isProductionVersion(version)
    );

    const productionReleases = Array.isArray(directReleases)
      ? directReleases
      : versionReleases.length
        ? versionReleases
        : (track.production_releases ?? []);

    return {
      ...track,
      current_draft: currentDraft,
      production_releases: productionReleases,
      releases: productionReleases,
      versions,
    };
  }

  private applySnapshotStatusDate(
    track: MembershipTrack,
    snapshot: any,
    objectRef: string
  ): MembershipTrack {
    if (!track.current_draft || track.current_draft.updated_at || !snapshot) {
      return track;
    }

    const stagedEntry = snapshot.staged?.find(
      (entry: any) => entry?.object_ref === objectRef
    );
    const candidateEntry = snapshot.candidates?.find(
      (entry: any) => entry?.object_ref === objectRef
    );
    const date = stagedEntry
      ? (stagedEntry.object_staged_at ?? snapshot.modified)
      : candidateEntry
        ? ((candidateEntry.object_status === 'work-in-progress'
            ? candidateEntry.object_added_at
            : snapshot.modified) ?? candidateEntry.object_added_at)
        : null;

    return date
      ? {
          ...track,
          current_draft: {
            ...track.current_draft,
            updated_at: date,
          },
        }
      : track;
  }

  private applyTaggedReleases(
    tracks: MembershipTrack[],
    response: any
  ): MembershipTrack[] {
    const releases = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
        ? response.data
        : [];

    return tracks.map(track => {
      const trackId = this.getTrackApiId(track);
      const trackReleases = releases.filter(
        (release: any) =>
          String(release?.track_id ?? release?.trackId ?? '') === trackId
      );

      return {
        ...track,
        production_releases: trackReleases,
        releases: trackReleases,
      };
    });
  }

  private applyStatusChangeDates(
    tracks: MembershipTrack[],
    response: any
  ): MembershipTrack[] {
    const revisions = this.normalizeObjectRevisionList(response).sort(
      (first, second) =>
        this.getObjectRevisionTimestamp(first) -
        this.getObjectRevisionTimestamp(second)
    );

    return tracks.map(track => {
      if (!track.current_draft) {
        return track;
      }

      const trackId = this.getTrackApiId(track);
      let previousStatus: string | null = null;
      let changedAt: unknown = null;

      revisions.forEach(revision => {
        const membership = this.extractMemberships(revision, {
          object: revision,
        }).find(item => item.id === trackId);
        const status = membership
          ? this.normalizeStatus(membership.status ?? membership.tier)
          : '';

        if (!status) {
          return;
        }

        if (previousStatus === null) {
          previousStatus = status;
          return;
        }

        if (status !== previousStatus) {
          previousStatus = status;
          changedAt = this.getObjectRevisionDate(revision);
        }
      });

      return changedAt
        ? {
            ...track,
            current_draft: {
              ...track.current_draft,
              updated_at: changedAt,
            },
          }
        : track;
    });
  }

  private normalizeObjectRevisionList(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    const revisions =
      response?.data ?? response?.items ?? response?.results ?? response ?? [];

    return Array.isArray(revisions) ? revisions : [];
  }

  private getObjectRevisionTimestamp(revision: any): number {
    const value = this.getObjectRevisionDate(revision);
    const timestamp = value ? new Date(value).getTime() : 0;

    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private getObjectRevisionDate(revision: any): string | number | Date | null {
    return (revision?.stix?.modified ??
      revision?.modified ??
      revision?.updated_at ??
      revision?.updatedAt ??
      null) as string | number | Date | null;
  }

  private normalizeVersionList(response: any): any[] {
    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response;
    }

    const versions =
      response.data ??
      response.items ??
      response.results ??
      response.versions ??
      response.object_versions ??
      response.objectVersions ??
      response.snapshots ??
      [];

    return Array.isArray(versions) ? versions : [];
  }

  private createCurrentDraft(
    membership: MembershipReference,
    metadata: MembershipTrack | undefined,
    objectRef: string
  ): any {
    const existingDraft =
      metadata?.current_draft ?? metadata?.currentDraft ?? metadata?.draft;

    if (existingDraft) {
      return {
        ...existingDraft,
        status: membership.status ?? existingDraft.status,
        tier: membership.tier ?? existingDraft.tier,
        in_current_draft: true,
      };
    }

    const tier = this.normalizeStatus(membership.tier);
    const status = this.normalizeStatus(membership.status);

    const draftStatuses = [
      'candidate',
      'candidates',
      'draft',
      'work-in-progress',
      'wip',
      'awaiting-review',
      'review',
      'reviewed',
      'staged',
    ];

    if (!draftStatuses.includes(tier) && !draftStatuses.includes(status)) {
      return null;
    }

    return {
      id: `${membership.id}:${objectRef}`,
      status: membership.status ?? membership.tier ?? 'work-in-progress',
      tier: membership.tier ?? membership.status,
      in_current_draft: true,
    };
  }

  private isDraftVersion(version: any): boolean {
    if (version?.is_draft === true || version?.isDraft === true) {
      return true;
    }

    const status = this.normalizeStatus(
      version?.status ??
        version?.state ??
        version?.tier ??
        version?.snapshot_status
    );

    return [
      'candidate',
      'candidates',
      'draft',
      'work-in-progress',
      'wip',
      'awaiting-review',
      'review',
      'reviewed',
      'staged',
    ].includes(status);
  }

  private isProductionVersion(version: any): boolean {
    if (
      version?.is_release === true ||
      version?.isRelease === true ||
      version?.released === true ||
      version?.tagged === true
    ) {
      return true;
    }

    if (
      version?.released_at ||
      version?.releasedAt ||
      version?.release_date ||
      version?.releaseDate ||
      version?.tag
    ) {
      return true;
    }

    const status = this.normalizeStatus(
      version?.status ??
        version?.state ??
        version?.tier ??
        version?.snapshot_status
    );

    if (
      ['production', 'release', 'released', 'published', 'tagged'].includes(
        status
      )
    ) {
      return true;
    }

    return (
      !this.isDraftVersion(version) &&
      !!this.normalizeVersionValue(version?.version)
    );
  }

  private getTrackApiId(track: MembershipTrack): string | null {
    const id =
      track.track_id ??
      track.apiId ??
      track.track?.id ??
      track.release_track?.id ??
      track.id;

    return id ? String(id) : null;
  }

  private getResourceName(type: unknown): string | null {
    const normalized = String(type ?? '')
      .trim()
      .toLowerCase();

    const resourceMap: Record<string, string> = {
      'attack-pattern': 'techniques',
      'technique': 'techniques',

      'x-mitre-tactic': 'tactics',
      'tactic': 'tactics',

      'intrusion-set': 'groups',
      'group': 'groups',

      'campaign': 'campaigns',

      'x-mitre-asset': 'assets',
      'asset': 'assets',

      'malware': 'software',
      'tool': 'software',
      'software': 'software',

      'course-of-action': 'mitigations',
      'mitigation': 'mitigations',

      'x-mitre-data-source': 'data-sources',
      'data-source': 'data-sources',

      'x-mitre-data-component': 'data-components',
      'data-component': 'data-components',

      'x-mitre-detection-strategy': 'detection-strategies',
      'detection-strategy': 'detection-strategies',

      'x-mitre-analytic': 'analytics',
      'analytic': 'analytics',

      'x-mitre-matrix': 'matrices',
      'matrix': 'matrices',

      'relationship': 'relationships',
      'note': 'notes',

      'x-mitre-collection': 'collections',
      'collection': 'collections',

      'identity': 'identities',
      'marking-definition': 'marking-definitions',
    };

    return resourceMap[normalized] ?? null;
  }

  private getTypeFromStixId(objectRef: string): string {
    return objectRef.split('--')[0] ?? '';
  }

  private normalizeStatus(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');
  }

  private normalizeVersionValue(version: any): string | null {
    if (version === null || version === undefined) {
      return null;
    }

    if (Array.isArray(version)) {
      return version.join('.');
    }

    if (typeof version === 'object') {
      const nested = version._version ?? version.version ?? version.value;

      if (Array.isArray(nested)) {
        return nested.join('.');
      }

      return nested === null || nested === undefined ? null : String(nested);
    }

    return String(version);
  }

  private formatIdentifier(identifier: unknown): string | null {
    if (!identifier) {
      return null;
    }

    const value = String(identifier);
    const identifierName = value.includes('--') ? value.split('--')[0] : value;

    return identifierName
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, character => character.toUpperCase());
  }
}
