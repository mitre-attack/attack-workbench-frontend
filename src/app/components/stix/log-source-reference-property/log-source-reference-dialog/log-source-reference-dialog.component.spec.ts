import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { LogSourceReferenceDialogComponent } from './log-source-reference-dialog.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('LogSourceReferenceDialogComponent', () => {
  let component: LogSourceReferenceDialogComponent;
  let fixture: ComponentFixture<LogSourceReferenceDialogComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllDataComponents: () =>
        createAsyncObservable(createPaginatedResponse([])),
      getDataComponent: () => createAsyncObservable([]),
    });

    await TestBed.configureTestingModule({
      declarations: [LogSourceReferenceDialogComponent],
      imports: [MatAutocompleteModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        { provide: MatDialogRef, useValue: {} },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { object: { logSourceReferences: [] } },
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LogSourceReferenceDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
