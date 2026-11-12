import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { CollectionImportComponent } from './collection-import.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('CollectionImportComponent', () => {
  let component: CollectionImportComponent;
  let fixture: ComponentFixture<CollectionImportComponent>;

  beforeEach(waitForAsync(() => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllCollections: () => createAsyncObservable(createPaginatedResponse()),
      getAllMarkingDefinitions: () =>
        createAsyncObservable(createPaginatedResponse()),
    });

    TestBed.configureTestingModule({
      declarations: [CollectionImportComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
          },
        },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CollectionImportComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
