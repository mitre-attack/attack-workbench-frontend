import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
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
});
