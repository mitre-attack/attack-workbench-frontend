import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
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
        MatSelectModule,
        MatInputModule,
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
    expect(component.objectTypes.some(type => type.value === 'note')).toBe(
      false
    );
  });

  it('should close with a validation bypass rule payload', () => {
    component.form.patchValue({
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
  it('requires exemption selectors without requiring error fields and excludes mixed fields', () => {
    component.form.patchValue({
      kind: 'object-exemption',
      name: '   ',
      stixTypes: [],
    });
    expect(component.form.invalid).toBe(true);
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    component.form.patchValue({
      name: ' Retired tactics ',
      enabled: false,
      retirementStatus: 'deprecated',
      stixTypes: ['x-mitre-tactic'],
    });
    expect(component.form.valid).toBe(true);
    component.confirm();
    expect(close).toHaveBeenCalledWith({
      kind: 'object-exemption',
      name: 'Retired tactics',
      enabled: false,
      retirementStatus: 'deprecated',
      stixTypes: ['x-mitre-tactic'],
    });
  });

  it('normalizes All types and restores error validators when changing kinds', () => {
    component.form.patchValue({
      kind: 'object-exemption',
      name: 'All retired',
      stixTypes: ['all', 'attack-pattern'],
    });
    component.confirm();
    expect(close.mock.calls[0][0].stixTypes).toBe('all');
    component.form.patchValue({ kind: 'error-bypass' });
    expect(component.form.invalid).toBe(true);
  });
});
