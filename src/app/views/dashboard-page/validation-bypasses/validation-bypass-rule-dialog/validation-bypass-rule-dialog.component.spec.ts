import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { ValidationBypassRuleDialogComponent } from './validation-bypass-rule-dialog.component';

describe('ValidationBypassRuleDialogComponent', () => {
  let component: ValidationBypassRuleDialogComponent;
  let fixture: ComponentFixture<ValidationBypassRuleDialogComponent>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    close = vi.fn();

    await TestBed.configureTestingModule({
      declarations: [ValidationBypassRuleDialogComponent],
      imports: [
        MatAutocompleteModule,
        MatSlideToggleModule,
        ReactiveFormsModule,
      ],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: MatDialogRef, useValue: { close } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ValidationBypassRuleDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should close with a validation bypass rule payload', () => {
    component.form.setValue({
      fieldPath: 'external_references.0.external_id',
      errorCode: 'custom',
      stixType: 'x-mitre-tactic',
      suppressError: false,
      warningMessage: 'Use a custom tactic shortname warning.',
    });

    component.confirm();

    expect(close).toHaveBeenCalledWith({
      fieldPath: ['external_references', '0', 'external_id'],
      errorCode: 'custom',
      stixType: 'x-mitre-tactic',
      suppressError: false,
      warningMessage: 'Use a custom tactic shortname warning.',
    });
  });
});
