import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { StixPageComponent } from './stix-page.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createAsyncObservable,
  createMockRestApiConnector,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('StixPageComponent', () => {
  let component: StixPageComponent;
  let fixture: ComponentFixture<StixPageComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllNotes: () => createAsyncObservable([]),
      getSoftware: () => createAsyncObservable([]),
      getGroup: () => createAsyncObservable([]),
      getCampaign: () => createAsyncObservable([]),
      getMatrix: () => createAsyncObservable([]),
      getMitigation: () => createAsyncObservable([]),
      getTactic: () => createAsyncObservable([]),
      getTechnique: () => createAsyncObservable([]),
      getCollection: () => createAsyncObservable([]),
      getDataSource: () => createAsyncObservable([]),
      getDataComponent: () => createAsyncObservable([]),
      getDetectionStrategy: () => createAsyncObservable([]),
      getAnalytic: () => createAsyncObservable([]),
      getAsset: () => createAsyncObservable([]),
      getMarkingDefinition: () => createAsyncObservable([]),
      deleteCollection: () => createAsyncObservable({}),
    });

    await TestBed.configureTestingModule({
      declarations: [StixPageComponent],
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
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StixPageComponent);
    component = fixture.componentInstance;
    (component as any).config = { mode: 'view', object: {} as any };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
