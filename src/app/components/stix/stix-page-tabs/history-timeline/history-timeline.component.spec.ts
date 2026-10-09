import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { HistoryTimelineComponent } from './history-timeline.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('HistoryTimelineComponent', () => {
  let component: HistoryTimelineComponent;
  let fixture: ComponentFixture<HistoryTimelineComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getSoftware: () => createAsyncObservable([]),
      getGroup: () => createAsyncObservable([]),
      getMatrix: () => createAsyncObservable([]),
      getMitigation: () => createAsyncObservable([]),
      getTactic: () => createAsyncObservable([]),
      getCampaign: () => createAsyncObservable([]),
      getTechnique: () => createAsyncObservable([]),
      getCollection: () => createAsyncObservable([]),
      getDataSource: () => createAsyncObservable([]),
      getDataComponent: () => createAsyncObservable([]),
      getAsset: () => createAsyncObservable([]),
      getAnalytic: () => createAsyncObservable([]),
      getDetectionStrategy: () => createAsyncObservable([]),
      getRelatedTo: () => createAsyncObservable(createPaginatedResponse([])),
      getAllCollections: () =>
        createAsyncObservable(createPaginatedResponse([])),
    });

    await TestBed.configureTestingModule({
      declarations: [HistoryTimelineComponent],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
          },
        },
        {
          provide: Router,
          useValue: {
            url: '/technique/mock-stix-id?param=value',
            events: of({}),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HistoryTimelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
