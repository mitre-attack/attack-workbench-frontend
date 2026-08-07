import { Component, OnInit, ViewEncapsulation, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  MemberSyncStrategy,
  MemberSyncBehavior,
  MemberSyncPolicy,
  ReleaseTrackType,
  DeduplicationStrategy,
  ResolutionStrategy,
  SnapshotScheduleMode,
} from 'src/app/classes/release-tracks/enums';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { WorkflowStatus, StixType } from 'src/app/utils/types';
import {
  AttackTypeToPlural,
  StixTypeToAttackType,
} from 'src/app/utils/type-mappings';
import { finalize, take } from 'rxjs/operators';

const OBJECT_FILTER_OPTIONS: StixType[] = [
  'attack-pattern',
  'campaign',
  'course-of-action',
  'intrusion-set',
  'malware',
  'tool',
  'x-mitre-asset',
  'x-mitre-data-component',
  'x-mitre-detection-strategy',
  'x-mitre-analytic',
  'x-mitre-matrix',
  'x-mitre-tactic',
];

const DOMAIN_FILTER_OPTIONS = ['enterprise', 'ics', 'mobile'];

@Component({
  standalone: false,
  selector: 'app-new-track-dialog',
  templateUrl: './new-track-dialog.component.html',
  styleUrls: ['./new-track-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class NewTrackDialogComponent implements OnInit {
  public form: FormGroup;
  public loading = false;

  public WorkflowStatus = WorkflowStatus;
  public MemberSyncStrategy = MemberSyncStrategy;
  public MemberSyncBehavior = MemberSyncBehavior;
  public ReleaseTrack = ReleaseTrackType;

  public candidacyOptions = Object.values(WorkflowStatus);
  public memberSyncOptions = Object.values(MemberSyncStrategy);
  public supplantOptions = Object.values(MemberSyncBehavior);

  public deduplicationOptions = Object.values(DeduplicationStrategy);
  public snapshotModeOptions = Object.values(SnapshotScheduleMode);
  public componentTrackOptions: VirtualComponentTrackOption[] = [];
  public isLoadingComponentTracks = false;
  public objectTypeOptions = OBJECT_FILTER_OPTIONS.map(type => ({
    label: this.formatStixType(type),
    value: type,
  }));
  public domainOptions = DOMAIN_FILTER_OPTIONS;

  public mode: 'standard' | 'virtual' = 'standard';

  public get isVirtual() {
    return this.mode === ReleaseTrackType.Virtual;
  }

  constructor(
    public dialogRef: MatDialogRef<NewTrackDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder,
    private connector: ReleaseTracksConnectorService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      snapshotDescription: ['', [Validators.maxLength(4000)]],
      autoPromote: [false],
      candidacyThreshold: [{ value: WorkflowStatus.Reviewed, disabled: true }],
      memberSync: [MemberSyncStrategy.TrackLatest],
      supplantBehavior: [MemberSyncBehavior.Replace],
      composition: this.fb.group({
        componentTrackSearch: [''],
        deduplicationStrategy: [DeduplicationStrategy.PrioritizeLatestObject],
      }),
      snapshotSchedule: this.fb.group({
        mode: [SnapshotScheduleMode.Manual],
        cron: [''],
      }),
    });

    // Initialize mode from dialog data (if provided)
    if (this.data && this.data.type) {
      this.mode = this.data.type as ReleaseTrackType;
    }
  }

  ngOnInit(): void {
    if (this.isVirtual) {
      this.form.get('composition')?.setValidators([Validators.required]);
      this.form
        .get('composition')
        ?.updateValueAndValidity({ emitEvent: false });
      this.loadComponentTrackOptions();
    }

    const autoCtrl = this.form.get('autoPromote');
    const candidacyCtrl = this.form.get('candidacyThreshold');
    if (autoCtrl && candidacyCtrl) {
      // enable/disable candidacy threshold input based on auto promote value
      autoCtrl.valueChanges.subscribe(value => {
        if (value) candidacyCtrl.enable();
        else candidacyCtrl.disable();
      });
    }
  }

  public closeDialog(): void {
    this.dialogRef.close();
  }

  public isFormValid(): boolean {
    const nameValid = !!this.form.get('name')?.value?.trim();
    if (this.isVirtual) {
      return nameValid && this.selectedComponentTracks.length > 0;
    }
    return this.form.valid && nameValid;
  }

  public formatOption(opt: any): string {
    if (opt === null || opt === undefined) return '';
    // replace underscores and hyphens with spaces
    const out = String(opt).replace(/[_-]+/g, ' ');
    return out.toLowerCase();
  }

  public toggleComponentTrack(
    track: VirtualComponentTrackOption,
    selected: boolean
  ): void {
    track.selected = selected;
  }

  public get selectedComponentTracks(): VirtualComponentTrackOption[] {
    return this.componentTrackOptions.filter(track => track.selected);
  }

  public get filteredComponentTrackOptions(): VirtualComponentTrackOption[] {
    const search = this.getComponentTrackSearchText();
    return this.componentTrackOptions
      .filter(track => !track.selected)
      .filter(track => this.matchesComponentTrackSearch(track, search));
  }

  public displayComponentTrack(track: VirtualComponentTrackOption): string {
    return track?.name || '';
  }

  public getComponentTrackSnapshotLabel(
    track: VirtualComponentTrackOption
  ): string {
    return track.latestTaggedVersion
      ? `v${track.latestTaggedVersion}`
      : 'no tagged snapshots';
  }

  public selectComponentTrack(event: any): void {
    const track = event?.option?.value as VirtualComponentTrackOption;
    if (!track) return;

    track.selected = true;
    this.form
      .get('composition.componentTrackSearch')
      ?.setValue('', { emitEvent: false });
  }

  public removeComponentTrack(track: VirtualComponentTrackOption): void {
    track.selected = false;
    track.objectTypes = [];
    track.domains = [];
  }

  public handleCreate(): void {
    if (!this.isFormValid() || this.loading) return;

    let payload: any;
    const snapshotDescription = String(
      this.form.get('snapshotDescription')?.value || ''
    ).trim();
    if (this.isVirtual) {
      payload = {
        name: this.form.get('name')?.value,
        description: this.form.get('description')?.value,
        composition: this.buildVirtualComposition(),
        type: ReleaseTrackType.Virtual,
      };
      const snapshotSchedule = this.buildVirtualSnapshotSchedule();
      if (snapshotSchedule) payload.snapshot_schedule = snapshotSchedule;
    } else {
      payload = {
        name: this.form.get('name')?.value,
        description: this.form.get('description')?.value,
        config: {
          auto_promote: !!this.form.get('autoPromote')?.value,
          member_sync: {
            strategy: this.form.get('memberSync')?.value,
            supplant: {
              behavior: this.form.get('supplantBehavior')?.value,
              status_policy: MemberSyncPolicy.Preserve,
            },
          },
        },
        type: ReleaseTrackType.Standard,
      };
      if (payload.config.auto_promote) {
        payload.config.candidacy_threshold =
          this.form.get('candidacyThreshold')?.value;
      }
    }

    if (snapshotDescription) {
      payload.snapshot_description = snapshotDescription;
    }

    this.loading = true;
    this.connector
      .createReleaseTrack(payload)
      .pipe(take(1))
      .subscribe({
        next: result => {
          this.dialogRef.close(result);
        },
        error: () => {
          // leave dialog open and stop loading
          this.loading = false;
        },
      });
  }

  private loadComponentTrackOptions(): void {
    this.isLoadingComponentTracks = true;
    this.connector
      .listReleaseTracks()
      .pipe(
        take(1),
        finalize(() => {
          this.isLoadingComponentTracks = false;
        })
      )
      .subscribe({
        next: result => {
          const tracks = this.getTrackList(result);
          this.componentTrackOptions = tracks
            .filter(track => this.isStandardTrack(track))
            .filter(track => !!this.getTrackId(track))
            .map(track => this.toComponentTrackOption(track));
        },
        error: () => {
          this.componentTrackOptions = [];
        },
      });
  }

  private buildVirtualComposition(): any {
    const deduplication: any = {};
    const strategy = this.form.get('composition.deduplicationStrategy')?.value;
    if (strategy) deduplication.strategy = strategy;

    return {
      component_tracks: this.selectedComponentTracks.map((track, priority) => {
        const componentTrack: any = {
          track_id: track.trackId,
          resolution_strategy: ResolutionStrategy.LatestTagged,
          priority,
        };

        const filters: any = {};
        if (track.objectTypes.length) filters.object_types = track.objectTypes;
        if (track.domains.length) filters.domains = track.domains;
        if (Object.keys(filters).length) componentTrack.filters = filters;

        return componentTrack;
      }),
      deduplication,
    };
  }

  private buildVirtualSnapshotSchedule(): any | undefined {
    const snapshotSchedule = this.form.get('snapshotSchedule') as FormGroup;
    if (!snapshotSchedule) return undefined;

    const mode = snapshotSchedule.get('mode')?.value;
    const cron = snapshotSchedule.get('cron')?.value;
    if (!mode) return undefined;

    const payload: any = { mode };
    if (mode === SnapshotScheduleMode.Cron && cron) payload.cron = cron;
    return payload;
  }

  private getTrackList(result: any): any[] {
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.release_tracks)) return result.release_tracks;
    if (Array.isArray(result)) return result;
    return [];
  }

  private isStandardTrack(track: any): boolean {
    return String(track?.type).toLowerCase() === ReleaseTrackType.Standard;
  }

  private toComponentTrackOption(track: any): VirtualComponentTrackOption {
    const latestTaggedVersion = this.getLatestTaggedVersion(track);
    const taggedReleaseCount = this.getTaggedReleaseCount(track);

    return {
      trackId: this.getTrackId(track) as string,
      name: track.name || 'Untitled release track',
      description: track.description || '',
      latestTaggedVersion,
      taggedReleaseCount,
      selected: false,
      objectTypes: [],
      domains: [],
    };
  }

  private getTrackId(track: any): string | null {
    return track?.track_id || track?.id || null;
  }

  private getLatestTaggedVersion(track: any): string | null {
    return (
      track?.latest_tagged_version ||
      track?.latestTaggedVersion ||
      track?.latest_version ||
      track?.latestVersion ||
      null
    );
  }

  private getTaggedReleaseCount(track: any): number {
    return Number(
      track?.tagged_release_count ||
        track?.taggedReleaseCount ||
        track?.tagged_releases_count ||
        0
    );
  }

  private formatStixType(type: StixType): string {
    const attackType = StixTypeToAttackType[type];
    return AttackTypeToPlural[attackType]?.replace(/-/g, ' ') || type;
  }

  private getComponentTrackSearchText(): string {
    const value = this.form.get('composition.componentTrackSearch')?.value;
    if (!value) return '';
    if (typeof value === 'string') return value.trim().toLowerCase();
    return String(value.name || value.trackId || '')
      .trim()
      .toLowerCase();
  }

  private matchesComponentTrackSearch(
    track: VirtualComponentTrackOption,
    search: string
  ): boolean {
    if (!search) return true;
    return [track.name, track.trackId, track.description]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(search));
  }
}

interface VirtualComponentTrackOption {
  trackId: string;
  name: string;
  description: string;
  latestTaggedVersion: string | null;
  taggedReleaseCount: number;
  selected: boolean;
  objectTypes: StixType[];
  domains: string[];
}
