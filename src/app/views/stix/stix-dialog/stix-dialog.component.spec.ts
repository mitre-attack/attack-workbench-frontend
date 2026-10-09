import { Group } from 'src/app/classes/stix/group';
import { ValidationData } from 'src/app/classes/serializable';
import { ExemptionReport } from 'src/app/classes/validation-policy';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { DataComponent } from 'src/app/classes/stix/data-component';
import { Relationship } from 'src/app/classes/stix/relationship';
import { DeprecationService } from 'src/app/services/helpers/deprecation.service';

import { StixDialogComponent } from './stix-dialog.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('StixDialogComponent', () => {
  let component: StixDialogComponent;
  let fixture: ComponentFixture<StixDialogComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getRelatedTo: () => createAsyncObservable(createPaginatedResponse([])),
    });

    await TestBed.configureTestingModule({
      declarations: [StixDialogComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        {
          provide: AuthenticationService,
          useValue: { canEdit: () => true },
        },
        provideHttpClient(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
          },
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { mode: 'view', object: {} as any },
        },
        { provide: MatDialogRef, useValue: {} },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StixDialogComponent);
    component = fixture.componentInstance;
  });

  it('keeps diff dialogs read-only even when marked editable', () => {
    component._config = {
      mode: 'diff',
      object: [{} as any, {} as any],
      editable: true,
    };

    expect(component.config.editable).toBe(false);
  });

  it('uses the shared lifecycle check for data components and relationships', () => {
    const lifecycle = TestBed.inject(DeprecationService);
    vi.spyOn(lifecycle, 'deprecate').mockReturnValue(of(false));
    for (const object of [new DataComponent(), new Relationship()]) {
      component._config = { mode: 'view', object, editable: true };
      component.deprecateChanged();
      expect(object.deprecated).toBe(false);
      expect(component.loading).toBe(false);
      expect(component.dirty).toBe(false);
    }
  });
  it('replaces preview evidence with actual save evidence and preserves successful dialog completion', () => {
    const object = new Group();
    const saved = new Subject<Group>();
    vi.spyOn(object, 'save').mockReturnValue(saved);
    const preview: ExemptionReport = { reportId: 'preview', policyRevision: 1 };
    const actual: ExemptionReport = {
      reportId: 'actual-save',
      policyRevision: 2,
      state: 'completed',
    };
    component._config = { mode: 'view', object, is_new: true };
    component.validation = new ValidationData();
    component.validation.exemptionReports = [preview];
    component.dirty = true;
    component.dialogRef.close = vi.fn();
    const stopEditing = vi.spyOn(
      component.editorService.onEditingStopped,
      'emit'
    );
    const validate = vi.spyOn(object, 'validate');
    expect(component.saveEnabled).toBe(true);
    component.save();
    expect(component.validation.exemptionReports).toEqual([]);
    const result = new Group();
    result.exemptionReport = actual;
    saved.next(result);
    saved.complete();
    expect(component.saveReport).toBe(actual);
    expect(component.validation.exemptionReports).toEqual([actual]);
    expect(object.exemptionReport).toBe(actual);
    expect(component.saveEnabled).toBe(true);
    expect(stopEditing).toHaveBeenCalledOnce();
    expect(component.dialogRef.close).toHaveBeenCalledWith(true);
    expect(component._config.is_new).toBe(false);
    expect(validate).not.toHaveBeenCalled();
  });
  it('retains partial failed save evidence without closing the dialog or changing save gates', () => {
    const object = new DataComponent();
    const saved = new Subject<DataComponent>();
    vi.spyOn(object, 'save').mockReturnValue(saved);
    const actual: ExemptionReport = {
      reportId: 'failed-save',
      policyRevision: 2,
      state: 'partial',
    };
    component._config = { mode: 'view', object };
    component.validation = new ValidationData();
    component.validation.exemptionReports = [{ reportId: 'preview' }];
    component.validation.warnings = [
      { result: 'warning', field: 'description', message: 'Existing warning' },
    ];
    component.validating = true;
    component.editing = true;
    component.dialogRef.close = vi.fn();
    component.save();
    saved.error({ status: 400, error: { exemptionReport: actual } });
    expect(component.saveReport).toBe(actual);
    expect(component.validation.exemptionReports).toEqual([actual]);
    expect(component.validation.warnings).toHaveLength(1);
    expect(component.saveEnabled).toBe(true);
    expect(component.dialogRef.close).not.toHaveBeenCalled();
    expect(component.validating).toBe(true);
  });
  it('keeps actual evidence when a successful data-component save returns to its view', () => {
    const object = new DataComponent();
    const saved = new Subject<DataComponent>();
    vi.spyOn(object, 'save').mockReturnValue(saved);
    const actual: ExemptionReport = {
      reportId: 'data-component-save',
      state: 'completed',
    };
    component._config = { mode: 'view', object };
    component.validation = new ValidationData();
    component.validating = true;
    component.editing = true;
    component.dialogRef.close = vi.fn();
    component.save();
    const result = new DataComponent();
    result.exemptionReport = actual;
    saved.next(result);
    saved.complete();
    expect(component.saveReport).toBe(actual);
    expect(component.validating).toBe(false);
    expect(component.editing).toBe(false);
    expect(component.dialogRef.close).not.toHaveBeenCalled();
  });
});
