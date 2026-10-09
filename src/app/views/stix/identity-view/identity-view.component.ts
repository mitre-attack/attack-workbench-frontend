import { Component, OnInit } from '@angular/core';
import { Identity } from 'src/app/classes/stix';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { StixViewPage } from '../stix-view-page';

@Component({
  selector: 'app-identity-view',
  templateUrl: './identity-view.component.html',
  standalone: false,
})
export class IdentityViewComponent extends StixViewPage implements OnInit {
  public get identity(): Identity {
    return this.configCurrentObject as Identity;
  }
  public get previous(): Identity {
    return this.configPreviousObject as Identity;
  }

  constructor(
    authenticationService: AuthenticationService,
    private restApiConnector: RestApiConnectorService
  ) {
    super(authenticationService);
  }

  ngOnInit(): void {
    if (this.identity.firstInitialized) {
      this.identity.setDefaultMarkingDefinitions(this.restApiConnector);
    }
  }
}
