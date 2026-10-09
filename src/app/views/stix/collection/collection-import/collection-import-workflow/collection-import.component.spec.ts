import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, Subject } from 'rxjs';

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
  it('shows both failed preview reports and advances to the import error step', () => {
    const connector = TestBed.inject(RestApiConnectorService);
    const preview = new Subject<any>();
    connector.previewCollectionBundle = vi.fn(() => preview);
    const reports = [{ reportId: 'initial' }, { reportId: 'forced' }];
    const error = { message: 'Forced preview failed' };
    component.stepper = { next: vi.fn() } as any;
    component.loadingStep1 = true;
    component.previewCollection({ objects: [] });
    preview.next({ error, preview: undefined, exemptionReports: reports });
    preview.complete();
    expect(component.exemptionReports).toEqual(reports);
    expect(component.import_errors).toBe(error);
    expect(component.loadingStep1).toBe(false);
    expect(component.stepper.next).toHaveBeenCalledOnce();
  });
});
