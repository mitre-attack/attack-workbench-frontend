import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { DetectionStrategyViewComponent } from './detection-strategy-view.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('DetectionStrategyViewComponent', () => {
  let component: DetectionStrategyViewComponent;
  let fixture: ComponentFixture<DetectionStrategyViewComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getDefaultMarkingDefinitions: () => createAsyncObservable([]),
      getAllAnalytics: () => createAsyncObservable(createPaginatedResponse()),
    });

    await TestBed.configureTestingModule({
      declarations: [DetectionStrategyViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DetectionStrategyViewComponent);
    component = fixture.componentInstance;
    component.config = { mode: 'view', object: {} as any };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
