import { Component, Input } from '@angular/core';
import { WorkbenchChipVariant } from '../workbench-chip/workbench-chip.component';
import {
  WorkflowStatus,
  WorkflowStatusMap,
  WorkflowStatusType,
} from '../../utils/types';

@Component({
  selector: 'app-status-chip',
  standalone: false,
  templateUrl: './status-chip.component.html',
  styleUrls: ['./status-chip.component.scss'],
})
export class StatusChipComponent {
  @Input() status!: WorkflowStatusType;

  public get label(): string {
    return WorkflowStatusMap[this.status] ?? String(this.status);
  }

  public get chipVariant(): WorkbenchChipVariant {
    return Object.values(WorkflowStatus).includes(this.status)
      ? this.status
      : 'draft';
  }
}
