import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import * as globals from '../../utils/globals';
import { BuildInfoService } from './build-info.service';

describe('BuildInfoService', () => {
  let service: BuildInfoService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BuildInfoService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should load frontend and REST API build information', async () => {
    const frontend = {
      name: 'attack-workbench-frontend',
      version: '4.20.0-beta.23',
      gitCommit: 'frontend-commit',
      buildDate: '2026-08-05T15:13:49.915Z',
    };
    const restApi = {
      name: 'attack-workbench-rest-api',
      version: '4.20.0-beta.22',
      gitCommit: 'rest-api-commit',
      buildDate: '2026-08-04T15:13:49.915Z',
      attackSpecVersion: '3.3.0',
    };

    const result = firstValueFrom(service.getBuildInfo());

    httpTestingController.expectOne('/assets/build-info.json').flush(frontend);
    httpTestingController
      .expectOne(
        `${environment.integrations.rest_api.url}/config/system-version`
      )
      .flush(restApi);

    await expect(result).resolves.toEqual({ frontend, restApi });
  });

  it('should use safe fallbacks when build information is unavailable', async () => {
    const result = firstValueFrom(service.getBuildInfo());

    httpTestingController
      .expectOne('/assets/build-info.json')
      .flush('missing', { status: 404, statusText: 'Not Found' });
    httpTestingController
      .expectOne(
        `${environment.integrations.rest_api.url}/config/system-version`
      )
      .flush('unavailable', { status: 503, statusText: 'Unavailable' });

    await expect(result).resolves.toEqual({
      frontend: {
        name: globals.appName,
        version: globals.appVersion,
        gitCommit: 'unknown',
        buildDate: 'unknown',
      },
      restApi: {
        name: 'attack-workbench-rest-api',
        version: 'unknown',
        gitCommit: 'unknown',
        buildDate: 'unknown',
      },
    });
  });
});
