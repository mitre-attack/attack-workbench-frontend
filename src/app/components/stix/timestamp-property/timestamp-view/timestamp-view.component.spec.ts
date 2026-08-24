import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { TimestampViewComponent } from './timestamp-view.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { createMockRestApiConnector } from 'src/app/testing/mocks/rest-api-connector.mock';

describe('TimestampViewComponent', () => {
  let component: TimestampViewComponent;
  let fixture: ComponentFixture<TimestampViewComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({});

    await TestBed.configureTestingModule({
      declarations: [TimestampViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TimestampViewComponent);
    component = fixture.componentInstance;
    component.config = { mode: 'view', object: {} as any, field: 'created' };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
