import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  WORKFLOW_STATUS_LABELS,
  WorkflowStatus,
  WorkflowStatusType,
} from 'src/app/utils/types';

export type WorkbenchChipVariant =
  'standard' | 'virtual' | 'tagged' | 'draft' | 'latest' | WorkflowStatusType;

const WORKBENCH_CHIP_LABELS: Record<WorkbenchChipVariant, string> = {
  standard: 'Standard',
  virtual: 'Virtual',
  tagged: 'Tagged Release',
  draft: 'Draft Release',
  latest: 'Latest',
  [WorkflowStatus.WorkInProgress]:
    WORKFLOW_STATUS_LABELS[WorkflowStatus.WorkInProgress],
  [WorkflowStatus.AwaitingReview]:
    WORKFLOW_STATUS_LABELS[WorkflowStatus.AwaitingReview],
  [WorkflowStatus.Reviewed]: WORKFLOW_STATUS_LABELS[WorkflowStatus.Reviewed],
};

@Component({
  selector: 'app-workbench-chip',
  standalone: true,
  templateUrl: './workbench-chip.component.html',
  styleUrls: ['./workbench-chip.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkbenchChipComponent {
  @Input() variant: WorkbenchChipVariant = 'standard';
  @Input() label?: string;

  public get chipClass(): string {
    return `workbench-chip workbench-chip--${this.variant}`;
  }

  public get chipLabel(): string {
    return this.label || WORKBENCH_CHIP_LABELS[this.variant];
  }
}
