import {
  Component,
  EventEmitter,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { Role } from 'src/app/classes/authn/role';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class HeaderComponent {
  @Output() public onLogin = new EventEmitter();
  @Output() public onLogout = new EventEmitter();
  @Output() public onRegister = new EventEmitter();
  public authnType: string;

  public get isAdmin(): boolean {
    return this.authenticationService.isAuthorized([Role.ADMIN]);
  }
  public get isTeamLead(): boolean {
    return this.authenticationService.isAuthorized([Role.TEAM_LEAD]);
  }
  public get isLoggedIn(): boolean {
    return this.authenticationService.isLoggedIn;
  }
  public get username(): string {
    return (
      this.authenticationService.currentUser?.displayName ||
      this.authenticationService.currentUser?.username
    );
  }

  constructor(private authenticationService: AuthenticationService) {
    this.authenticationService.getAuthType().subscribe({
      next: v => {
        this.authnType = v;
      },
    });
  }

  public login(): void {
    this.onLogin.emit();
  }

  public logout(): void {
    this.onLogout.emit();
  }

  public register(): void {
    this.onRegister.emit();
  }
}
