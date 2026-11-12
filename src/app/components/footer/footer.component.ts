import { Component, OnInit } from '@angular/core';
import * as globals from '../../utils/globals';
import {
  BuildInfo,
  BuildInfoService,
} from '../../services/build-info/build-info.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  standalone: false,
})
export class FooterComponent implements OnInit {
  public frontendBuildInfo: BuildInfo = {
    name: globals.appName,
    version: globals.appVersion,
    gitCommit: 'unknown',
    buildDate: 'unknown',
  };
  public restApiBuildInfo: BuildInfo = {
    name: 'attack-workbench-rest-api',
    version: 'unknown',
    gitCommit: 'unknown',
    buildDate: 'unknown',
  };

  constructor(private buildInfoService: BuildInfoService) {}

  ngOnInit(): void {
    this.buildInfoService.getBuildInfo().subscribe(buildInfo => {
      this.frontendBuildInfo = buildInfo.frontend;
      this.restApiBuildInfo = buildInfo.restApi;
    });
  }

  public formatVersion(version: string): string {
    if (!version || version === 'unknown') return 'unknown';
    return version.startsWith('v') ? version : `v${version}`;
  }

  public buildDetails(label: string, buildInfo: BuildInfo): string {
    return [
      `${label} ${this.formatVersion(buildInfo.version)}`,
      `Commit: ${buildInfo.gitCommit}`,
      `Built: ${buildInfo.buildDate}`,
    ].join('\n');
  }
}
