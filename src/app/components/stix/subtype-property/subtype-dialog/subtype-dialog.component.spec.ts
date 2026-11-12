import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { SubtypeDialogComponent } from './subtype-dialog.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('SubtypeDialogComponent', () => {
  let component: SubtypeDialogComponent;
  let fixture: ComponentFixture<SubtypeDialogComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllAllowedValues: () => createAsyncObservable([]),
    });

    await TestBed.configureTestingModule({
      declarations: [SubtypeDialogComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        provideHttpClient(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
          },
        },
        { provide: MatDialogRef, useValue: {} },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            subtypeFields: [],
            object: { attackType: 'test-type' },
            field: 'testField',
          },
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubtypeDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
