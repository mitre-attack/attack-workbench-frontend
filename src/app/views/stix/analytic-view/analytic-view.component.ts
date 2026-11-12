import { Component, OnInit } from '@angular/core';
import { StixViewPage } from '../stix-view-page';
import { Analytic } from 'src/app/classes/stix';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';

@Component({
  selector: 'app-analytic-view',
  standalone: false,
  templateUrl: './analytic-view.component.html',
  styleUrl: './analytic-view.component.scss',
})
export class AnalyticViewComponent extends StixViewPage implements OnInit {
  public get analytic(): Analytic {
    return this.configCurrentObject as Analytic;
  }
  public get previous(): Analytic {
    return this.configPreviousObject as Analytic;
  }

  constructor(
    authenticationService: AuthenticationService,
    private apiService: RestApiConnectorService
  ) {
    super(authenticationService);
  }

  ngOnInit(): void {
    if (this.analytic.firstInitialized) {
      this.analytic.setDefaultMarkingDefinitions(this.apiService);
    }
  }
}
