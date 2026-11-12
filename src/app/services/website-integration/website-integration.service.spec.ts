import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { WebsiteIntegrationService } from './website-integration.service';

describe('WebsiteIntegrationService', () => {
  let service: WebsiteIntegrationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
          },
        },
        provideHttpClient(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    service = TestBed.inject(WebsiteIntegrationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
