import { Component, Inject, ViewEncapsulation } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ValidationBypassRule } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { StixTypeToAttackType } from 'src/app/utils/type-mappings';

export interface ValidationBypassRuleDialogData {
  rule?: ValidationBypassRule;
}

function parseFieldPath(value: string): string[] {
  const trimmed = (value || '').trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map(String)
          .map(part => part.trim())
          .filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return trimmed
    .split('.')
    .map(part => part.trim())
    .filter(Boolean);
}

function fieldPathValidator(control: AbstractControl): ValidationErrors | null {
  return parseFieldPath(control.value).length ? null : { fieldPath: true };
}

@Component({
  selector: 'app-validation-bypass-rule-dialog',
  templateUrl: './validation-bypass-rule-dialog.component.html',
  styleUrls: ['./validation-bypass-rule-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class ValidationBypassRuleDialogComponent {
  public form: FormGroup;
  public stixTypes = ['all', ...Object.keys(StixTypeToAttackType).sort()];
  public objectTypes = Object.entries(StixTypeToAttackType)
    .filter(([value]) => value !== 'note')
    .map(([value, label]) => ({
      value,
      label: label === 'software' ? `software (${value})` : label,
    }));
  public errorCodes = [
    'custom',
    'invalid_type',
    'invalid_value',
    'invalid_format',
    'invalid_union',
    'unrecognized_keys',
    'too_big',
    'too_small',
    'not_multiple_of',
    'invalid_key',
    'invalid_element',
  ];

  public get title(): string {
    return this.data?.rule ? 'Edit Validation Bypass Rule' : 'Create Rule';
  }

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ValidationBypassRuleDialogData,
    public dialogRef: MatDialogRef<ValidationBypassRuleDialogComponent>,
    private formBuilder: FormBuilder
  ) {
    const rule = data?.rule;
    this.form = this.formBuilder.group({
      kind: [rule?.kind || 'error-bypass'],
      name: [rule?.name || ''],
      enabled: [rule?.enabled ?? true],
      retirementStatus: [rule?.retirementStatus || 'revoked'],
      stixTypes: [
        rule?.stixTypes === 'all' || !rule?.stixTypes
          ? ['all']
          : rule.stixTypes,
      ],
      fieldPath: [
        this.fieldPathToString(rule?.fieldPath),
        [Validators.required, fieldPathValidator],
      ],
      errorCode: [rule?.errorCode || '', Validators.required],
      stixType: [rule?.stixType || '', Validators.required],
      suppressError: [rule?.suppressError ?? true],
      warningMessage: [rule?.warningMessage || ''],
    });
    if (rule) this.form.get('kind').disable();
    this.configureValidators();
    this.form
      .get('kind')
      .valueChanges.subscribe(() => this.configureValidators());
  }

  public get isExemption(): boolean {
    return this.form.get('kind').value === 'object-exemption';
  }

  private configureValidators(): void {
    for (const name of ['fieldPath', 'errorCode', 'stixType']) {
      const control = this.form.get(name);
      control.setValidators(
        this.isExemption
          ? []
          : name === 'fieldPath'
            ? [Validators.required, fieldPathValidator]
            : [Validators.required]
      );
      control.updateValueAndValidity();
    }
    for (const name of ['name', 'retirementStatus', 'stixTypes']) {
      const control = this.form.get(name);
      control.setValidators(
        this.isExemption
          ? name === 'name'
            ? [
                Validators.required,
                Validators.pattern(/\S/),
                Validators.maxLength(200),
              ]
            : [Validators.required]
          : []
      );
      control.updateValueAndValidity();
    }
  }

  public hasError(controlName: string, errorName: string): boolean {
    return !!this.form.get(controlName)?.hasError(errorName);
  }

  public confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (this.isExemption) {
      this.dialogRef.close({
        kind: 'object-exemption',
        name: value.name.trim(),
        enabled: value.enabled,
        retirementStatus: value.retirementStatus,
        stixTypes: value.stixTypes.includes('all') ? 'all' : value.stixTypes,
      } satisfies ValidationBypassRule);
      return;
    }
    const warningMessage = value.warningMessage?.trim();
    const result: ValidationBypassRule = {
      fieldPath: parseFieldPath(value.fieldPath),
      errorCode: value.errorCode.trim(),
      stixType: value.stixType.trim(),
      suppressError: !!value.suppressError,
      warningMessage: warningMessage || null,
    };

    this.dialogRef.close(result);
  }

  public cancel(): void {
    this.dialogRef.close();
  }

  private fieldPathToString(fieldPath?: string[]): string {
    return fieldPath?.length ? fieldPath.join('.') : '';
  }
}
