import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkbenchChipComponent } from '../workbench-chip/workbench-chip.component';
import { StatusChipComponent } from './status-chip.component';
import { WorkflowStatus } from 'src/app/utils/types';

describe('StatusChipComponent', () => {
  let component: StatusChipComponent;
  let fixture: ComponentFixture<StatusChipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StatusChipComponent],
      imports: [WorkbenchChipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusChipComponent);
    component = fixture.componentInstance;
    component.status = WorkflowStatus.WorkInProgress;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should map workflow statuses to the shared chip variants', () => {
    component.status = WorkflowStatus.AwaitingReview;

    expect(component.chipVariant).toBe('awaiting-review');
    expect(component.label).toBe('Awaiting Review');
  });
});
