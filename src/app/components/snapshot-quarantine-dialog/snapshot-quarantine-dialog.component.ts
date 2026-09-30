import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnDestroy, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  QuarantineEntry,
  TierEntryDisplayFields,
} from 'src/app/classes/release-tracks/tiers';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { Software, StixObject } from 'src/app/classes/stix';
import { AttackTypeToClass } from 'src/app/utils/class-mappings';
import {
  AttackTypeToPlural,
  StixTypeToAttackType,
} from 'src/app/utils/type-mappings';
import { AttackType } from 'src/app/utils/types';
import { StixDialogComponent } from 'src/app/views/stix/stix-dialog/stix-dialog.component';
import { environment } from 'src/environments/environment';

type SnapshotQuarantineEntry = Omit<QuarantineEntry, 'object_modified'> &
  TierEntryDisplayFields & { object_modified: string | Date };

export interface SnapshotQuarantineDialogData {
  trackId: string;
  modified: string;
  title: string;
  entries: SnapshotQuarantineEntry[];
  canResolve: boolean;
}

interface QuarantineSource {
  trackId: string;
  trackName: string;
  version?: string;
  reason: string;
}

interface RevisionResponse {
  stix: Record<string, unknown> & {
    id: string;
    type: string;
    modified: string;
  };
  workspace?: Record<string, unknown>;
}

interface QuarantineRevision {
  modified: string;
  name?: string;
  attackId?: string;
  sources: QuarantineSource[];
  panelId: string;
  showJson: boolean;
  loading: boolean;
  error: string;
  detailsRequested: boolean;
  raw?: RevisionResponse;
  json?: string;
}

interface QuarantineGroup {
  objectRef: string;
  name?: string;
  revisions: QuarantineRevision[];
  selectedModified: string | null;
  attackType?: AttackType;
  currentObjectRoute?: string[];
  canViewDetails: boolean;
}

@Component({
  selector: 'app-snapshot-quarantine-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatRadioModule,
    RouterLink,
  ],
  templateUrl: './snapshot-quarantine-dialog.component.html',
  styleUrls: ['./snapshot-quarantine-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SnapshotQuarantineDialogComponent implements OnDestroy {
  public readonly groups: QuarantineGroup[];
  public savingObjectRef: string | null = null;
  public errorMessage = '';
  public errorObjectRef: string | null = null;
  private readonly requests = new Subscription();

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: SnapshotQuarantineDialogData,
    public readonly dialogRef: MatDialogRef<
      SnapshotQuarantineDialogComponent,
      boolean
    >,
    private readonly connector: ReleaseTracksConnectorService,
    private readonly http: HttpClient,
    private readonly dialog: MatDialog
  ) {
    const groups = new Map<string, QuarantineGroup>();
    for (const entry of data.entries) {
      let group = groups.get(entry.object_ref);
      if (!group) {
        const attackType: AttackType | undefined =
          StixTypeToAttackType[entry.object_ref.split('--')[0]];
        group = {
          objectRef: entry.object_ref,
          name: entry.name,
          revisions: [],
          selectedModified: null,
          attackType,
          currentObjectRoute:
            attackType && !['collection', 'note'].includes(attackType)
              ? ['/', attackType, entry.object_ref]
              : undefined,
          canViewDetails: !!attackType && attackType !== 'note',
        };
        groups.set(entry.object_ref, group);
      }
      const modified =
        entry.object_modified instanceof Date
          ? entry.object_modified.toISOString()
          : entry.object_modified;
      let revision = group.revisions.find(item => item.modified === modified);
      if (!revision) {
        revision = {
          modified,
          name: entry.name,
          attackId: entry.attack_id,
          sources: [],
          panelId: `quarantine-json-${groups.size}-${group.revisions.length}`,
          showJson: false,
          loading: false,
          error: '',
          detailsRequested: false,
        };
        group.revisions.push(revision);
      }
      revision.sources.push({
        trackId: entry.source_track_id,
        trackName: entry.source_track_name,
        version: entry.source_snapshot_version,
        reason: entry.conflict_reason,
      });
    }
    this.groups = Array.from(groups.values());
  }

  public ngOnDestroy(): void {
    this.requests.unsubscribe();
  }

  public toggleJson(
    group: QuarantineGroup,
    revision: QuarantineRevision
  ): void {
    revision.showJson = !revision.showJson;
    if (revision.showJson) this.loadRevision(group, revision);
  }

  public compareJson(group: QuarantineGroup): void {
    for (const revision of group.revisions) {
      revision.showJson = true;
      this.loadRevision(group, revision);
    }
  }

  public viewDetails(
    group: QuarantineGroup,
    revision: QuarantineRevision
  ): void {
    if (!group.canViewDetails || this.savingObjectRef) return;
    revision.detailsRequested = true;
    this.loadRevision(group, revision);
  }

  public loadRevision(
    group: QuarantineGroup,
    revision: QuarantineRevision
  ): void {
    if (revision.loading) return;
    if (revision.raw) {
      if (revision.detailsRequested) this.openDetails(group, revision);
      return;
    }
    if (!group.attackType) {
      revision.error =
        'Exact revision retrieval is unavailable for this STIX type.';
      return;
    }
    revision.loading = true;
    revision.error = '';
    const url =
      `${environment.integrations.rest_api.url}/${AttackTypeToPlural[group.attackType]}` +
      `/${encodeURIComponent(group.objectRef)}/modified/${encodeURIComponent(revision.modified)}`;
    this.requests.add(
      this.http
        .get<RevisionResponse | RevisionResponse[]>(url)
        .pipe(
          map(response => {
            const candidates = Array.isArray(response) ? response : [response];
            const exact = candidates.find(
              candidate =>
                candidate?.stix?.id === group.objectRef &&
                candidate.stix.modified === revision.modified &&
                candidate.stix.type === group.objectRef.split('--')[0]
            );
            if (!exact) {
              throw new Error(
                'The server did not return the requested exact revision. No current revision was substituted.'
              );
            }
            return exact;
          })
        )
        .subscribe({
          next: raw => {
            revision.raw = raw;
            // Preserve all raw STIX fields; model serialization can discard them.
            revision.json = JSON.stringify(raw.stix, null, 2);
            revision.loading = false;
            if (revision.detailsRequested) this.openDetails(group, revision);
          },
          error: error => {
            revision.loading = false;
            const message = error?.error?.message ?? error?.message;
            revision.error =
              typeof message === 'string'
                ? `Could not load this exact revision. ${message}`
                : 'Could not load this exact revision. Please try again.';
          },
        })
    );
  }

  private openDetails(
    group: QuarantineGroup,
    revision: QuarantineRevision
  ): void {
    try {
      const raw = revision.raw;
      const ObjectClass = AttackTypeToClass[group.attackType] as new (
        value: RevisionResponse
      ) => StixObject;
      const object =
        raw.stix.type === 'malware' || raw.stix.type === 'tool'
          ? new Software(raw.stix.type, raw)
          : new ObjectClass(raw);
      this.dialog.open(StixDialogComponent, {
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
        ariaLabel: `${revision.name || group.objectRef}, exact revision ${revision.modified}`,
      });
      revision.detailsRequested = false;
      revision.error = '';
    } catch {
      revision.error =
        'Could not display details for this exact revision. View JSON to inspect its original fields, or retry.';
    }
  }

  public useSelectedRevision(group: QuarantineGroup): void {
    if (
      !this.data.canResolve ||
      this.savingObjectRef ||
      !group.selectedModified
    )
      return;

    this.errorMessage = '';
    this.savingObjectRef = group.objectRef;
    this.dialogRef.disableClose = true;
    this.connector
      .promoteQuarantinedRevision(this.data.trackId, {
        object_ref: group.objectRef,
        object_modified: group.selectedModified,
      })
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: error => {
          this.dialogRef.disableClose = false;
          this.savingObjectRef = null;
          this.errorObjectRef = group.objectRef;
          const message =
            error?.error?.message ?? error?.error ?? error?.message;
          this.errorMessage =
            typeof message === 'string'
              ? `Could not use the selected revision. ${message}`
              : 'Could not use the selected revision. Your selection is unchanged. Please try again.';
        },
      });
  }
}
