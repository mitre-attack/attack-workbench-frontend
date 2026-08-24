import {
  Component,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  Input,
  EventEmitter,
  Output,
} from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { UserAccount } from 'src/app/classes/authn/user-account';
import {
  Paginated,
  RestApiConnectorService,
} from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { Role } from 'src/app/classes/authn/role';
import { MatPaginator } from '@angular/material/paginator';
import { AuthenticationService } from '../../services/connectors/authentication/authentication.service';
import { Status } from 'src/app/classes/authn/status';
import { Team } from 'src/app/classes/authn/team';
import { SelectionModel } from '@angular/cdk/collections';
import { UserAccountEventsService } from 'src/app/services/user-account-events/user-account-events.service';

@Component({
  selector: 'app-users-list',
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class UsersListComponent implements OnInit {
  @Input() config: UsersListConfig;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @Output() public onSelect = new EventEmitter<string>();
  public userAccounts$: Observable<Paginated<UserAccount>>;
  public userAccounts: UserAccount[];
  public columnsToDisplay: string[];
  public filterOptions: any[];
  public totalObjectCount = 0;
  public userSubscription: Subscription;
  public selectedFilters: string[];
  public searchQuery: '';
  public team: Team;
  public selection: SelectionModel<string>;

  /**
   * Whether or not to show the search
   */
  public get showSearch(): boolean {
    return this.config ? this.config.showSearch : true;
  }

  /**
   * Whether or not to show filters
   */
  public get showFilters(): boolean {
    return this.config ? this.config.showFilters : true;
  }

  /**
   * Get current user
   */
  public get currentUser(): UserAccount {
    return this.authenticationService.currentUser;
  }

  /**
   * Checks if user is an admin
   */
  public get isAdmin(): boolean {
    return this.authenticationService.isAuthorized([Role.ADMIN]);
  }

  constructor(
    private restAPIConnector: RestApiConnectorService,
    private authenticationService: AuthenticationService,
    private userAccountEvents: UserAccountEventsService
  ) {
    this.filterOptions = [
      {
        name: 'status',
        values: Object.values(Status as {}),
      },
      {
        name: 'role',
        values: Object.values(Role as {}),
      },
    ];
  }

  ngOnInit(): void {
    this.columnsToDisplay =
      this.config &&
      this.config.columnsToDisplay &&
      Array.isArray(this.config.columnsToDisplay)
        ? this.config.columnsToDisplay
        : ['username', 'email'];
    this.team = this.config && this.config.team ? this.config.team : null;
    this.applyControls();
    if (this.config.mode == 'select') {
      this.columnsToDisplay = ['select'].concat(this.columnsToDisplay);
      this.selection = this.config.selection
        ? this.config.selection
        : new SelectionModel<string>(true);
    }
  }

  /**
   * Gets a list of all user accounts from REST API (if a team is passed in, only get accounts within the team)
   */
  public getAccounts(options: {
    limit: number;
    offset: number;
    status?: string[];
    role?: string[];
    search?: string;
  }) {
    if (this.team) {
      this.userAccounts$ = this.restAPIConnector.getUserAccountsByTeamId(
        this.team.id,
        options
      );
    } else {
      this.userAccounts$ = this.restAPIConnector.getAllUserAccounts(options);
    }
    this.userSubscription = this.userAccounts$.subscribe({
      next: data => {
        this.userAccounts = data.data;
        this.totalObjectCount = data.pagination.total;
      },
      complete: () => {
        this.userSubscription.unsubscribe();
      },
    });
  }

  /**
   * Apply filters to user search
   * @param filters List of filters
   * @param applyControls Whether or not to apply controls to the search
   */
  public applyFilters(filters, applyControls = false): void {
    const roleFilters = [];
    const statusFilters = [];
    const limit = this.paginator ? this.paginator.pageSize : 10;
    const offset =
      this.paginator || applyControls ? this.paginator.pageIndex * limit : 0;
    if (!applyControls && this.paginator) this.paginator.pageIndex = 0;
    this.selectedFilters = filters;
    filters.forEach(filter => {
      if (this.filterOptions[0].values.includes(filter)) {
        // Status
        statusFilters.push(filter);
      } else if (this.filterOptions[1].values.includes(filter)) {
        // Role
        roleFilters.push(filter);
      }
    });
    this.getAccounts({
      limit: limit,
      offset: offset,
      status: statusFilters,
      role: roleFilters,
    });
  }

  /**
   * Apply search to user search
   * @param query query string
   * @param applyControls Whether or not to apply controls to the search
   */
  public applySearch(query, applyControls = false): void {
    const limit = this.paginator ? this.paginator.pageSize : 10;
    const offset =
      this.paginator || applyControls ? this.paginator.pageIndex * limit : 0;
    if (!applyControls && this.paginator) this.paginator.pageIndex = 0;
    this.getAccounts({ limit: limit, offset: offset, search: query });
  }

  /**
   * Apply controls to the search
   */
  public applyControls(): void {
    if (this.searchQuery) this.applySearch(this.searchQuery, true);
    if (this.selectedFilters) this.applyFilters(this.selectedFilters, true);
    if (!this.searchQuery && !this.selectedFilters) {
      const limit = this.paginator ? this.paginator.pageSize : 10;
      const offset = this.paginator ? this.paginator.pageIndex * limit : 0;
      this.getAccounts({ limit: limit, offset: offset });
    }
  }

  /**
   * Updates a user role
   * @param userAccount User account to update
   * @param newRole Role to be set
   */
  public updateUserRole(userAccount: UserAccount, newRole: string): void {
    newRole = newRole.toUpperCase();
    if (Role[newRole]) {
      const user = new UserAccount(userAccount);
      user.role = Role[newRole];
      // update user status based on active roles
      user.status = this.authenticationService.activeRoles.includes(user.role)
        ? Status.ACTIVE
        : Status.INACTIVE;
      const subscription = user.save(this.restAPIConnector).subscribe({
        complete: () => {
          this.userAccountEvents.notifyUserAccountsChanged();
          this.applyControls(); // refresh list
          subscription.unsubscribe();
        },
      });
    }
  }

  /**
   * Updates a user status
   * @param userAccount User account to update
   * @param newStatus Status to be set
   */
  public updateUserStatus(userAccount: UserAccount, newStatus: string): void {
    newStatus = newStatus.toUpperCase();
    if (Status[newStatus]) {
      const user = new UserAccount(userAccount);
      user.status = Status[newStatus];

      // update user role based on status
      if ([Status.INACTIVE, Status.PENDING].includes(user.status))
        user.role = Role.NONE;

      const subscription = user.save(this.restAPIConnector).subscribe({
        complete: () => {
          this.userAccountEvents.notifyUserAccountsChanged();
          this.applyControls(); // refresh list
          subscription.unsubscribe();
        },
      });
    }
  }

  /**
   * Removes a user from a team
   * @param user User to be removed
   */
  public removeUser(user: UserAccount): void {
    this.team.userIDs = this.team.userIDs.filter(
      userElement => userElement !== user.id
    );
    this.restAPIConnector.putTeam(this.team);
    this.applyControls();
  }

  /**
   * Formats role string by replacing underscores with spaces
   * @param role The raw role string value (e.g., "team_lead")
   * @returns A display-friendly version of the role
   */
  public formatRole(role: string): string {
    return role.replace(/_/g, ' ');
  }
}

export interface UsersListConfig {
  // Columns to display
  // defaults to username and email columns
  columnsToDisplay: string[];
  // team which we are fetching user accounts for
  // if not specified, fetches all user accounts
  team: Team;
  // whether or not to display the search bar
  // defaults to true
  showSearch: boolean;
  // whether or not to show the filters in the list
  // defaults to true
  showFilters: boolean;
  // mode the list is being used 'view' or 'select'
  // default is 'view'
  mode: string;
  // selection object used in 'select' mode
  selection: SelectionModel<string>;
}
