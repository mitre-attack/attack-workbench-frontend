import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { defer, forkJoin, Observable, of, Subject, Subscription } from 'rxjs';
import { map, switchMap, takeUntil } from 'rxjs/operators';
import { ExportFormat } from 'src/app/classes/release-tracks';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { Software, StixObject } from 'src/app/classes/stix';
import { AttackTypeToClass } from 'src/app/utils/class-mappings';
import {
  AttackTypeToPlural,
  StixTypeToAttackType,
} from 'src/app/utils/type-mappings';
import { StixDialogComponent } from 'src/app/views/stix/stix-dialog/stix-dialog.component';
import { environment } from 'src/environments/environment';
import {
  SnapshotQuarantineDialogComponent,
  SnapshotQuarantineDialogData,
} from '../snapshot-quarantine-dialog/snapshot-quarantine-dialog.component';

interface SnapshotObject {
  id: string;
  type: string;
  modified?: string;
  created?: string;
  name?: string;
  relationship_type?: string;
  source_ref?: string;
  target_ref?: string;
  definition_type?: string;
  definition?: Record<string, unknown>;
  external_references?: { external_id?: string }[];
  [key: string]: unknown;
}

interface SourceTrack {
  track_id: string;
  track_name?: string;
}

interface ManifestEntry {
  kind: 'primary' | 'secondary' | 'relationship' | 'supporting' | 'link_target';
  object_ref: string;
  object_modified?: string;
  stix?: SnapshotObject;
  source_tracks?: SourceTrack[];
}

interface SnapshotMetadata {
  name: string;
  version?: string;
  content_manifest_id?: string;
  composition: { deduplication: { strategy?: string } };
  quarantine: SnapshotQuarantineDialogData['entries'];
  content_manifest_entries?: ManifestEntry[];
  linkTargetCount?: number;
}

interface ContentsRow {
  key: string;
  id: string;
  type: string;
  modified?: string;
  object?: SnapshotObject;
  name: string;
  context: string;
  roles: string[];
  sourceTracks: SourceTrack[];
  searchText: string;
  libraryRoute?: string[];
  previewLoading: boolean;
  previewError: string;
}

@Component({
  selector: 'app-virtual-snapshot-contents',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    RouterLink,
  ],
  templateUrl: './virtual-snapshot-contents.component.html',
  styleUrls: ['./virtual-snapshot-contents.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class VirtualSnapshotContentsComponent implements OnChanges, OnDestroy {
  @Input() public trackId = '';
  @Input() public modified = '';
  @Input() public title = '';
  @Input() public isLatest = false;
  @Input() public canResolve = false;
  @Output() public back = new EventEmitter<void>();
  @Output() public resolved = new EventEmitter<void>();

  public loading = false;
  public error = '';
  public workbench: SnapshotMetadata | null = null;
  public exportedCount = 0;
  public rows: ContentsRow[] = [];
  public filteredRows: ContentsRow[] = [];
  public pageRows: ContentsRow[] = [];
  public types: string[] = [];
  public query = '';
  public selectedType = '';
  public selectedSourceTrack = '';
  public sourceTracks: SourceTrack[] = [];
  public sourceTrackLabels = new Map<string, string>();
  public unrecordedSourceCount = 0;
  public pageIndex = 0;
  public pageSize = 25;
  public expandedKey: string | null = null;
  public expandedJson = '';
  private loadSubscription?: Subscription;
  private previewSubscription?: Subscription;
  private previewRow?: ContentsRow;
  private previewDialog?: MatDialogRef<StixDialogComponent>;
  private quarantineDialog?: MatDialogRef<
    SnapshotQuarantineDialogComponent,
    boolean
  >;
  private readonly destroyed = new Subject<void>();

  constructor(
    private readonly releaseTracks: ReleaseTracksConnectorService,
    private readonly dialog: MatDialog,
    private readonly http: HttpClient
  ) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.trackId || changes.modified) this.load();
  }

  public ngOnDestroy(): void {
    this.loadSubscription?.unsubscribe();
    this.cancelPreview();
    this.destroyed.next();
    this.destroyed.complete();
    this.quarantineDialog?.close();
  }

  public get showQuarantine(): boolean {
    return (
      this.workbench?.composition?.deduplication?.strategy === 'quarantine' &&
      Array.isArray(this.workbench?.quarantine) &&
      this.workbench.quarantine.length > 0
    );
  }

  public load(): void {
    this.loadSubscription?.unsubscribe();
    this.cancelPreview();
    this.quarantineDialog?.close();
    this.workbench = null;
    this.rows = [];
    this.types = [];
    this.query = '';
    this.selectedType = '';
    this.selectedSourceTrack = '';
    this.sourceTracks = [];
    this.sourceTrackLabels.clear();
    this.unrecordedSourceCount = 0;
    this.pageSize = 25;
    this.error = '';
    this.applyFilters();
    if (!this.trackId || !this.modified) {
      this.loading = false;
      this.error =
        'This snapshot is missing its exact track or revision identifier. Return to Releases and select a snapshot.';
      return;
    }

    this.loading = true;
    this.loadSubscription = forkJoin({
      workbench: this.releaseTracks.exportSnapshotByModified(
        this.trackId,
        this.modified,
        ExportFormat.Workbench
      ),
      bundle: this.releaseTracks.exportSnapshotByModified(
        this.trackId,
        this.modified,
        ExportFormat.Bundle,
        { stixVersion: '2.1' }
      ),
    })
      .pipe(
        map(
          ({ workbench, bundle }: { workbench: unknown; bundle: unknown }) => {
            if (
              !this.isRecord(bundle) ||
              !Array.isArray(bundle.objects) ||
              !bundle.objects.every(object => this.isSnapshotObject(object))
            ) {
              throw new Error(
                'The snapshot export did not contain a valid contents bundle.'
              );
            }
            return {
              workbench: this.parseMetadata(workbench),
              objects: bundle.objects,
            };
          }
        )
      )
      .subscribe({
        next: ({ workbench, objects }) => {
          this.workbench = workbench;
          this.rows = this.createRows(
            objects,
            workbench.content_manifest_entries
          );
          this.types = [...new Set(this.rows.map(row => row.type))].sort();
          this.prepareSourceTracks();
          this.applyFilters();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.error =
            'We could not load this exact snapshot. It may no longer be available, or the service could not export its manifest. Retry or return to Releases to choose another snapshot.';
        },
      });
  }

  public applyFilters(): void {
    const terms = this.query
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    this.filteredRows = this.rows.filter(
      row =>
        (!this.selectedType || row.type === this.selectedType) &&
        (!this.selectedSourceTrack ||
          (this.selectedSourceTrack === 'unrecorded'
            ? row.sourceTracks.length === 0
            : row.sourceTracks.some(
                track => `track:${track.track_id}` === this.selectedSourceTrack
              ))) &&
        terms.every(term => row.searchText.includes(term))
    );
    this.pageIndex = 0;
    this.updatePage();
  }

  public clearFilters(): void {
    this.query = '';
    this.selectedType = '';
    this.selectedSourceTrack = '';
    this.applyFilters();
  }

  public changePage(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePage();
  }

  public toggleJson(row: ContentsRow): void {
    if (!row.object) return;
    const opening = this.expandedKey !== row.key;
    this.expandedKey = opening ? row.key : null;
    this.expandedJson = opening ? JSON.stringify(row.object, null, 2) : '';
  }

  public preview(row: ContentsRow): void {
    this.cancelPreview();
    this.previewRow = row;
    row.previewLoading = true;
    row.previewError = '';
    this.previewSubscription = this.exactObject(row)
      .pipe(
        switchMap(stix => {
          if (stix.type !== 'relationship') return of({ stix });
          return forkJoin({
            source_object: this.snapshotEndpoint(stix.source_ref),
            target_object: this.snapshotEndpoint(stix.target_ref),
          }).pipe(map(endpoints => ({ stix, ...endpoints })));
        }),
        map(raw => {
          const attackType = StixTypeToAttackType[raw.stix.type];
          const ObjectClass = AttackTypeToClass[attackType] as new (value: {
            stix: SnapshotObject;
          }) => StixObject;
          if (!ObjectClass || attackType === 'note')
            throw new Error('Preview is unavailable for this STIX type.');
          const object =
            raw.stix.type === 'malware' || raw.stix.type === 'tool'
              ? new Software(raw.stix.type, raw)
              : new ObjectClass(raw);
          return this.dialog.open(StixDialogComponent, {
            data: {
              object,
              mode: 'view',
              editable: false,
              sidebarControl: 'disable',
            },
            width: '50em',
            maxWidth: '96vw',
            maxHeight: '85vh',
            autoFocus: false,
            ariaLabel: `${row.name}, exact snapshot revision ${row.modified || 'unversioned'}`,
          });
        })
      )
      .subscribe({
        next: dialog => {
          this.previewDialog = dialog;
          row.previewLoading = false;
        },
        error: error => {
          row.previewLoading = false;
          row.previewError =
            error instanceof Error
              ? `Could not preview this exact snapshot object. ${error.message}`
              : 'Could not preview this exact snapshot object. Try Preview again.';
        },
      });
  }

  private cancelPreview(): void {
    this.previewSubscription?.unsubscribe();
    if (this.previewRow) this.previewRow.previewLoading = false;
    this.previewRow = undefined;
    this.previewDialog?.close();
    this.previewDialog = undefined;
  }

  private exactObject(row: ContentsRow): Observable<SnapshotObject> {
    return defer(() => {
      const matches = (object: unknown): object is SnapshotObject =>
        this.isSnapshotObject(object) &&
        object.id === row.id &&
        object.type === row.type &&
        object.modified === row.modified;
      if (row.object) {
        if (!matches(row.object))
          throw new Error(
            'The supplied payload does not match its manifest reference.'
          );
        return of(row.object);
      }
      const attackType = StixTypeToAttackType[row.type];
      if (!attackType || attackType === 'note')
        throw new Error(
          'Exact revision retrieval is unavailable for this STIX type.'
        );
      if (!row.modified && row.type !== 'marking-definition')
        throw new Error('The manifest does not identify an exact revision.');
      const url =
        `${environment.integrations.rest_api.url}/${AttackTypeToPlural[attackType]}` +
        `/${encodeURIComponent(row.id)}` +
        (row.modified ? `/modified/${encodeURIComponent(row.modified)}` : '');
      return this.http.get<unknown>(url).pipe(
        map(response => {
          const candidates = Array.isArray(response) ? response : [response];
          const exact = candidates
            .map(candidate =>
              this.isRecord(candidate) ? candidate.stix : undefined
            )
            .find(matches);
          if (!exact)
            throw new Error(
              'The server did not return the requested exact revision. No current revision was substituted.'
            );
          row.object = exact;
          return exact;
        })
      );
    });
  }

  private snapshotEndpoint(
    id: string | undefined
  ): Observable<{ stix: SnapshotObject }> {
    return defer(() => {
      const candidates = this.rows.filter(row => row.id === id);
      if (candidates.length !== 1)
        throw new Error(
          'This relationship endpoint is missing or ambiguous in the snapshot manifest.'
        );
      return this.exactObject(candidates[0]).pipe(map(stix => ({ stix })));
    });
  }

  public trackRow(_index: number, row: ContentsRow): string {
    return row.key;
  }

  public openQuarantine(): void {
    if (!this.workbench || !this.showQuarantine || this.quarantineDialog)
      return;
    const snapshotKey = `${this.trackId}|${this.modified}`;
    const data: SnapshotQuarantineDialogData = {
      trackId: this.trackId,
      modified: this.modified,
      title: this.title || this.workbench.name,
      entries: this.workbench.quarantine,
      canResolve: this.canResolve && this.isLatest && !this.workbench.version,
    };
    this.quarantineDialog = this.dialog.open(
      SnapshotQuarantineDialogComponent,
      {
        data,
        width: '1000px',
        maxWidth: '96vw',
        maxHeight: '90vh',
        autoFocus: 'first-heading',
        ariaLabel: 'Quarantined snapshot objects',
      }
    );
    this.quarantineDialog
      .afterClosed()
      .pipe(takeUntil(this.destroyed))
      .subscribe(result => {
        this.quarantineDialog = undefined;
        if (
          result === true &&
          snapshotKey === `${this.trackId}|${this.modified}`
        ) {
          this.resolved.emit();
        }
      });
  }

  private updatePage(): void {
    const start = this.pageIndex * this.pageSize;
    this.pageRows = this.filteredRows.slice(start, start + this.pageSize);
    this.expandedKey = null;
    this.expandedJson = '';
  }

  private createRows(
    objects: SnapshotObject[],
    entries?: ManifestEntry[]
  ): ContentsRow[] {
    const unique = new Map<string, ContentsRow>();
    const names = new Map(
      objects.map(object => [object.id, object.name || object.id])
    );
    const add = (
      id: string,
      modified: string | undefined,
      object: SnapshotObject | undefined,
      role: string,
      sourceTracks: SourceTrack[] = []
    ): void => {
      const key = `${id}|${modified || ''}`;
      const existing = unique.get(key);
      if (existing) {
        if (!existing.roles.includes(role)) existing.roles.push(role);
        if (!existing.object && object) existing.object = object;
        this.mergeSourceTracks(existing.sourceTracks, sourceTracks);
        return;
      }
      const type = object?.type || id.split('--')[0];
      let name = object?.name || type;
      let context = '';
      if (type === 'relationship' && object) {
        name = object.name || object.relationship_type || 'Relationship';
        context = `${names.get(object.source_ref || '') || object.source_ref || 'Unknown source'} → ${names.get(object.target_ref || '') || object.target_ref || 'Unknown target'}`;
      } else if (type === 'marking-definition' && object) {
        name =
          object.name ||
          (object.definition_type
            ? `${object.definition_type.toUpperCase()} marking`
            : 'Marking definition');
        context = Object.values(object.definition || {})
          .map(value =>
            typeof value === 'string' ? value : JSON.stringify(value)
          )
          .join(' · ');
      }
      const externalIds = (object?.external_references || [])
        .map(reference => reference.external_id || '')
        .join(' ');
      const attackType = StixTypeToAttackType[type];
      const libraryRoute =
        attackType === 'collection'
          ? modified
            ? ['/', 'collection', id, 'modified', modified]
            : undefined
          : attackType && attackType !== 'note'
            ? ['/', attackType, id]
            : undefined;
      unique.set(key, {
        key,
        id,
        type,
        modified,
        object,
        libraryRoute,
        previewLoading: false,
        previewError: '',
        name,
        context,
        roles: [role],
        sourceTracks: this.mergeSourceTracks([], sourceTracks),
        searchText: [
          name,
          context,
          id,
          type,
          modified,
          object?.created,
          object?.source_ref,
          object?.target_ref,
          externalIds,
        ]
          .join(' ')
          .toLocaleLowerCase(),
      });
    };
    objects.forEach((object, index) => {
      // STIX 2.1 exports prepend one generated collection projection. It is
      // not a manifest member; do not discard any other supporting objects.
      if (index === 0 && object.type === 'x-mitre-collection') return;
      add(object.id, object.modified, object, 'Exported');
    });
    this.exportedCount = unique.size;
    const labels: Record<ManifestEntry['kind'], string> = {
      primary: 'Primary',
      secondary: 'Secondary',
      relationship: 'Relationship',
      supporting: 'Supporting',
      link_target: 'Render-only dependency',
    };
    entries?.forEach(entry => {
      add(
        entry.object_ref,
        entry.object_modified || entry.stix?.modified,
        entry.stix,
        labels[entry.kind],
        entry.source_tracks
      );
    });
    return [...unique.values()];
  }

  private mergeSourceTracks(
    target: SourceTrack[],
    sources: SourceTrack[]
  ): SourceTrack[] {
    for (const source of sources) {
      const existing = target.find(track => track.track_id === source.track_id);
      if (!existing) target.push({ ...source });
      else if (!existing.track_name && source.track_name)
        existing.track_name = source.track_name;
    }
    return target;
  }

  private prepareSourceTracks(): void {
    const tracks: SourceTrack[] = [];
    for (const row of this.rows)
      this.mergeSourceTracks(tracks, row.sourceTracks);
    const nameCounts = new Map<string, number>();
    for (const track of tracks) {
      const name = track.track_name || track.track_id;
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    }
    for (const track of tracks) {
      const name = track.track_name || track.track_id;
      this.sourceTrackLabels.set(
        track.track_id,
        (nameCounts.get(name) || 0) > 1 ? `${name} (${track.track_id})` : name
      );
    }
    this.sourceTracks = tracks.sort((left, right) =>
      this.sourceTrackLabels
        .get(left.track_id)!
        .localeCompare(this.sourceTrackLabels.get(right.track_id)!)
    );
    this.unrecordedSourceCount = this.rows.filter(
      row => row.sourceTracks.length === 0
    ).length;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private isSnapshotObject(value: unknown): value is SnapshotObject {
    if (
      !this.isRecord(value) ||
      typeof value.id !== 'string' ||
      typeof value.type !== 'string'
    )
      return false;
    if (
      ![
        'modified',
        'created',
        'name',
        'relationship_type',
        'source_ref',
        'target_ref',
        'definition_type',
      ].every(key => value[key] === undefined || typeof value[key] === 'string')
    )
      return false;
    if (value.definition !== undefined && !this.isRecord(value.definition))
      return false;
    return (
      value.external_references === undefined ||
      (Array.isArray(value.external_references) &&
        value.external_references.every(
          reference =>
            this.isRecord(reference) &&
            (reference.external_id === undefined ||
              typeof reference.external_id === 'string')
        ))
    );
  }

  private parseMetadata(value: unknown): SnapshotMetadata {
    if (!this.isRecord(value)) throw new Error('Invalid snapshot metadata.');
    const composition = this.isRecord(value.composition)
      ? value.composition
      : {};
    const deduplication = this.isRecord(composition.deduplication)
      ? composition.deduplication
      : {};
    const statistics = this.isRecord(value.content_statistics)
      ? value.content_statistics
      : {};
    const quarantine = Array.isArray(value.quarantine) ? value.quarantine : [];
    const metadata: SnapshotMetadata = {
      name: typeof value.name === 'string' ? value.name : 'Snapshot',
      version: typeof value.version === 'string' ? value.version : undefined,
      content_manifest_id:
        typeof value.content_manifest_id === 'string'
          ? value.content_manifest_id
          : undefined,
      composition: {
        deduplication: {
          strategy:
            typeof deduplication.strategy === 'string'
              ? deduplication.strategy
              : undefined,
        },
      },
      quarantine: quarantine.map((entry: unknown) => {
        if (
          !this.isRecord(entry) ||
          typeof entry.object_ref !== 'string' ||
          typeof entry.object_modified !== 'string'
        ) {
          throw new Error('Invalid quarantine entry.');
        }
        return {
          object_ref: entry.object_ref,
          object_modified: entry.object_modified,
          source_track_id:
            typeof entry.source_track_id === 'string'
              ? entry.source_track_id
              : '',
          source_track_name:
            typeof entry.source_track_name === 'string'
              ? entry.source_track_name
              : '',
          source_snapshot_version:
            typeof entry.source_snapshot_version === 'string'
              ? entry.source_snapshot_version
              : undefined,
          conflict_reason:
            typeof entry.conflict_reason === 'string'
              ? entry.conflict_reason
              : '',
          name: typeof entry.name === 'string' ? entry.name : undefined,
          attack_id:
            typeof entry.attack_id === 'string' ? entry.attack_id : undefined,
        };
      }),
      linkTargetCount:
        typeof statistics.link_target_count === 'number'
          ? statistics.link_target_count
          : undefined,
    };
    // Optional preview contract: production exports currently omit manifest pointers.
    if (value.content_manifest_entries !== undefined) {
      if (!Array.isArray(value.content_manifest_entries))
        throw new Error('Invalid manifest entries.');
      metadata.content_manifest_entries = value.content_manifest_entries.map(
        (entry: unknown) => {
          if (
            !this.isRecord(entry) ||
            typeof entry.object_ref !== 'string' ||
            (entry.object_modified !== undefined &&
              typeof entry.object_modified !== 'string') ||
            (entry.stix !== undefined && !this.isSnapshotObject(entry.stix))
          ) {
            throw new Error('Invalid manifest entry.');
          }
          const kind = entry.kind;
          if (
            kind !== 'primary' &&
            kind !== 'secondary' &&
            kind !== 'relationship' &&
            kind !== 'supporting' &&
            kind !== 'link_target'
          )
            throw new Error('Invalid manifest role.');
          if (
            entry.source_tracks !== undefined &&
            (!Array.isArray(entry.source_tracks) ||
              !entry.source_tracks.every(
                source =>
                  this.isRecord(source) &&
                  typeof source.track_id === 'string' &&
                  source.track_id.length > 0 &&
                  (source.track_name === undefined ||
                    typeof source.track_name === 'string')
              ))
          )
            throw new Error('Invalid manifest source tracks.');
          return {
            kind,
            object_ref: entry.object_ref,
            object_modified: entry.object_modified as string | undefined,
            stix: entry.stix as SnapshotObject | undefined,
            source_tracks: entry.source_tracks as SourceTrack[] | undefined,
          };
        }
      );
    }
    return metadata;
  }
}
