import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';

import { Role } from 'src/app/classes/authn/role';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import {
  MembershipSectionDataService,
  MembershipTrack,
} from 'src/app/services/connectors/rest-api/membership-section-data.service';

interface SelectedRelease {
  key: string;
  release: any;
  membership: MembershipTrack;
}

@Component({
  selector: 'app-membership-section',
  standalone: false,
  templateUrl: './membership-section.component.html',
  styleUrls: ['./membership-section.component.scss'],
})
export class MembershipSectionComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input() config: any;
  @Input() object: any;

  @Output() releasesCompared = new EventEmitter<SelectedRelease[]>();

  memberships: MembershipTrack[] = [];

  loading = false;
  loadError: string | null = null;
  private loadedObjectRef: string | null = null;

  private selectedReleases = new Map<string, SelectedRelease>();

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly membershipData: MembershipSectionDataService,
    private readonly authenticationService: AuthenticationService,
    private readonly router: Router,
    private readonly elementRef: ElementRef<HTMLElement>
  ) {
    this.memberships = this.membershipData.getDefaultTracks();
  }

  ngOnInit(): void {
    this.loadMembershipData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes.config && !changes.object) {
      return;
    }

    const currentObjectRef = this.objectRef;

    if (currentObjectRef && currentObjectRef !== this.loadedObjectRef) {
      this.loadMembershipData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get membershipObject(): any {
    return this.object ?? this.config?.object ?? null;
  }

  get objectRef(): string | null {
    return (
      this.membershipObject?.stixID ??
      this.membershipObject?.id ??
      this.membershipObject?.stix?.id ??
      null
    );
  }

  get selectedReleaseCount(): number {
    return this.selectedReleases.size;
  }

  get hasSelection(): boolean {
    return this.selectedReleaseCount > 0;
  }

  get canViewReleaseTrackDashboard(): boolean {
    return this.authenticationService.isAuthorized([
      Role.TEAM_LEAD,
      Role.ADMIN,
    ]);
  }

  loadMembershipData(): void {
    const objectRef = this.objectRef;

    if (!objectRef) {
      this.memberships = this.membershipData.getDefaultTracks();

      this.loadError =
        'Unable to load release-track membership because the object ID is missing.';

      return;
    }

    if (this.loading && this.loadedObjectRef === objectRef) {
      return;
    }

    this.loadedObjectRef = objectRef;
    this.loading = true;
    this.loadError = null;
    this.selectedReleases = new Map<string, SelectedRelease>();

    this.membershipData
      .loadMemberships(objectRef, this.membershipObject, this.config)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: tracks => {
          this.memberships = tracks;
        },
        error: error => {
          console.error('Unable to load release-track membership', error);

          this.memberships = this.membershipData.getDefaultTracks();

          this.loadError = 'Release-track membership could not be loaded.';
        },
      });
  }

  getTrackName(membership: MembershipTrack): string {
    return (
      membership?.name ??
      membership?.title ??
      membership?.track?.name ??
      membership?.release_track?.name ??
      this.formatIdentifier(membership?.id) ??
      'Release Track'
    );
  }

  getTrackDescription(membership: MembershipTrack): string {
    return (
      membership?.description ??
      membership?.track?.description ??
      membership?.release_track?.description ??
      'Release track containing this ATT&CK object.'
    );
  }

  getTrackType(membership: MembershipTrack): string {
    const type =
      membership?.type ??
      membership?.track_type ??
      membership?.track?.type ??
      membership?.release_track?.type ??
      'STANDARD';

    return String(type).replace(/[_-]+/g, ' ').toUpperCase();
  }

  isVirtualTrack(membership: MembershipTrack): boolean {
    return String(
      membership?.type ??
        membership?.track_type ??
        membership?.track?.type ??
        membership?.release_track?.type ??
        ''
    )
      .trim()
      .toLowerCase()
      .includes('virtual');
  }

  viewTrack(membership: MembershipTrack, event?: Event): void {
    event?.stopPropagation();

    if (
      !this.canViewReleaseTrackDashboard ||
      !this.hasSelectedReleaseForTrack(membership)
    ) {
      return;
    }

    const trackId = this.getTrackId(membership);

    this.router.navigate(['/dashboard/release-management', trackId]);
  }

  getCurrentDraft(membership: MembershipTrack): any {
    return (
      membership?.current_draft ??
      membership?.currentDraft ??
      membership?.draft ??
      null
    );
  }

  hasCurrentDraft(membership: MembershipTrack): boolean {
    const draft = this.getCurrentDraft(membership);

    if (!draft) {
      return false;
    }

    return draft?.in_current_draft !== false && draft?.inCurrentDraft !== false;
  }

  getDraftStatusLabel(membership: MembershipTrack): string {
    const draft = this.getCurrentDraft(membership);

    const status =
      draft?.status ??
      draft?.state ??
      draft?.tier ??
      membership?.status ??
      membership?.tier ??
      'work-in-progress';

    if (this.isDraftStaged(membership)) {
      return 'Staged';
    }

    if (
      ['work-in-progress', 'wip', 'candidate', 'candidates', 'draft'].includes(
        this.normalizeStatus(status)
      )
    ) {
      return 'Work in Progress';
    }

    if (this.isDraftInReview(membership)) {
      return 'In Review';
    }

    return this.formatStatus(status);
  }

  getDraftDateLabel(membership: MembershipTrack): string {
    const draft = this.getCurrentDraft(membership);

    const date =
      draft?.updated_at ??
      draft?.updatedAt ??
      draft?.modified ??
      draft?.date ??
      draft?.created;

    return date ? `As of ${this.formatDate(date, true)}` : 'As of TBD';
  }

  isDraftInReview(membership: MembershipTrack): boolean {
    const draft = this.getCurrentDraft(membership);

    const status = this.normalizeStatus(
      draft?.status ?? draft?.state ?? membership?.status
    );

    return (
      !this.isDraftStaged(membership) &&
      ['awaiting-review', 'review', 'reviewed'].includes(status)
    );
  }

  isDraftStaged(membership: MembershipTrack): boolean {
    const draft = this.getCurrentDraft(membership);

    return [
      draft?.tier,
      draft?.state,
      draft?.status,
      membership?.tier,
      membership?.status,
    ].some(value => this.normalizeStatus(value) === 'staged');
  }

  isDraftStepActive(membership: MembershipTrack, step: string): boolean {
    const draft = this.getCurrentDraft(membership);

    const status = this.normalizeStatus(
      draft?.status ??
        draft?.state ??
        draft?.tier ??
        membership?.status ??
        membership?.tier
    );

    const normalizedStep = this.normalizeStatus(step);

    if (normalizedStep === 'work-in-progress') {
      return [
        'work-in-progress',
        'wip',
        'candidate',
        'candidates',
        'draft',
      ].includes(status);
    }

    if (normalizedStep === 'review') {
      return this.isDraftInReview(membership);
    }

    if (normalizedStep === 'staged') {
      return this.isDraftStaged(membership);
    }

    return status === normalizedStep;
  }

  getProductionReleases(membership: MembershipTrack): any[] {
    const releases =
      membership?.production_releases ??
      membership?.productionReleases ??
      membership?.releases ??
      [];

    if (!Array.isArray(releases)) {
      return [];
    }

    return [...releases].sort(
      (first, second) =>
        this.getReleaseTimestamp(second) - this.getReleaseTimestamp(first)
    );
  }

  getReleaseVersion(release: any): string {
    const version =
      this.normalizeVersionValue(release?.version) ??
      release?.name ??
      release?.title ??
      release?.release_version ??
      release?.releaseVersion ??
      release?.tag;

    if (!version) {
      return 'Release';
    }

    const value = String(version);

    return value.toLowerCase().startsWith('v') ? value : `v${value}`;
  }

  getReleaseDateLabel(release: any): string {
    const date =
      release?.released_at ??
      release?.releasedAt ??
      release?.release_date ??
      release?.releaseDate ??
      release?.tagged_at ??
      release?.taggedAt ??
      release?.modified ??
      release?.created_at ??
      release?.createdAt ??
      release?.created ??
      release?.date;

    return date ? `Released on ${this.formatDate(date)}` : 'Production release';
  }

  toggleReleaseSelection(
    release: any,
    membership: MembershipTrack,
    checked: boolean
  ): void {
    if (!release) {
      return;
    }

    const key = this.getReleaseSelectionKey(release, membership);

    if (!checked) {
      const nextSelection = new Map(this.selectedReleases);
      nextSelection.delete(key);
      this.selectedReleases = nextSelection;
      return;
    }

    if (this.selectedReleases.size >= 2) {
      return;
    }

    this.selectedReleases = new Map(this.selectedReleases).set(key, {
      key,
      release,
      membership,
    });
  }

  isReleaseSelected(release: any, membership: MembershipTrack): boolean {
    if (!release) {
      return false;
    }

    return this.selectedReleases.has(
      this.getReleaseSelectionKey(release, membership)
    );
  }

  hasSelectedReleaseForTrack(membership: MembershipTrack): boolean {
    const trackId = this.getTrackId(membership);

    return [...this.selectedReleases.values()].some(
      selection => this.getTrackId(selection.membership) === trackId
    );
  }

  clearSelection(): void {
    this.selectedReleases = new Map<string, SelectedRelease>();

    this.elementRef.nativeElement
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
      .forEach(checkbox => {
        checkbox.checked = false;
      });
  }

  compareSelectedReleases(): void {
    if (this.selectedReleaseCount !== 2) {
      return;
    }

    this.releasesCompared.emit([...this.selectedReleases.values()]);
  }

  trackByMembership(
    index: number,
    membership: MembershipTrack
  ): string | number {
    return (
      membership?.id ??
      membership?.apiId ??
      membership?.track_id ??
      membership?.name ??
      index
    );
  }

  trackByRelease(index: number, release: any): string | number {
    const version =
      release?.version?._version ??
      release?.version ??
      release?.release_version;

    return (
      release?.id ??
      release?.snapshot_id ??
      release?.modified ??
      release?.tag ??
      release?.name ??
      (Array.isArray(version) ? version.join('.') : version) ??
      index
    );
  }

  private getTrackId(membership: MembershipTrack): string {
    return String(
      membership?.id ??
        membership?.apiId ??
        membership?.track_id ??
        membership?.track?.id ??
        membership?.release_track?.id ??
        membership?.name ??
        ''
    );
  }

  private getReleaseSelectionKey(
    release: any,
    membership: MembershipTrack
  ): string {
    const membershipId =
      membership?.apiId ??
      membership?.track_id ??
      membership?.id ??
      membership?.name ??
      'release-track';

    const releaseId =
      release?.id ??
      release?.snapshot_id ??
      release?.modified ??
      this.normalizeVersionValue(release?.version) ??
      release?.tag ??
      release?.name ??
      release?.status ??
      JSON.stringify(release);

    return `${membershipId}:${releaseId}`;
  }

  private getReleaseTimestamp(release: any): number {
    const date =
      release?.released_at ??
      release?.releasedAt ??
      release?.release_date ??
      release?.releaseDate ??
      release?.modified ??
      release?.created_at ??
      release?.createdAt ??
      release?.created ??
      release?.date;

    if (!date) {
      return 0;
    }

    const timestamp = new Date(date).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private normalizeVersionValue(version: any): string | null {
    if (version === null || version === undefined) {
      return null;
    }

    if (Array.isArray(version)) {
      return version.join('.');
    }

    if (typeof version === 'object') {
      const nestedVersion =
        version._version ?? version.version ?? version.value;

      if (Array.isArray(nestedVersion)) {
        return nestedVersion.join('.');
      }

      return nestedVersion === null || nestedVersion === undefined
        ? null
        : String(nestedVersion);
    }

    return String(version);
  }

  private normalizeStatus(status: unknown): string {
    return String(status ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');
  }

  private formatStatus(status: unknown): string {
    if (!status) {
      return 'Work In Progress';
    }

    return String(status)
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, character => character.toUpperCase());
  }

  private formatDate(value: string | Date, includeTime = false): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    const options: Intl.DateTimeFormatOptions = includeTime
      ? {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }
      : {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        };

    return new Intl.DateTimeFormat('en-US', options).format(date);
  }

  private formatIdentifier(identifier: unknown): string | null {
    if (!identifier) {
      return null;
    }

    const value = String(identifier);
    const identifierName = value.includes('--') ? value.split('--')[0] : value;

    return this.formatStatus(identifierName);
  }
}
