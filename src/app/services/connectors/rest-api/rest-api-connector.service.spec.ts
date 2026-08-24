import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { RestApiConnectorService } from './rest-api-connector.service';

describe('RestApiConnectorService', () => {
  let service: RestApiConnectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
      schemas: [NO_ERRORS_SCHEMA],
    });
    service = TestBed.inject(RestApiConnectorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
