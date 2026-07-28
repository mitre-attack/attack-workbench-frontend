import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { catchError, share, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { logger } from '../../../utils/logger';
import { ApiConnector } from '../api-connector';
import {
  ExportFormat,
  ReleaseTrackSnapshot,
} from 'src/app/classes/release-tracks';
import type {
  BumpPayload,
  ClonePayload,
  Composition,
  CreateReleaseTrackPayload,
  ExportFormatType,
  ReleaseTrackConfig,
  ReleaseTrackSnapshotHistoryItem,
  ReleaseTrackSnapshotOptions,
  ReviewPayload,
  StixBundlePayload,
  StixObjectRef,
  UpdateContentsPayload,
  UpdateMetadataPayload,
} from 'src/app/classes/release-tracks';
import { Paginated } from './rest-api-connector.service';

export type {
  BumpPayload,
  ClonePayload,
  Composition,
  CreateReleaseTrackPayload,
  ReleaseTrackSnapshotHistoryItem,
  ReleaseTrackSnapshotOptions,
  ReviewPayload,
  StixBundlePayload,
  StixObjectRef,
  UpdateContentsPayload,
  UpdateMetadataPayload,
} from 'src/app/classes/release-tracks';

// -----------------------------------------------------------------------------
// Release Tracks API Connector Service
// -----------------------------------------------------------------------------

@Injectable({
  providedIn: 'root',
})
export class ReleaseTracksConnectorService extends ApiConnector {
  private get apiUrl(): string {
    return environment.integrations.rest_api.url;
  }

  constructor(
    private http: HttpClient,
    snackbar: MatSnackBar
  ) {
    super(snackbar);
  }

  private buildHttpParams(options?: Record<string, any>): HttpParams {
    let params = new HttpParams();
    if (options) {
      Object.keys(options).forEach(k => {
        const v = options[k];
        if (v !== undefined && v !== null) params = params.set(k, String(v));
      });
    }
    return params;
  }

  private normalizeSnapshotHistory(
    result: any
  ): ReleaseTrackSnapshotHistoryItem[] {
    if (!result) return [];
    if (Array.isArray(result)) return result;

    const snapshots =
      result.snapshots ||
      result.data ||
      result.versions ||
      result.release_track_snapshots ||
      result.history ||
      [];

    if (Array.isArray(snapshots) && snapshots.length) return snapshots;

    const historyItems = Array.isArray(result.version_history)
      ? result.version_history.map((entry: any) => ({
          ...entry,
          modified: entry.snapshot_id,
        }))
      : [];

    if (!result.version) {
      return [result, ...historyItems];
    }

    return historyItems.length ? historyItems : [result];
  }

  // -----------------------------------------------------------------------------
  // Ephemeral
  // -----------------------------------------------------------------------------

  /**
   * GET /api/release-tracks/ephemeral/:domain
   * Retrieve an ephemeral STIX bundle for the given domain.
   * @param domain Path parameter selecting ATT&CK domain ('enterprise'|'ics'|'mobile')
   * @param format Optional query parameter controlling output format ('bundle'|'filesystemstore'|'workbench')
   * @returns Observable<any> Server response
   */
  public getEphemeralBundle(
    domain: string,
    format = 'bundle'
  ): Observable<any> {
    let params = new HttpParams();
    if (format) params = params.set('format', format);
    const url = `${this.apiUrl}/release-tracks/ephemeral/${domain}`;
    return this.http.get(url, { params }).pipe(
      tap(result => logger.log(`retrieved ephemeral ${domain} bundle`, result)),
      catchError(this.handleError_continue<any>(null)),
      share()
    );
  }

  // -----------------------------------------------------------------------------
  // Track management
  // -----------------------------------------------------------------------------

  /**
   * GET /api/release-tracks
   * List release tracks.
   * @param options Query options: type, releases, limit, offset, search
   * @returns Observable<any> paginated list
   */
  public listReleaseTracks(options?: {
    type?: string;
    releases?: 'only';
    limit?: number;
    offset?: number;
    search?: string;
  }): Observable<Paginated<any>> {
    const params = this.buildHttpParams(options);
    const url = `${this.apiUrl}/release-tracks`;
    return this.http.get(url, { params }).pipe(
      tap(() => logger.log('retrieved release tracks list')),
      catchError(this.handleError_continue<any>(null)),
      share()
    );
  }

  /**
   * POST /api/release-tracks/new
   * Create a new release track.
   * @param body Request payload
   * @returns Observable<any> created track
   */
  public createReleaseTrack(body: CreateReleaseTrackPayload): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/new`;
    return this.http.post(url, body).pipe(
      tap(result => logger.log('created release track', result)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * POST /api/release-tracks/new-from-bundle
   * Bootstrap a release track from a STIX bundle.
   * @param body STIX bundle
   * @returns Observable<any> creation result
   */
  public createReleaseTrackFromBundle(
    body: StixBundlePayload
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/new-from-bundle`;
    return this.http.post(url, body).pipe(
      tap(result => logger.log('created release track from bundle', result)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * POST /api/release-tracks/import
   * Import a release track (server may return 501 Not Implemented).
   * @param body Import payload (TBD)
   * @returns Observable<any> server response
   */
  public importReleaseTrack(body: any): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/import`;
    return this.http.post(url, body).pipe(
      tap(result => logger.log('imported release track', result)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * GET /api/release-tracks/:id/snapshots/latest
   * Get latest snapshot for a track.
   * @param id Release track id
   * @param options Query options forwarded to endpoint
   * @returns Observable<any> snapshot or list
   */
  public getLatestSnapshot(
    id: string,
    options?: ReleaseTrackSnapshotOptions
  ): Observable<ReleaseTrackSnapshot | null> {
    const params = this.buildHttpParams(options);
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots/latest`;
    return this.http.get(url, { params }).pipe(
      tap(result =>
        logger.log(`retrieved latest snapshot for track ${id}`, result)
      ),
      map(result => (result ? new ReleaseTrackSnapshot(result) : null)),
      catchError(this.handleError_continue<ReleaseTrackSnapshot | null>(null)),
      share()
    );
  }

  /**
   * GET /api/release-tracks/:id/snapshots
   * List snapshot history summaries.
   * @param id Release track id
   * @returns Observable<ReleaseTrackSnapshotHistoryItem[]>
   */
  public listSnapshots(
    id: string
  ): Observable<ReleaseTrackSnapshotHistoryItem[]> {
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots`;
    return this.http.get(url).pipe(
      tap(result => logger.log(`retrieved snapshots for track ${id}`, result)),
      map(result => this.normalizeSnapshotHistory(result)),
      catchError(
        this.handleError_continue<ReleaseTrackSnapshotHistoryItem[]>([])
      ),
      share()
    );
  }

  /**
   * GET /api/release-tracks/:id/snapshots/latest?format=:format
   * Retrieve the latest snapshot in an export format without deserializing it.
   * @param id Release track id
   * @param format Export format
   * @param options Additional query options
   * @returns Observable<any> formatted export payload
   */
  public exportLatestSnapshot(
    id: string,
    format: ExportFormatType,
    options?: Omit<ReleaseTrackSnapshotOptions, 'format'>
  ): Observable<any> {
    const params = this.buildHttpParams({ ...options, format });
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots/latest`;
    return this.http.get(url, { params }).pipe(
      tap(result =>
        logger.log(
          `retrieved latest snapshot export for track ${id} in ${format} format`,
          result
        )
      ),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * GET /api/release-tracks/:id/snapshots/:modified?format=:format
   * Retrieve a specific snapshot in an export format without deserializing it.
   * @param id Release track id
   * @param modified ISO timestamp identifying the snapshot
   * @param format Export format
   * @param options Additional query options
   * @returns Observable<any> formatted export payload
   */
  public exportSnapshotByModified(
    id: string,
    modified: string,
    format: ExportFormatType,
    options?: Omit<ReleaseTrackSnapshotOptions, 'format'>
  ): Observable<any> {
    const params = this.buildHttpParams({ ...options, format });
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots/${modified}`;
    return this.http.get(url, { params }).pipe(
      tap(result =>
        logger.log(
          `retrieved snapshot ${modified} export for track ${id} in ${format} format`,
          result
        )
      ),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/meta
   * Update metadata for latest snapshot (creates new snapshot).
   * @param id Release track id
   * @param body Metadata payload
   * @param userAccountId Optional user account id appended to payload
   * @returns Observable<any>
   */
  public updateMetadataByLatest(
    id: string,
    body: UpdateMetadataPayload,
    userAccountId?: string
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/meta`;
    const payload = userAccountId ? { ...body, userAccountId } : body;
    return this.http.post(url, payload).pipe(
      tap(result => logger.log(`updated metadata for track ${id}`, result)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/contents
   * Update member contents for latest snapshot.
   * @param id Release track id
   * @param body Contents payload
   * @param userAccountId Optional user
   * @returns Observable<any>
   */
  public updateContentsByLatest(
    id: string,
    body: UpdateContentsPayload,
    userAccountId?: string
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/contents`;
    const payload = userAccountId ? { ...body, userAccountId } : body;
    return this.http.post(url, payload).pipe(
      tap(result => logger.log(`updated contents for track ${id}`, result)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * GET /api/release-tracks/:id/snapshots/latest/release/preview
   * GET /api/release-tracks/:id/snapshots/:modified/release/preview
   * Preview a release for a track snapshot.
   * @param id Release track id
   * @param format Optional output format
   * @param modified Optional snapshot modified timestamp
   * @returns Observable<any> preview payload
   */
  public previewBump(
    id: string,
    format: ExportFormatType = ExportFormat.Workbench,
    modified?: string
  ): Observable<any> {
    const params = this.buildHttpParams({ format });
    const snapshotPath = modified
      ? `snapshots/${modified}`
      : 'snapshots/latest';
    const url = `${this.apiUrl}/release-tracks/${id}/${snapshotPath}/release/preview`;
    return this.http.get(url, { params }).pipe(
      tap(result =>
        logger.log(`generated bump preview for track ${id}`, result)
      ),
      catchError(this.handleError_continue<any>(null)),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/snapshots/latest/release
   * Bump/tag the latest snapshot.
   * @param id Release track id
   * @param body Bump options (type, version, dry_run)
   * @returns Observable<any>
   */
  public bumpByLatest(id: string, body: BumpPayload): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots/latest/release`;
    return this.http.post(url, body).pipe(
      tap(result => logger.log(`bumped version for track ${id}`, result)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/clone
   * Clone a new release track from the latest snapshot.
   * @param id Source release track id
   * @param body Clone options
   * @returns Observable<any>
   */
  public cloneByLatest(id: string, body?: ClonePayload): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/clone`;
    return this.http.post(url, body || {}).pipe(
      tap(result => logger.log(`cloned track ${id}`, result)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * DELETE /api/release-tracks/:id
   * Delete a release track.
   * @param id Release track id
   * @returns Observable<unknown>
   */
  public deleteReleaseTrack(
    id: string,
    options?: { versions?: 'latest' }
  ): Observable<unknown> {
    const params = this.buildHttpParams(options);
    const url = `${this.apiUrl}/release-tracks/${id}`;
    return this.http.delete(url, { params }).pipe(
      tap(() => logger.log(`deleted track ${id}`)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  // -----------------------------------------------------------------------------
  // Snapshot Operations
  // -----------------------------------------------------------------------------

  /**
   * GET /api/release-tracks/:id/snapshots/:modified
   * Get a specific snapshot by modified timestamp.
   * @param id Release track id
   * @param modified ISO timestamp identifying the snapshot
   * @param options Optional query params
   * @returns Observable<any>
   */
  public retrieveSnapshotByModified(
    id: string,
    modified: string,
    options?: ReleaseTrackSnapshotOptions
  ): Observable<ReleaseTrackSnapshot | null> {
    const params = this.buildHttpParams(options);
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots/${modified}`;
    return this.http.get(url, { params }).pipe(
      tap(result =>
        logger.log(`retrieved snapshot ${modified} for track ${id}`, result)
      ),
      map(result => (result ? new ReleaseTrackSnapshot(result) : null)),
      catchError(this.handleError_continue<ReleaseTrackSnapshot | null>(null)),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/snapshots/:modified/meta
   * Update metadata for a specific snapshot.
   * @param id Release track id
   * @param modified Snapshot modified timestamp
   * @param body Metadata payload
   * @param userAccountId Optional user
   * @returns Observable<any>
   */
  public updateMetadataByModified(
    id: string,
    modified: string,
    body: UpdateMetadataPayload,
    userAccountId?: string
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots/${modified}/meta`;
    const payload = userAccountId ? { ...body, userAccountId } : body;
    return this.http.post(url, payload).pipe(
      tap(result =>
        logger.log(`updated metadata for snapshot ${modified}`, result)
      ),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/snapshots/:modified/contents
   * Update contents for a specific snapshot.
   * @param id Release track id
   * @param modified Snapshot modified timestamp
   * @param body Contents payload
   * @param userAccountId Optional user
   * @returns Observable<any>
   */
  public updateContentsByModified(
    id: string,
    modified: string,
    body: UpdateContentsPayload,
    userAccountId?: string
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots/${modified}/contents`;
    const payload = userAccountId ? { ...body, userAccountId } : body;
    return this.http.post(url, payload).pipe(
      tap(result =>
        logger.log(`updated contents for snapshot ${modified}`, result)
      ),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/snapshots/:modified/release
   * Tag/release a specific snapshot.
   * @param id Release track id
   * @param modified Snapshot modified timestamp
   * @param body Bump options
   * @returns Observable<any>
   */
  public bumpByModified(
    id: string,
    modified: string,
    body: BumpPayload
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots/${modified}/release`;
    return this.http.post(url, body).pipe(
      tap(result =>
        logger.log(`bumped version for snapshot ${modified}`, result)
      ),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/snapshots/:modified/clone
   * Clone a new release track from a specific snapshot.
   * @param id Release track id
   * @param modified Snapshot modified timestamp
   * @param body Clone options
   * @returns Observable<any>
   */
  public cloneByModified(
    id: string,
    modified: string,
    body?: ClonePayload
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots/${modified}/clone`;
    return this.http.post(url, body || {}).pipe(
      tap(result => logger.log(`cloned from snapshot ${modified}`, result)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * DELETE /api/release-tracks/:id/snapshots/:modified
   * Delete a specific snapshot.
   * @param id Release track id
   * @param modified Snapshot modified timestamp
   * @returns Observable<unknown>
   */
  public deleteSnapshotByModified(
    id: string,
    modified: string
  ): Observable<unknown> {
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots/${modified}`;
    return this.http.delete(url).pipe(
      tap(() => logger.log(`deleted snapshot ${modified} from track ${id}`)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/snapshots/create
   * Resolve component tracks and create a new draft snapshot for a virtual track.
   * @param id Release track id
   * @param body Optional snapshot creation options
   * @returns Observable<any>
   */
  public createVirtualSnapshot(
    id: string,
    body?: { description?: string }
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots/create`;
    return this.http.post(url, body || {}).pipe(
      tap(result =>
        logger.log(`created virtual snapshot for track ${id}`, result)
      ),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * GET /api/release-tracks/:id/snapshots/preview
   * Preview the resolved contents of a virtual snapshot without creating it.
   * @param id Release track id
   * @returns Observable<any>
   */
  public previewVirtualSnapshot(id: string): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/snapshots/preview`;
    return this.http.get(url).pipe(
      tap(result =>
        logger.log(`previewed virtual snapshot for track ${id}`, result)
      ),
      catchError(this.handleError_continue<any>(null)),
      share()
    );
  }

  /**
   * PUT /api/release-tracks/:id/composition
   * Update the composition rules for a virtual release track.
   * @param id Release track id
   * @param body Composition payload
   * @returns Observable<any>
   */
  public updateComposition(
    id: string,
    body: Composition,
    userAccountId?: string
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/composition`;
    const payload = userAccountId ? { ...body, userAccountId } : body;
    return this.http.put(url, payload).pipe(
      tap(result =>
        logger.log(`updated virtual composition for track ${id}`, result)
      ),
      catchError(this.handleError_raise()),
      share()
    );
  }

  // -----------------------------------------------------------------------------
  // Candidate Management
  // -----------------------------------------------------------------------------

  /**
   * POST /api/release-tracks/:id/candidates
   * Add candidate references to latest draft.
   * @param id Release track id
   * @param object_refs Array of STIX ids or object refs
   * @param userAccountId Optional user
   * @returns Observable<any>
   */
  public addCandidates(
    id: string,
    object_refs: StixObjectRef[],
    userAccountId?: string
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/candidates`;
    const payload = userAccountId
      ? { object_refs, userAccountId }
      : { object_refs };
    return this.http.post(url, payload).pipe(
      tap(result => logger.log(`added candidates to track ${id}`, result)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * GET /api/release-tracks/:id/candidates
   * List candidates from latest snapshot.
   * @param id Release track id
   * @param options Query options: status|limit|offset
   * @returns Observable<any>
   */
  public listCandidates(
    id: string,
    options?: { status?: string; limit?: number; offset?: number }
  ): Observable<any> {
    const params = this.buildHttpParams(options);
    const url = `${this.apiUrl}/release-tracks/${id}/candidates`;
    return this.http.get(url, { params }).pipe(
      tap(() => logger.log(`listed candidates for track ${id}`)),
      catchError(this.handleError_continue<any>(null)),
      share()
    );
  }

  /**
   * DELETE /api/release-tracks/:id/candidates/:objectRef
   * Remove a candidate.
   * @param id Release track id
   * @param objectRef STIX object id
   * @returns Observable<unknown>
   */
  public removeCandidate(id: string, objectRef: string): Observable<unknown> {
    const url = `${this.apiUrl}/release-tracks/${id}/candidates/${objectRef}`;
    return this.http.delete(url).pipe(
      tap(() => logger.log(`removed candidate ${objectRef} from track ${id}`)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/candidates/review
   * Bulk transition candidate statuses.
   * @param id Release track id
   * @param body Review payload
   * @param userAccountId Optional user
   * @returns Observable<any>
   */
  public reviewCandidates(
    id: string,
    body: ReviewPayload,
    userAccountId?: string
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/candidates/review`;
    const payload = userAccountId ? { ...body, userAccountId } : body;
    return this.http.post(url, payload).pipe(
      tap(result => logger.log(`reviewed candidates for track ${id}`, result)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/candidates/promote
   * Promote candidates to staged.
   * @param id Release track id
   * @param object_refs Array of STIX ids
   * @param userAccountId Optional user
   * @returns Observable<any>
   */
  public promoteCandidates(
    id: string,
    object_refs: string[],
    userAccountId?: string
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/candidates/promote`;
    const payload = userAccountId
      ? { object_refs, userAccountId }
      : { object_refs };
    return this.http.post(url, payload).pipe(
      tap(result => logger.log(`promoted candidates for track ${id}`, result)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/candidates/:objectRef/update-version
   * Update candidate version pin.
   * @param id Release track id
   * @param objectRef STIX object id
   * @param body Version update payload
   * @returns Observable<any>
   */
  public updateCandidateVersion(
    id: string,
    objectRef: string,
    body: { old_modified?: string; new_modified?: string }
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/candidates/${objectRef}/update-version`;
    return this.http.post(url, body).pipe(
      tap(result =>
        logger.log(`updated version for candidate ${objectRef}`, result)
      ),
      catchError(this.handleError_raise()),
      share()
    );
  }

  // -----------------------------------------------------------------------------
  // Staged Object Management
  // -----------------------------------------------------------------------------

  /**
   * GET /api/release-tracks/:id/staged
   * List staged objects.
   * @param id Release track id
   * @returns Observable<any>
   */
  public listStaged(id: string): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/staged`;
    return this.http.get(url).pipe(
      tap(() => logger.log(`listed staged objects for track ${id}`)),
      catchError(this.handleError_continue<any>(null)),
      share()
    );
  }

  /**
   * POST /api/release-tracks/:id/staged/demote
   * Demote staged objects to candidates.
   * @param id Release track id
   * @param object_refs Array of STIX ids
   * @param userAccountId Optional user
   * @returns Observable<any>
   */
  public demoteStaged(
    id: string,
    object_refs: StixObjectRef[],
    userAccountId?: string
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/staged/demote`;
    const payload = userAccountId
      ? { object_refs, userAccountId }
      : { object_refs };
    return this.http.post(url, payload).pipe(
      tap(result =>
        logger.log(`demoted staged objects for track ${id}`, result)
      ),
      catchError(this.handleError_raise()),
      share()
    );
  }

  // -----------------------------------------------------------------------------
  // Release Track Configuration
  // -----------------------------------------------------------------------------

  /**
   * GET /api/release-tracks/:id/config
   * Get track configuration.
   * @param id Release track id
   * @returns Observable<any>
   */
  public getConfig(id: string): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/config`;
    return this.http.get(url).pipe(
      tap(() => logger.log(`retrieved config for track ${id}`)),
      catchError(this.handleError_continue<any>(null)),
      share()
    );
  }

  /**
   * PUT /api/release-tracks/:id/config
   * Update track configuration.
   * @param id Release track id
   * @param body Configuration payload
   * @param userAccountId Optional user
   * @returns Observable<any>
   */
  public updateConfig(
    id: string,
    body: Partial<ReleaseTrackConfig>,
    userAccountId?: string
  ): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/config`;
    const payload = userAccountId ? { ...body, userAccountId } : body;
    return this.http.put(url, payload).pipe(
      tap(result => logger.log(`updated config for track ${id}`, result)),
      catchError(this.handleError_raise()),
      share()
    );
  }

  // -----------------------------------------------------------------------------
  // Version Management
  // -----------------------------------------------------------------------------

  /**
   * GET /api/release-tracks/:id/objects/:objectRef/versions
   * List object versions in a track.
   * @param id Release track id
   * @param objectRef STIX object id
   * @returns Observable<any>
   */
  public listObjectVersions(id: string, objectRef: string): Observable<any> {
    const url = `${this.apiUrl}/release-tracks/${id}/objects/${objectRef}/versions`;
    return this.http.get(url).pipe(
      tap(() => logger.log(`listed versions for object ${objectRef}`)),
      catchError(this.handleError_continue<any>(null)),
      share()
    );
  }
}
