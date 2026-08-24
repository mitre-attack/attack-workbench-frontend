import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient } from '@angular/common/http';

import { ReferenceEditDialogComponent } from './reference-edit-dialog.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('ReferenceEditDialogComponent', () => {
  let component: ReferenceEditDialogComponent;
  let fixture: ComponentFixture<ReferenceEditDialogComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllReferences: () =>
        createAsyncObservable(createPaginatedResponse([])),
      getRelatedTo: () => createAsyncObservable(createPaginatedResponse([])),
      putReference: () => createAsyncObservable({}),
      postReference: () => createAsyncObservable({}),
    });

    await TestBed.configureTestingModule({
      declarations: [ReferenceEditDialogComponent],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            mode: 'view',
          },
        },
        {
          provide: MatDialogRef,
          useValue: {
            close: () => {},
          },
        },
        provideHttpClient(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ReferenceEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
