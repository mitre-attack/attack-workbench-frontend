import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import * as globals from '../../utils/globals';

export interface BuildInfo {
  name: string;
  version: string;
  gitCommit: string;
  buildDate: string;
  attackSpecVersion?: string;
}

export interface WorkbenchBuildInfo {
  frontend: BuildInfo;
  restApi: BuildInfo;
}

@Injectable({
  providedIn: 'root',
})
export class BuildInfoService {
  private buildInfoRequest?: Observable<WorkbenchBuildInfo>;

  private readonly frontendFallback: BuildInfo = {
    name: globals.appName,
    version: globals.appVersion,
    gitCommit: 'unknown',
    buildDate: 'unknown',
  };

  private readonly restApiFallback: BuildInfo = {
    name: 'attack-workbench-rest-api',
    version: 'unknown',
    gitCommit: 'unknown',
    buildDate: 'unknown',
  };

  constructor(private http: HttpClient) {}

  public getBuildInfo(): Observable<WorkbenchBuildInfo> {
    if (!this.buildInfoRequest) {
      this.buildInfoRequest = forkJoin({
        frontend: this.http
          .get<BuildInfo>('/assets/build-info.json')
          .pipe(catchError(() => of(this.frontendFallback))),
        restApi: this.http
          .get<BuildInfo>(
            `${environment.integrations.rest_api.url}/config/system-version`
          )
          .pipe(catchError(() => of(this.restApiFallback))),
      }).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }

    return this.buildInfoRequest;
  }
}
