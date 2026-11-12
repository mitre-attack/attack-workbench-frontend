/* eslint-disable @typescript-eslint/no-unused-vars */
import { HttpClient } from '@angular/common/http';
import { EventEmitter, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, of } from 'rxjs';
import { catchError, share, map, concatMap } from 'rxjs/operators';
import { UserAccount } from 'src/app/classes/authn/user-account';
import { getRuntimeConfiguration } from 'src/configuration/runtime-configuration';
import { ApiConnector } from '../api-connector';
import { Role } from 'src/app/classes/authn/role';
import { Router } from '@angular/router';
import { RestApiConnectorService } from '../rest-api/rest-api-connector.service';
import { Status } from 'src/app/classes/authn/status';
import { AppConfigService } from '../../config/app-config.service';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService extends ApiConnector {
  public currentUser: UserAccount;
  public get isLoggedIn(): boolean {
    return this.currentUser && this.currentUser.status == Status.ACTIVE;
  }
  public activeRoles: Role[] = [
    Role.ADMIN,
    Role.EDITOR,
    Role.TEAM_LEAD,
    Role.VISITOR,
  ];
  public inactiveRoles: Role[] = [Role.NONE];
  private get apiUrl(): string {
    return getRuntimeConfiguration().apiUrl;
  }
  public onLogin = new EventEmitter(); // event emitter for admin organization identity pop-up

  constructor(
    private router: Router,
    private http: HttpClient,
    snackbar: MatSnackBar,
    private restAPIConnector: RestApiConnectorService,
    private configService: AppConfigService
  ) {
    super(snackbar);
  }

  /**
   * Check if user is authorized
   * @param roles list of authorized roles
   * @returns true, if user is logged in and has an authorized role, false otherwise
   */
  public isAuthorized(roles: Role[]): boolean {
    // is user logged in?
    if (!this.isLoggedIn) return false;
    // does user have an authorized role?
    return roles.indexOf(this.currentUser.role) > -1;
  }

  /**
   * Check if user is authorized to edit an object
   * @param attackType object type
   * @returns true, if the user can edit the object, false otherwise
   */
  public canEdit(attackType?: string): boolean {
    if (
      attackType &&
      (attackType.includes('collection') ||
        attackType.includes('marking-definition'))
    ) {
      // restrict collection & marking definition editing to admin only
      return this.isAuthorized([Role.ADMIN]);
    }
    return this.isAuthorized([Role.EDITOR, Role.TEAM_LEAD, Role.ADMIN]);
  }

  /**
   * Check if user is authorized to delete objects
   * @returns true, if the user can delete objects, false otherwise
   */
  public canDelete(): boolean {
    return this.isAuthorized([Role.ADMIN]);
  }

  /**
   * User log in sequence
   * @returns of the logged in user account
   */
  public login(): Observable<UserAccount> {
    return this.getAuthType().pipe(
      // retrieve authentication configuration
      concatMap(authnType => {
        let url = `${this.apiUrl}/authn/${authnType}/login`;
        if (authnType == 'oidc') {
          // oidc login
          url += `?destination=${encodeURIComponent(window.location.href)}`;
          // redirect to OIDC Identity Provider
          window.location.href = url;
          return this.getSession().pipe(
            map(res => {
              this.success();
              return res;
            })
          );
        }
        // anonymous login
        return this.http.get(url, { responseType: 'text' }).pipe(
          concatMap(_success => {
            return this.getSession().pipe(
              map(res => {
                this.success();
                return res;
              })
            );
          })
        );
      }),
      catchError(this.handleError_raise<UserAccount>()),
      share()
    );
  }

  public success(): void {
    this.configService.redirectToLanding();
    this.onLogin.emit();
  }

  /**
   * User logout sequence to clear the active login session on the REST API side
   * Note: this does not log the user out of the organization's SSO Provider
   * @returns of the log out response
   */
  public logout(): Observable<any> {
    return this.getAuthType().pipe(
      concatMap(authnType => {
        const url = `${this.apiUrl}/authn/${authnType}/logout`;
        return this.http.get(url, { responseType: 'text' }).pipe(
          map(res => {
            this.currentUser = undefined;
            return res;
          })
        );
      }),
      catchError(this.handleError_raise()),
      share()
    );
  }

  /**
   * User register sequence
   * @returns of the logged in user account
   */
  public register() {
    return this.getAuthType().pipe(
      // retrieve authentication configuration
      concatMap(authnType => {
        if (authnType == 'oidc') {
          let url = `${this.apiUrl}/authn/${authnType}/login`;
          // oidc login
          url += `?destination=${encodeURIComponent(window.location.href + 'register')}`;
          // redirect to OIDC Identity Provider
          window.location.href = url;
        }
        return [].map(() => ({ next: () => true }));
      }),
      catchError(this.handleError_raise<UserAccount>()),
      share()
    );
  }

  public handleRegisterRedirect(): Observable<any> {
    return this.getAuthType().pipe(
      // retrieve authentication configuration
      concatMap(authnType => {
        if (authnType == 'oidc') {
          return this.http
            .post(`${this.apiUrl}/user-accounts/register`, {
              responseType: 'text',
            })
            .pipe(
              concatMap(() => {
                return this.getSession().pipe(
                  map(res => {
                    return res;
                  })
                );
              })
            );
        }
        return [].map(() => ({ next: () => true }));
      }),
      catchError(this.handleError_raise<UserAccount>()),
      share()
    );
  }

  /**
   * Get the user account object of the logged in user
   * @returns the user account object of the logged in user, if logged in,
   * otherwise return a default value
   */
  public getSession(): Observable<UserAccount> {
    const url = `${this.apiUrl}/session`;
    // retrieve user session object
    return this.http.get<any>(url).pipe(
      concatMap(session => {
        // retrieve user account from session
        return this.restAPIConnector.getUserAccount(session.userAccountId).pipe(
          map(res => {
            this.currentUser = new UserAccount(res);
            return res;
          })
        );
      }),
      catchError(_err => {
        return of(null);
      }), // return a default value so that the app can continue
      share()
    );
  }

  /**
   * Get the authentication configuration
   * @returns the configured user authentication mechanism
   */
  public getAuthType(): Observable<string> {
    const url = `${this.apiUrl}/config/authn`;
    return this.http.get<any>(url).pipe(
      map(results => {
        if (results.mechanisms) {
          const authnMechanism = results.mechanisms.find(m => m.authnType);
          if (authnMechanism?.authnType) {
            return authnMechanism.authnType;
          }
        } else throw new Error('invalid authentication mechanism'); // this should never happen
      }),
      catchError(this.handleError_raise()),
      share()
    );
  }
}
