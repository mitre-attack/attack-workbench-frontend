import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StixTypeToAttackType } from 'src/app/utils/type-mappings';
import { StixType, WorkflowStatusType } from 'src/app/utils/types';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';

export type ReleaseTrackDiffTarget = 'staged' | 'members';

export interface ReleaseTrackDiffOption {
  value: ReleaseTrackDiffTarget;
  label: string;
}

export interface ReleaseTrackObjectItem {
  object_ref: string;
  object_modified?: Date | string;
  object_status?: WorkflowStatusType;
  object_added_at?: Date | string;
  object_added_by?: string;
  object_staged_at?: Date | string;
  object_staged_by?: string;
  diff_options?: ReleaseTrackDiffOption[];
  diff_target?: ReleaseTrackDiffTarget;
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
  @Input() showModifiedMeta = true;
  @Input() diffOptions: ReleaseTrackDiffOption[] | null = null;

  @Output() viewObject = new EventEmitter<ReleaseTrackObjectItem>();
  @Output() diffObject = new EventEmitter<ReleaseTrackObjectItem>();

  public get title(): string {
    return this.item?.name || this.fallbackObjectLabel;
  }

  public get subtitle(): string {
    return this.item?.attackId || '<<ATT&CK ID>>';
  }

  public get description(): string {
    const description = this.item?.description || 'No description available.';
    return this.firstParagraph(description);
  }

  public get modified(): Date | string | null {
    return this.item?.object_modified || null;
  }

  public get modifiedByName(): string {
    return this.item?.modified_by_user || 'Unknown User';
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

  // Hide Diff entirely when the parent says it is unavailable for this item.
  public get canShowDiffButton(): boolean {
    return this.showDiff && (!this.diffOptions || this.diffOptions.length > 0);
  }

  // Switch from a direct button to a dropdown trigger when more than one baseline exists.
  public get hasMultipleDiffOptions(): boolean {
    return (this.diffOptions?.length ?? 0) > 1;
  }

  // Emit the only valid baseline immediately so one-option diffing stays one click.
  public onDiffButtonClick(): void {
    if (!this.canShowDiffButton || this.hasMultipleDiffOptions) return;

    this.diffObject.emit({
      ...this.item,
      diff_target: this.diffOptions?.[0]?.value,
    });
  }

  // Preserve the user's menu choice by attaching the selected baseline to the emitted item.
  public onSelectDiffOption(option: ReleaseTrackDiffOption): void {
    this.diffObject.emit({
      ...this.item,
      diff_target: option.value,
    });
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
}
