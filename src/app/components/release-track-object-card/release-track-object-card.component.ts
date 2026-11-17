import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import moment from 'moment';
import { MarkdownModule } from 'ngx-markdown';
import { StixTypeToAttackType } from 'src/app/utils/type-mappings';
import { StixType, WorkflowStatusType } from 'src/app/utils/types';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';
import type { TierEntryModifiedByUser } from 'src/app/classes/release-tracks';
import { ReleaseTrackDiffOption } from 'src/app/classes/release-track-diff';

export interface ReleaseTrackObjectItem {
  object_ref: string;
  object_modified?: Date | string;
  object_status?: WorkflowStatusType;
  object_added_at?: Date | string;
  object_added_by?: string;
  object_staged_at?: Date | string;
  object_staged_by?: string;
  attack_id?: string;
  name?: string;
  description?: string;
  modified_by_user?: TierEntryModifiedByUser;
  [key: string]: any;
}

@Component({
  selector: 'app-release-track-object-card',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MarkdownModule,
    UserAvatarComponent,
  ],
  templateUrl: './release-track-object-card.component.html',
  styleUrls: ['./release-track-object-card.component.scss'],
})
export class ReleaseTrackObjectCardComponent {
  @Input({ required: true }) item!: ReleaseTrackObjectItem;
  @Input() cardType: string | null = null;
  @Input() laneStatus: WorkflowStatusType | null = null;
  @Input() showDescription = true;
  @Input() showDiff = true;
  @Input() diffDisabled = false;
  @Input() diffDisabledMessage = '';
  @Input() diffOptions: ReleaseTrackDiffOption[] = [];
  @Input() diffLoading = false;
  @Input() diffError = false;
  @Input() showModifiedMeta = true;

  @Output() viewObject = new EventEmitter<ReleaseTrackObjectItem>();
  @Output() diffObject = new EventEmitter<{
    item: ReleaseTrackObjectItem;
    option: ReleaseTrackDiffOption;
  }>();

  public get title(): string {
    return (
      this.item?.name || this.item?.object_name || this.fallbackObjectLabel
    );
  }

  public get subtitle(): string {
    return this.item?.attack_id || this.item?.attackId || '<<ATT&CK ID>>';
  }

  public get description(): string {
    const description =
      this.item?.description ||
      this.item?.object_description ||
      'No description available.';
    return this.firstParagraph(description);
  }

  public get modified(): Date | string | null {
    return (
      this.item?.resolved_object_modified || this.item?.object_modified || null
    );
  }

  public get modifiedHumanized(): string {
    if (!this.modified) return 'Unknown';
    const now = moment();
    const then = moment(this.modified);
    const difference = moment.duration(then.diff(now));
    return difference.asWeeks() > -1
      ? difference.humanize(true)
      : then.format('D MMMM YYYY');
  }

  public get modifiedTimestamp(): string {
    if (!this.modified) return '';
    return moment(this.modified).format('D MMMM YYYY, h:mm A');
  }

  public get modifiedByName(): string {
    return (
      this.userDisplayName(this.item?.modified_by_user, false) ||
      this.userDisplayName(
        this.item?.object_modified_by ||
          this.item?.object_added_by ||
          this.item?.object_staged_by ||
          this.item?.modified_by_ref
      ) ||
      'Unknown User'
    );
  }

  public get cardClasses(): Record<string, boolean> {
    return {
      [`status-${this.laneStatus}`]: !!this.laneStatus,
      [`is-${this.cardType}`]: !!this.cardType,
      'has-description': this.showDescription,
    };
  }

  public onView(): void {
    this.viewObject.emit(this.item);
  }

  /**
   * Emit the card's object and the selected comparison choice. Ignore selections
   * when comparisons are disabled or the option is no longer available.
   *
   * @param option The comparison choice clicked in the menu.
   */
  public onDiff(option: ReleaseTrackDiffOption): void {
    const selected = this.diffOptions.find(entry => entry.id === option.id);
    if (this.diffDisabled || !selected) return;
    this.diffObject.emit({ item: this.item, option: selected });
  }

  /**
   * Identify menu entries so Angular can preserve them when the list updates.
   *
   * @param _index The entry's list position, supplied by Angular and unused here.
   * @param option The comparison choice being rendered.
   * @returns The option's stable ID; this does not select the option.
   */
  public trackDiffOption(
    _index: number,
    option: ReleaseTrackDiffOption
  ): string {
    return option.id;
  }

  private get fallbackObjectLabel(): string {
    const [type, id] = (this.item?.object_ref || '').split('--');
    if (!type || !id) return this.item?.object_ref || 'Unknown object';
    return `${this.toDisplayLabel(type as StixType)} ${id.slice(0, 8)}`;
  }

  private toDisplayLabel(value: StixType): string {
    if (!value) return '';
    return StixTypeToAttackType[value]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  private firstParagraph(value: string): string {
    const [paragraph] = value
      .replace(/\r\n/g, '\n')
      .split(/\n\s*\n|\n/)
      .map(part => part.trim())
      .filter(Boolean);
    return paragraph || 'No description available.';
  }

  private userDisplayName(value: any, includeId = true): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;

    return (
      value.displayName ||
      value.username ||
      value.name ||
      (includeId ? value.id : null)
    );
  }
}
