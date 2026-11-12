import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkbenchChipComponent } from './workbench-chip.component';

describe('WorkbenchChipComponent', () => {
  let component: WorkbenchChipComponent;
  let fixture: ComponentFixture<WorkbenchChipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkbenchChipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkbenchChipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should use the default label for the selected variant', () => {
    component.variant = 'virtual';

    expect(component.chipLabel).toBe('Virtual');
  });

  it('should allow a custom label', () => {
    component.label = 'Preview';

    expect(component.chipLabel).toBe('Preview');
  });
});
