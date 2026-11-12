import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { Mock } from 'vitest';
import {
  AllowedValueCatalog,
  AllowedValueRule,
  RestApiConnectorService,
} from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AllowedValueDialogComponent } from './allowed-value-dialog.component';

// Exercise draft transactions independently of Material rendering.
describe('AllowedValueDialogComponent', () => {
  let rule: AllowedValueRule;
  let catalog: AllowedValueCatalog;
  let response: Subject<AllowedValueRule>;
  let validation: Subject<{ value: string }>;
  let putRule: Mock;
  let postRule: Mock;
  let validateValue: Mock;
  let close: Mock;
  let component: AllowedValueDialogComponent;

  function createDialog(editing = true): AllowedValueDialogComponent {
    // The transaction uses only these dependency methods.
    const dialogRef = {
      close,
      disableClose: false,
    } as MatDialogRef<AllowedValueDialogComponent>;
    const api = {
      putAllowedValueRule: putRule,
      postAllowedValueRule: postRule,
      validateAllowedValue: validateValue,
    } as unknown as RestApiConnectorService;
    return new AllowedValueDialogComponent(
      { catalog, rules: [rule], rule: editing ? rule : undefined },
      dialogRef,
      new FormBuilder(),
      api
    );
  }

  beforeEach(() => {
    rule = {
      propertyName: 'x_mitre_platforms',
      domainName: 'enterprise-attack',
      objectTypes: ['technique', 'software'],
      values: [
        { value: 'Linux', enabled: true, objectTypes: ['technique'] },
        { value: 'Linux', enabled: false, objectTypes: ['software'] },
      ],
      invalidValues: [],
    };
    catalog = {
      admVersion: '4.11.7',
      rules: [
        {
          propertyName: rule.propertyName,
          domainName: rule.domainName,
          objectTypes: rule.objectTypes,
          valueType: 'enum',
          description: 'Platforms supported by the ADM.',
          choices: [
            { value: 'Linux', objectTypes: rule.objectTypes },
            { value: 'Windows', objectTypes: ['technique'] },
          ],
        },
        {
          propertyName: 'x_mitre_data_sources',
          domainName: 'enterprise-attack',
          objectTypes: ['technique'],
          valueType: 'formatted',
          description: 'Data source and component.',
          choices: [],
        },
      ],
    };
    response = new Subject<AllowedValueRule>();
    validation = new Subject<{ value: string }>();
    putRule = vi.fn(() => response.asObservable());
    postRule = vi.fn(() => response.asObservable());
    validateValue = vi.fn(() => validation.asObservable());
    close = vi.fn();
    component = createDialog();
  });

  it('preserves draft settings across object types and serializes disjoint states', () => {
    component.setEnabled('Windows', true);
    component.selectObjectType('software');
    expect(component.state('Linux')).toBe(false);
    component.removeValue('Linux');
    component.setEnabled('Linux', true);
    component.selectObjectType('technique');
    expect(component.state('Windows')).toBe(true);
    component.setEnabled('Linux', false);
    component.confirm();

    expect(putRule).toHaveBeenCalledWith(rule.propertyName, rule.domainName, [
      { value: 'Linux', enabled: false, objectTypes: ['technique'] },
      { value: 'Windows', enabled: true, objectTypes: ['technique'] },
      { value: 'Linux', enabled: true, objectTypes: ['software'] },
    ]);
    expect(rule.values[0].enabled).toBe(true);
    expect(rule.values[1].enabled).toBe(false);
  });

  it('discards changes on cancel without changing the original configuration', () => {
    const original = structuredClone(rule);
    component.removeValue('Linux');
    component.setEnabled('Windows', true);
    component.selectObjectType('software');
    component.setEnabled('Linux', true);
    component.cancel();

    expect(rule).toEqual(original);
    expect(putRule).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith();
  });

  it('rejects enum choices outside the selected ADM scope, including legacy invalid settings', () => {
    rule.invalidValues = [
      {
        value: 'Unsupported',
        enabled: true,
        objectTypes: ['software'],
        reason: 'Not an ADM platform',
      },
    ];
    component = createDialog();
    component.selectObjectType('software');
    component.setEnabled('Unsupported', true);
    component.setEnabled('Windows', true);
    expect(component.visibleChoices).toEqual(['Linux']);
    component.confirm();
    expect(putRule).toHaveBeenCalledWith(
      rule.propertyName,
      rule.domainName,
      rule.values
    );
    expect(rule.invalidValues).toHaveLength(1);
  });

  it('keeps other object types when removing a shared setting', () => {
    rule.values = [
      { value: 'Linux', enabled: true, objectTypes: ['technique', 'software'] },
    ];
    component = createDialog();
    component.removeValue('Linux');
    component.confirm();
    expect(putRule).toHaveBeenCalledWith(rule.propertyName, rule.domainName, [
      { value: 'Linux', enabled: true, objectTypes: ['software'] },
    ]);
  });

  it('keeps a failed draft and blocks concurrent saves and edits until retry', () => {
    component.setEnabled('Windows', true);
    component.confirm();
    component.confirm();
    component.removeValue('Windows');
    component.cancel();
    expect(putRule).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    response.error(
      new HttpErrorResponse({ status: 409, error: { message: 'Conflict' } })
    );
    expect(component.error).toBe('Conflict');
    expect(component.saving).toBe(false);
    expect(component.state('Windows')).toBe(true);

    response = new Subject<AllowedValueRule>();
    component.confirm();
    const saved = { ...rule, values: component.values };
    response.next(saved);
    expect(putRule).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledWith(saved);
  });

  it('opens an existing group at the chosen type instead of creating a duplicate', () => {
    component = createDialog(false);
    component.selectProperty(rule.propertyName);
    component.selectDomain(rule.domainName);
    component.selectObjectType('software');
    component.confirm();
    expect(postRule).not.toHaveBeenCalled();
    component.openExisting();
    expect(component.objectType).toBe('software');
    expect(component.state('Linux')).toBe(false);
    component.setEnabled('Linux', true);
    component.confirm();
    expect(putRule).toHaveBeenCalledWith(rule.propertyName, rule.domainName, [
      { value: 'Linux', enabled: true, objectTypes: ['technique', 'software'] },
    ]);
  });

  it('blocks pending and rejected formatted input, then creates only after backend approval', () => {
    component = createDialog(false);
    component.selectProperty('x_mitre_data_sources');
    component.selectDomain('enterprise-attack');
    component.selectObjectType('technique');
    component.formatted.setValue({ source: 'Invalid', component: 'Component' });
    component.confirm();
    expect(postRule).not.toHaveBeenCalled();
    component.addFormatted();
    component.confirm();
    component.addFormatted();
    expect(validateValue).toHaveBeenCalledTimes(1);
    expect(postRule).not.toHaveBeenCalled();
    validation.error(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'Invalid data source' },
      })
    );
    expect(component.error).toBe('Invalid data source');
    expect(component.values).toEqual([]);
    component.confirm();
    expect(postRule).not.toHaveBeenCalled();

    validation = new Subject<{ value: string }>();
    component.formatted.setValue({
      source: ' Process ',
      component: ' Process Creation ',
    });
    component.addFormatted();
    expect(validateValue).toHaveBeenLastCalledWith(
      'x_mitre_data_sources',
      'enterprise-attack',
      ['technique'],
      'Process: Process Creation'
    );
    validation.next({ value: 'Process: Process Creation' });
    component.confirm();
    const values = [
      {
        value: 'Process: Process Creation',
        enabled: true,
        objectTypes: ['technique'],
      },
    ];
    expect(postRule).toHaveBeenCalledWith(
      'x_mitre_data_sources',
      'enterprise-attack',
      values
    );
    expect(close).not.toHaveBeenCalled();
    const saved = {
      propertyName: 'x_mitre_data_sources',
      domainName: 'enterprise-attack',
      objectTypes: ['technique'],
      values,
      invalidValues: [],
    };
    response.next(saved);
    expect(close).toHaveBeenCalledWith(saved);
  });

  it('creates a new catalog scope with only the chosen object type', () => {
    catalog.rules.push({ ...catalog.rules[0], domainName: 'ics-attack' });
    component = createDialog(false);
    component.selectProperty(rule.propertyName);
    component.selectDomain('ics-attack');
    component.selectObjectType('technique');
    component.setEnabled('Windows', true);
    component.selectObjectType('software');
    component.setEnabled('Linux', true);
    component.selectObjectType('technique');
    expect(component.state('Windows')).toBe(true);
    component.selectObjectType('software');
    component.confirm();
    expect(postRule).toHaveBeenCalledWith(rule.propertyName, 'ics-attack', [
      { value: 'Linux', enabled: true, objectTypes: ['software'] },
    ]);
  });

  it('allows empty configured groups and never falls back when a catalog scope is missing', () => {
    component.removeValue('Linux');
    component.selectObjectType('software');
    component.removeValue('Linux');
    component.confirm();
    expect(putRule).toHaveBeenCalledWith(
      rule.propertyName,
      rule.domainName,
      []
    );
    putRule.mockClear();
    catalog.rules = [];
    component = createDialog();
    component.setEnabled('Linux', true);
    component.confirm();
    expect(component.canSave).toBe(false);
    expect(putRule).not.toHaveBeenCalled();
  });
});
