import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Role } from 'src/app/classes/authn/role';
import { ConfirmationDialogComponent } from 'src/app/components/confirmation-dialog/confirmation-dialog.component';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { stixRoutes } from '../../app-routing-stix.module';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class LandingPageComponent implements OnInit, OnDestroy {
  private readonly placeholderIdentityName =
    'Placeholder Organization Identity';
  private readonly placeholderIdentityReminderKey =
    'attack-workbench.placeholder-organization-identity-reminder-dismissed';
  private loginSubscription: Subscription;
  public routes: any[] = [];

  constructor(
    private restApiConnector: RestApiConnectorService,
    private authenticationService: AuthenticationService,
    private dialog: MatDialog,
    private router: Router
  ) {
    this.routes = stixRoutes.filter(
      route => route.data.group !== 'more' && !route.data.deprecated
    );
  }

  public get isAdmin(): boolean {
    return this.authenticationService.isAuthorized([Role.ADMIN]);
  }
  public get isTeamLead(): boolean {
    return this.authenticationService.isAuthorized([Role.TEAM_LEAD]);
  }
  public get isLoggedIn(): boolean {
    return this.authenticationService.isLoggedIn;
  }

  ngOnInit() {
    this.loginSubscription = this.authenticationService.onLogin.subscribe({
      // called on initial user login
      next: event => {
        this.openOrgIdentityDialog();
      },
    });
    setTimeout(() => {
      this.openOrgIdentityDialog();
    }, 500); // called on page refresh or re-route
  }

  // bug the admin about editing their organization identity
  private openOrgIdentityDialog(): void {
    if (localStorage.getItem(this.placeholderIdentityReminderKey) === 'true') {
      return;
    }

    if (this.authenticationService.isAuthorized([Role.ADMIN])) {
      const subscription = this.restApiConnector
        .getOrganizationIdentity()
        .subscribe({
          next: identity => {
            if (identity && identity.name == this.placeholderIdentityName) {
              const prompt = this.dialog.open(ConfirmationDialogComponent, {
                maxWidth: '35em',
                data: {
                  message:
                    '### Your organization identity has not yet been set.\n\nYour organization identity is used for attribution of edits you make to objects in the knowledge base and is attached to published collections. Currently, a placeholder is being used.\n\nUpdate your organization identity now?',
                  yes_suffix: 'edit my identity now',
                  no_suffix: 'edit my identity later',
                  alternate_label: 'No, and stop reminding me',
                  alternate_value: 'dismiss',
                },
                autoFocus: false, // prevents auto focus on buttons
              });
              const prompt_subscription = prompt.afterClosed().subscribe({
                next: prompt_result => {
                  if (prompt_result === true) {
                    this.router.navigate(['/identity', identity.stixID], {
                      queryParams: { editing: true },
                    });
                  } else if (prompt_result === 'dismiss') {
                    localStorage.setItem(
                      this.placeholderIdentityReminderKey,
                      'true'
                    );
                  }
                },
                complete: () => {
                  prompt_subscription.unsubscribe();
                },
              });
            }
          },
          complete: () => subscription.unsubscribe(),
        });
    }
  }

  ngOnDestroy() {
    this.loginSubscription.unsubscribe();
  }
}
