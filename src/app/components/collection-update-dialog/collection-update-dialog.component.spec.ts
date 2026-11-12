import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
} from 'src/app/testing/mocks/rest-api-connector.mock';
import { CollectionUpdateDialogComponent } from './collection-update-dialog.component';

describe('CollectionUpdateDialogComponent', () => {
  let component: CollectionUpdateDialogComponent;
  let fixture: ComponentFixture<CollectionUpdateDialogComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getTacticsRelatedToTechnique: () => createAsyncObservable([]),
    });

    await TestBed.configureTestingModule({
      declarations: [CollectionUpdateDialogComponent],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        { provide: MatDialogRef, useValue: {} },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            collectionChanges: {
              technique: { flatten: () => [] },
            },
          },
        },
        provideHttpClient(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CollectionUpdateDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
