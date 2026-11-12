import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { MitigationViewComponent } from './mitigation-view.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('MitigationViewComponent', () => {
  let component: MitigationViewComponent;
  let fixture: ComponentFixture<MitigationViewComponent>;

  beforeEach(waitForAsync(() => {
    const mockRestApiConnector = createMockRestApiConnector({
      getDefaultMarkingDefinitions: () => createAsyncObservable([]),
    });

    TestBed.configureTestingModule({
      declarations: [MitigationViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MitigationViewComponent);
    component = fixture.componentInstance;
    component.config = { mode: 'view', object: {} as any };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
