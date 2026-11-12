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
      fieldPath: [
        this.fieldPathToString(rule?.fieldPath),
        [Validators.required, fieldPathValidator],
      ],
      errorCode: [rule?.errorCode || '', Validators.required],
      stixType: [rule?.stixType || '', Validators.required],
      suppressError: [rule?.suppressError ?? true],
      warningMessage: [rule?.warningMessage || ''],
    });
  }

  public hasError(controlName: string, errorName: string): boolean {
    return !!this.form.get(controlName)?.hasError(errorName);
  }

  public confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.value;
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
