import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ExportFormat,
  ExportFormatType,
  ReleaseTrackSnapshot,
} from 'src/app/classes/release-tracks';
import {
  ReleaseTracksConnectorService,
  StixObjectRef,
} from 'src/app/services/connectors/rest-api/release-tracks.service';
import { BreadcrumbService } from 'src/app/services/helpers/breadcrumb.service';
import { MatDialog } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AddDialogComponent } from 'src/app/components/add-dialog/add-dialog.component';
import { StixTypeToAttackType } from 'src/app/utils/type-mappings';
import {
  StixType,
  WorkflowStatus,
  WorkflowStatusType,
} from 'src/app/utils/types';
import { MultipleChoiceDialogComponent } from 'src/app/components/multiple-choice-dialog/multiple-choice-dialog.component';
import { map, take } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, Observable, of } from 'rxjs';
import { StixObject } from 'src/app/classes/stix';
import { ReleaseTrackObjectItem } from 'src/app/components/release-track-object-card/release-track-object-card.component';
import {
  ReleaseTrackDiffOption,
  ReleaseTrackDiffTarget,
} from 'src/app/components/release-track-object-card/release-track-object-card.component';
import { StixDialogComponent } from 'src/app/views/stix/stix-dialog/stix-dialog.component';

@Component({
  selector: 'app-release-track-page',
  standalone: false,
  templateUrl: './release-track-page.component.html',
  styleUrls: ['./release-track-page.component.scss'],
})
export class ReleaseTrackPageComponent implements OnInit {
  public id = '';
  public releaseTrack: ReleaseTrackSnapshot | null = null;

  constructor(
    private connector: ReleaseTracksConnectorService,
    private breadcrumbService: BreadcrumbService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private restApiConnectorService: RestApiConnectorService,
    private snackbar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.id = params.id;
      if (this.id) this.getReleaseTrack();
    });
  }

  public get releaseTrackName(): string {
    return this.releaseTrack?.name ?? '';
  }

  public get candidates(): any[] {
    return this.releaseTrack?.candidates ?? [];
  }

  public get staged(): any[] {
    return this.releaseTrack?.staged ?? [];
  }

  public get reviewItems(): any[] {
    return [
      ...this.candidates.map(item => ({
        ...item,
        release_track_tier: 'candidate',
        diff_options: this.getDiffOptions({
          ...item,
          release_track_tier: 'candidate',
        }),
      })),
      ...this.staged.map(item => ({
        ...item,
        release_track_tier: 'staged',
        diff_options: this.getDiffOptions({
          ...item,
          release_track_tier: 'staged',
        }),
      })),
    ];
  }

  public get members(): any[] {
    return this.releaseTrack?.members ?? [];
  }

  public getReleaseTrack(): void {
    const subscription = this.connector.getLatestSnapshot(this.id).subscribe({
      next: res => {
        this.releaseTrack = res;
        if (!this.releaseTrack) return;

        this.breadcrumbService.changeBreadcrumb(
          this.route.snapshot,
          this.releaseTrack.name
        );

        // this.loadCandidates();
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
  }

  /**
   * Load candidates using ReleaseTracksConnectorService.listCandidates()
   */
  // private loadCandidates(): void {
  //   if (!this.id) return;
  //   const sub = this.connector.listCandidates(this.id).subscribe({
  //     next: res => {
  //       const list = (res && (res as any).data) ? (res as any).data : (Array.isArray(res) ? res : []);
  //       this._candidates = list as any[];
  //       if (this.releaseTrack) this.releaseTrack.candidates = this._candidates;
  //     },
  //     error: err => {
  //       console.error('Failed to list candidates for track', this.id, err);
  //     },
  //     complete: () => sub.unsubscribe(),
  //   });
  // }

  public onAddCandidate(): void {
    if (!this.releaseTrack) return;

    const selection = new SelectionModel<string>(true);

    const sub = this.restApiConnectorService
      .getAllObjects({ deserialize: true })
      .subscribe({
        next: results => {
          const objects = (results as any).data || [];

          const dialogRef = this.dialog.open(AddDialogComponent, {
            data: {
              selectableObjects: objects,
              select: selection,
              type: 'all',
              selectionType: 'many',
              buttonLabel: 'Add',
              title: 'Add candidates',
              clearSelection: true,
            },
            maxWidth: '70em',
            minWidth: '40vw',
            maxHeight: '75vh',
          });

          const closeSub = dialogRef.afterClosed().subscribe({
            next: result => {
              if (!result) return; // user cancelled

              const objectRefs: any[] = selection.selected.map(stixId => {
                const obj = objects.find(
                  (o: any) =>
                    o.stixID === stixId || (o.stix && o.stix.id === stixId)
                );
                const id = obj ? obj.stixID || obj.stix?.id : stixId;
                let modified: string | undefined;
                if (obj) {
                  if (obj.modified instanceof Date)
                    modified = obj.modified.toISOString();
                  else if (obj.modified) modified = obj.modified;
                  else if (obj.stix && obj.stix.modified)
                    modified = obj.stix.modified;
                }
                return modified ? { id, modified } : id;
              });

              const apiSub = this.connector
                .addCandidates(this.id, objectRefs)
                .subscribe({
                  next: () => {
                    // refresh snapshot from server so local state reflects saved candidates
                    this.getReleaseTrack();
                  },
                  error: err => {
                    console.error('Failed to add candidates', err);
                  },
                  complete: () => apiSub.unsubscribe(),
                });
            },
            complete: () => closeSub.unsubscribe(),
          });
        },
        complete: () => sub.unsubscribe(),
      });
  }

  public getViewUrl(stixId: string): string {
    const stixType = stixId.split('--')[0] as StixType;
    return `/${StixTypeToAttackType[stixType]}/${stixId}`;
  }

  public promote(objectIds: string[]): void {
    if (!objectIds.length) return;
    const sub = this.connector.promoteCandidates(this.id, objectIds).subscribe({
      next: () => {
        this.getReleaseTrack();
      },
      error: err => {
        console.error('Failed to promote candidates', err);
      },
      complete: () => sub.unsubscribe(),
    });
  }

  public onPromoteAll(): void {
    if (!this.id || !this.releaseTrack) return;
    const candidateIds: string[] = this.candidates
      .map(c => c.object_ref)
      .filter((r: any) => !!r);
    this.promote(candidateIds);
  }

  public onPromote(candidateId: string): void {
    if (!this.id || !candidateId) return;
    this.promote([candidateId]);
  }

  public demote(objectRefs: StixObjectRef[]): void {
    if (!objectRefs.length) return;
    const sub = this.connector.demoteStaged(this.id, objectRefs).subscribe({
      next: () => {
        this.getReleaseTrack();
      },
      error: err => {
        console.error('Failed to demote staged objects', err);
      },
      complete: () => sub.unsubscribe(),
    });
  }

  public onDemoteAll(): void {
    if (!this.id || !this.releaseTrack) return;
    const stagedRefs: StixObjectRef[] = this.staged
      .map(s => {
        return {
          id: s.object_ref,
          modified: s.object_modified,
        };
      })
      .filter((s: any) => !!s);
    this.demote(stagedRefs);
  }

  public onDemote(staged: any): void {
    if (!this.id || !staged) return;
    const stagedRef: StixObjectRef = {
      id: staged.object_ref,
      modified: staged.object_modified,
    };
    this.demote([stagedRef]);
  }

  public onView(id: string): void {
    this.router.navigate([this.getViewUrl(id)]);
  }

  public onDiff(item: ReleaseTrackObjectItem): void {
    if (!item?.object_ref) {
      this.snackbar.open(
        'Unable to determine which object to compare.',
        undefined,
        {
          duration: 3000,
        }
      );
      return;
    }

    const tier = this.getDiffTier(item);
    if (!tier) {
      this.snackbar.open(
        'Unable to determine which lane to compare.',
        undefined,
        {
          duration: 3000,
        }
      );
      return;
    }

    const target = item.diff_target ?? this.getDefaultDiffTarget(item);
    if (!target) {
      this.snackbar.open('No comparison version is available.', undefined, {
        duration: 3000,
      });
      return;
    }

    const diff = this.resolveDiffObjects(item, tier, target);

    diff.pipe(take(1)).subscribe(({ current, prior, expectedBaseline }) => {
      if (!current) {
        this.snackbar.open(
          'Unable to load the current object version.',
          undefined,
          {
            duration: 3000,
          }
        );
        return;
      }

      if (expectedBaseline && !prior) {
        this.snackbar.open(
          'Unable to load the comparison baseline version.',
          undefined,
          {
            duration: 3000,
          }
        );
        return;
      }

      this.openDiffDialog(current, prior);
    });
  }

  public onReviewAndApprove(item: any): void {
    this.reviewCandidateStatus(
      WorkflowStatus.AwaitingReview,
      WorkflowStatus.Reviewed,
      [item]
    );
  }

  public onBulkReviewAll(items: any[]): void {
    const candidateItems = items.filter(
      item => this.getReleaseTrackTier(item) === 'candidate'
    );
    const stagedItems = items.filter(
      item => this.getReleaseTrackTier(item) === 'staged'
    );

    if (stagedItems.length) {
      // TODO: wire staged object review transition once the API is available.
      console.log('onBulkReviewAll staged objects', stagedItems);
    }

    this.reviewCandidateStatus(
      WorkflowStatus.AwaitingReview,
      WorkflowStatus.Reviewed,
      candidateItems
    );
  }

  public onExport(): void {
    if (!this.id) return;

    const formatRef = this.dialog.open(MultipleChoiceDialogComponent, {
      width: '30em',
      autoFocus: false,
      data: {
        title: `Export latest release snapshot`,
        choices: [
          {
            label: 'STIX Bundle',
            value: 'bundle',
            description:
              'A standard STIX 2.1 JSON bundle containing all member objects of the release.',
          },
          {
            label: 'Snapshot',
            value: 'snapshot',
            description:
              'The raw release track snapshot, including tiers, version history, and configuration.',
          },
          {
            label: 'File System Store',
            value: 'filesystemstore',
            description:
              'A directory structure with individual STIX JSON files, suitable for Git releases.',
          },
          {
            label: 'Workbench Format',
            value: 'workbench',
            description:
              'A richer format including workflow statuses, metadata, and other Workbench-specific data.',
          },
        ],
      },
    });

    formatRef
      .afterClosed()
      .pipe(take(1))
      .subscribe(format => {
        if (!format) return;
        this.downloadLatestReleaseTrack(format as ExportFormat);
      });
  }

  private downloadLatestReleaseTrack(format: ExportFormatType): void {
    this.connector
      .exportLatestSnapshot(this.id, format, { include: 'all' })
      .pipe(take(1))
      .subscribe({
        next: result => {
          this.restApiConnectorService.triggerBrowserDownload(
            result,
            this.getExportFilename(format)
          );
        },
        error: err => {
          console.error('Failed to export release track', err);
        },
      });
  }

  private getExportFilename(format: ExportFormatType): string {
    const name = this.releaseTrackName || this.id || 'release-track';
    const safeName =
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'release-track';
    return `${safeName}-latest-${format}.json`;
  }

  public onDraft(): void {
    // TODO: create draft snapshot
    console.log('onDraft');
  }

  public onPreviewRelease(): void {
    // TODO: open preview & release modal
    console.log('onPreviewRelease');
  }

  // Build the list of valid diff baselines for an item based on its current release-track tier.
  public getDiffOptions(
    item: ReleaseTrackObjectItem
  ): ReleaseTrackDiffOption[] {
    if (!item?.object_ref) return [];

    const tier = this.getDiffTier(item);
    if (tier === 'candidate') {
      const options: ReleaseTrackDiffOption[] = [];
      if (this.findStagedEntry(item.object_ref)) {
        options.push({
          value: 'staged',
          label: 'Compare with staged',
        });
      }
      if (this.findMemberEntry(item.object_ref)) {
        options.push({
          value: 'members',
          label: 'Compare with members',
        });
      }
      return options;
    }

    if (tier === 'staged' && this.findMemberEntry(item.object_ref)) {
      return [
        {
          value: 'members',
          label: 'Compare with members',
        },
      ];
    }

    return [];
  }

  private reviewCandidateStatus(
    from: WorkflowStatusType,
    to: WorkflowStatusType,
    items: any[]
  ): void {
    if (!this.id || !items.length) return;

    const objectRefs = items
      .map(item => this.getReviewObjectRef(item))
      .filter((ref): ref is StixObjectRef => !!ref);

    if (!objectRefs.length) return;

    this.connector
      .reviewCandidates(this.id, {
        from,
        to,
        object_refs: objectRefs,
      })
      .pipe(take(1))
      .subscribe({
        next: () => this.getReleaseTrack(),
        error: err => {
          console.error('Failed to update candidate review status', err);
        },
      });
  }

  private getReviewObjectRef(item: any): StixObjectRef | null {
    if (!item?.object_ref) return null;
    const modified = this.toIsoString(item.object_modified);
    return modified ? { id: item.object_ref, modified } : item.object_ref;
  }

  private getDiffTier(
    item: ReleaseTrackObjectItem
  ): 'candidate' | 'staged' | null {
    return this.getReleaseTrackTier(item);
  }

  // Fall back to the first valid baseline so single-option cards can open Diff directly.
  private getDefaultDiffTarget(
    item: ReleaseTrackObjectItem
  ): ReleaseTrackDiffTarget | null {
    return this.getDiffOptions(item)[0]?.value ?? null;
  }

  private findStagedEntry(objectRef: string): ReleaseTrackObjectItem | null {
    return (
      this.releaseTrack?.staged?.find(item => item.object_ref === objectRef) ??
      null
    );
  }

  private findMemberEntry(objectRef: string): ReleaseTrackObjectItem | null {
    return (
      this.releaseTrack?.members?.find(item => item.object_ref === objectRef) ??
      null
    );
  }

  // Route diff resolution to the tier-specific loader that understands the selected baseline.
  private resolveDiffObjects(
    item: ReleaseTrackObjectItem,
    tier: 'candidate' | 'staged',
    target: ReleaseTrackDiffTarget
  ): Observable<{
    current: StixObject | null;
    prior: StixObject | null;
    expectedBaseline: boolean;
  }> {
    if (tier === 'candidate') {
      return this.resolveCandidateDiffObjects(item, target);
    }

    return this.resolveStagedDiffObjects(item, target);
  }

  // Compare a candidate against either staged or members depending on the user's selection.
  private resolveCandidateDiffObjects(
    item: ReleaseTrackObjectItem,
    target: ReleaseTrackDiffTarget
  ): Observable<{
    current: StixObject | null;
    prior: StixObject | null;
    expectedBaseline: boolean;
  }> {
    const baselineEntry =
      target === 'staged'
        ? this.findStagedEntry(item.object_ref)
        : this.findMemberEntry(item.object_ref);

    return forkJoin({
      current: this.fetchObjectVersion(item.object_ref),
      prior: baselineEntry
        ? this.fetchObjectVersion(
            baselineEntry.object_ref,
            baselineEntry.object_modified
          )
        : of(null),
    }).pipe(
      map(({ current, prior }) => ({
        current,
        prior,
        expectedBaseline: !!baselineEntry,
      }))
    );
  }

  // Compare a staged object against members, while keeping the staged version as the current side.
  private resolveStagedDiffObjects(
    item: ReleaseTrackObjectItem,
    target: ReleaseTrackDiffTarget
  ): Observable<{
    current: StixObject | null;
    prior: StixObject | null;
    expectedBaseline: boolean;
  }> {
    const memberEntry =
      target === 'members' ? this.findMemberEntry(item.object_ref) : null;

    return forkJoin({
      current: this.fetchObjectVersion(item.object_ref, item.object_modified),
      prior: memberEntry
        ? this.fetchObjectVersion(
            memberEntry.object_ref,
            memberEntry.object_modified
          )
        : of(null),
    }).pipe(
      map(({ current, prior }) => ({
        current,
        prior,
        expectedBaseline: !!memberEntry,
      }))
    );
  }

  private fetchObjectVersion(
    objectRef: string,
    modified?: Date | string
  ): Observable<StixObject | null> {
    const stixType = objectRef.split('--')[0] as StixType;
    const attackType = StixTypeToAttackType[stixType];

    let requestObject: Observable<StixObject[]>;
    switch (attackType) {
      case 'technique':
        requestObject = this.restApiConnectorService.getTechnique(
          objectRef,
          modified
        );
        break;
      case 'tactic':
        requestObject = this.restApiConnectorService.getTactic(
          objectRef,
          modified
        );
        break;
      case 'group':
        requestObject = this.restApiConnectorService.getGroup(
          objectRef,
          modified
        );
        break;
      case 'campaign':
        requestObject = this.restApiConnectorService.getCampaign(
          objectRef,
          modified
        );
        break;
      case 'asset':
        requestObject = this.restApiConnectorService.getAsset(
          objectRef,
          modified
        );
        break;
      case 'software':
        requestObject = this.restApiConnectorService.getSoftware(
          objectRef,
          modified
        );
        break;
      case 'mitigation':
        requestObject = this.restApiConnectorService.getMitigation(
          objectRef,
          modified
        );
        break;
      case 'matrix':
        requestObject = this.restApiConnectorService.getMatrix(
          objectRef,
          modified
        );
        break;
      case 'data-source':
        requestObject = this.restApiConnectorService.getDataSource(
          objectRef,
          modified
        );
        break;
      case 'data-component':
        requestObject = this.restApiConnectorService.getDataComponent(
          objectRef,
          modified
        );
        break;
      case 'detection-strategy':
        requestObject = this.restApiConnectorService.getDetectionStrategy(
          objectRef,
          modified
        );
        break;
      case 'analytic':
        requestObject = this.restApiConnectorService.getAnalytic(
          objectRef,
          modified
        );
        break;
      default:
        return of(null);
    }

    return requestObject.pipe(
      take(1),
      map(results => results[0] ?? null)
    );
  }

  private openDiffDialog(current: StixObject, prior: StixObject | null): void {
    this.dialog.open(StixDialogComponent, {
      data: {
        object: [current, prior],
        mode: 'diff',
        editable: false,
        sidebarControl: 'disable',
      },
      maxHeight: '75vh',
      autoFocus: false,
    });
  }

  private getReleaseTrackTier(item: any): 'candidate' | 'staged' | null {
    if (item?.release_track_tier) return item.release_track_tier;
    if (item?.object_staged_at || item?.object_staged_by) return 'staged';
    return item?.object_ref ? 'candidate' : null;
  }

  private toIsoString(value: Date | string | undefined): string | undefined {
    if (!value) return undefined;
    return value instanceof Date ? value.toISOString() : value;
  }
}
