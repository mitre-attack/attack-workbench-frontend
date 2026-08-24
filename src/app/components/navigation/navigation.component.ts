import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { NavigationEnd, Route, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { routes as appRoutes } from 'src/app/app-routing.module';
import { stixRoutes } from 'src/app/app-routing-stix.module';
import { Role } from 'src/app/classes/authn/role';
import { Status } from 'src/app/classes/authn/status';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { UserAccountEventsService } from 'src/app/services/user-account-events/user-account-events.service';

interface NavigationItem {
  label: string;
  path: string;
  deprecated?: boolean;
  exact?: boolean;
}

interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

type NavigationArea = 'objectLibrary' | 'dashboard' | 'documentation';

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class NavigationComponent implements OnInit, OnDestroy {
  public expandedNavigationArea: NavigationArea | null = null;
  public pendingUserAccounts = 0;

  private readonly groupOrder = ['core', 'cti', 'defenses', 'more'];
  private readonly documentationOrder = [
    'usage',
    'collections',
    'integrations',
    'contributing',
  ];
  private readonly objectLibraryExcludedPaths = new Set([
    'objects',
    'reference-manager',
    'contributors',
  ]);
  private readonly uppercaseLabels = new Set(['cti']);
  private readonly collapsedSections = new Set<string>();
  private readonly routerEventsSubscription: Subscription;
  private readonly loginSubscription: Subscription;
  private readonly userAccountEventsSubscription: Subscription;
  private pendingUserAccountsSubscription?: Subscription;
  private pendingUserAccountsRefreshTimer?: ReturnType<typeof setTimeout>;

  public readonly sections: NavigationSection[] = this.buildSections();
  public readonly dashboardItems: NavigationItem[] =
    this.buildDashboardItems(false);
  public readonly dashboardAdminItems: NavigationItem[] =
    this.buildDashboardItems(true);
  public readonly documentationItems: NavigationItem[] =
    this.buildDocumentationItems();

  private readonly objectLibraryPaths = [
    '/objects',
    ...this.sections.reduce(
      (paths, section) => paths.concat(section.items.map(item => item.path)),
      [] as string[]
    ),
  ];

  public get isLoggedIn(): boolean {
    return this.authenticationService.isLoggedIn;
  }

  public get canAccessDashboard(): boolean {
    return this.authenticationService.isAuthorized([
      Role.ADMIN,
      Role.TEAM_LEAD,
    ]);
  }

  public get canAccessAdminDashboard(): boolean {
    return this.authenticationService.isAuthorized([Role.ADMIN]);
  }

  public get hasPendingUserAccounts(): boolean {
    return this.canAccessAdminDashboard && this.pendingUserAccounts > 0;
  }

  public get pendingUserAccountsDisplay(): string {
    return this.pendingUserAccounts > 99
      ? '99+'
      : this.pendingUserAccounts.toString();
  }

  public get pendingUserAccountsMessage(): string {
    const accountLabel =
      this.pendingUserAccounts === 1 ? 'account' : 'accounts';
    return `${this.pendingUserAccounts} pending user ${accountLabel}`;
  }

  public get isObjectLibraryActive(): boolean {
    return this.isObjectLibraryRoute(this.router.url);
  }

  public get isDashboardActive(): boolean {
    return this.isDashboardRoute(this.router.url);
  }

  public get isDocumentationActive(): boolean {
    return this.isDocumentationRoute(this.router.url);
  }

  constructor(
    private authenticationService: AuthenticationService,
    private restApiConnector: RestApiConnectorService,
    private userAccountEvents: UserAccountEventsService,
    private router: Router
  ) {
    this.expandedNavigationArea = this.navigationAreaForUrl(this.router.url);
    this.routerEventsSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.expandedNavigationArea = this.navigationAreaForUrl(
          event.urlAfterRedirects
        );
        this.schedulePendingUserAccountsRefresh();
      }
    });
    this.loginSubscription = this.authenticationService.onLogin.subscribe(() =>
      this.refreshPendingUserAccounts()
    );
    this.userAccountEventsSubscription =
      this.userAccountEvents.userAccountsChanged$.subscribe(() =>
        this.refreshPendingUserAccounts()
      );
  }

  public ngOnInit(): void {
    this.refreshPendingUserAccounts();
    this.schedulePendingUserAccountsRefresh();
  }

  public ngOnDestroy(): void {
    this.routerEventsSubscription.unsubscribe();
    this.loginSubscription.unsubscribe();
    this.userAccountEventsSubscription.unsubscribe();
    this.pendingUserAccountsSubscription?.unsubscribe();
    if (this.pendingUserAccountsRefreshTimer) {
      clearTimeout(this.pendingUserAccountsRefreshTimer);
    }
  }

  public expandNavigationArea(area: NavigationArea): void {
    if (!this.canDisplayNavigationArea(area)) {
      this.expandedNavigationArea = null;
      return;
    }

    this.expandedNavigationArea = area;
  }

  public collapseNavigationGroups(): void {
    this.expandedNavigationArea = null;
  }

  public isNavigationAreaExpanded(area: NavigationArea): boolean {
    return (
      this.canDisplayNavigationArea(area) &&
      this.expandedNavigationArea === area
    );
  }

  public isSectionOpen(section: string): boolean {
    return !this.collapsedSections.has(section);
  }

  public sectionId(section: string): string {
    return `nav-section-${section.toLowerCase().replace(/\s+/g, '-')}`;
  }

  public toggleSection(section: string): void {
    if (this.collapsedSections.has(section)) {
      this.collapsedSections.delete(section);
    } else {
      this.collapsedSections.add(section);
    }
  }

  public isObjectLibraryRoute(url: string): boolean {
    const path = this.routePath(url);
    return this.objectLibraryPaths.some(
      objectPath => path === objectPath || path.startsWith(`${objectPath}/`)
    );
  }

  public isDashboardRoute(url: string): boolean {
    const path = this.routePath(url);
    return path === '/dashboard' || path.startsWith('/dashboard/');
  }

  public isDocumentationRoute(url: string): boolean {
    const path = this.routePath(url);
    return path === '/docs' || path.startsWith('/docs/');
  }

  public isUserAccountsNavigationItem(item: NavigationItem): boolean {
    return item.path === '/dashboard/user-accounts';
  }

  private refreshPendingUserAccounts(): void {
    this.pendingUserAccountsSubscription?.unsubscribe();

    if (!this.canAccessAdminDashboard) {
      this.pendingUserAccounts = 0;
      return;
    }

    this.pendingUserAccountsSubscription = this.restApiConnector
      .getAllUserAccounts({ status: [Status.PENDING], limit: 1 })
      .subscribe({
        next: response => {
          this.pendingUserAccounts =
            this.pendingUserAccountCountFromResponse(response);
        },
        error: () => {
          this.pendingUserAccounts = 0;
        },
      });
  }

  private pendingUserAccountCountFromResponse(response: any): number {
    if (Array.isArray(response)) return response.length;
    if (Array.isArray(response?.data)) {
      return response?.pagination?.total ?? response.data.length;
    }
    return 0;
  }

  private schedulePendingUserAccountsRefresh(): void {
    if (this.pendingUserAccountsRefreshTimer) {
      clearTimeout(this.pendingUserAccountsRefreshTimer);
    }

    this.pendingUserAccountsRefreshTimer = setTimeout(() => {
      this.refreshPendingUserAccounts();
    }, 500);
  }

  private navigationAreaForUrl(url: string): NavigationArea | null {
    const path = this.routePath(url);

    if (path === '/' || this.isObjectLibraryRoute(path)) return 'objectLibrary';
    if (this.isDashboardRoute(path)) return 'dashboard';
    if (this.isDocumentationRoute(path)) return 'documentation';
    return null;
  }

  private canDisplayNavigationArea(area: NavigationArea): boolean {
    return this.isLoggedIn || area === 'documentation';
  }

  private routePath(url: string): string {
    return url.split('?')[0].split('#')[0];
  }

  private buildSections(): NavigationSection[] {
    const itemsByGroup = new Map<string, NavigationItem[]>();

    stixRoutes
      .filter(
        route =>
          route.path &&
          route.data?.group &&
          !route.data?.deprecated &&
          !this.objectLibraryExcludedPaths.has(route.path)
      )
      .forEach(route => {
        const group = route.data?.group as string;
        const items = itemsByGroup.get(group) || [];
        items.push({
          label: this.titleCase(
            route.data?.breadcrumb || (route.path as string)
          ),
          path: `/${route.path}`,
          deprecated: !!route.data?.deprecated,
        });
        itemsByGroup.set(group, items);
      });

    return Array.from(itemsByGroup.entries())
      .sort(([leftGroup], [rightGroup]) => {
        const leftOrder = this.groupOrder.indexOf(leftGroup);
        const rightOrder = this.groupOrder.indexOf(rightGroup);
        return this.groupSortValue(leftOrder) - this.groupSortValue(rightOrder);
      })
      .map(([group, items]) => ({
        label: this.titleCase(group),
        items,
      }));
  }

  private groupSortValue(order: number): number {
    return order === -1 ? Number.MAX_SAFE_INTEGER : order;
  }

  private buildDashboardItems(adminOnly: boolean): NavigationItem[] {
    const dashboardRoute = this.dashboardRoute();
    if (!dashboardRoute?.children) return [];

    return dashboardRoute.children
      .filter(route => this.isDashboardNavigationRoute(route))
      .filter(route => this.isAdminDashboardRoute(route) === adminOnly)
      .map(route => ({
        label: this.titleCase(route.data?.breadcrumb || (route.path as string)),
        path: this.dashboardPath(route),
        exact: route.path === '' || route.path === 'overview',
      }));
  }

  private dashboardRoute(): Route | undefined {
    return appRoutes[0]?.children?.find(route => route.path === 'dashboard');
  }

  private buildDocumentationItems(): NavigationItem[] {
    const documentationRoute = this.documentationRoute();
    if (!documentationRoute?.children) return [];

    return this.documentationOrder
      .map(path =>
        documentationRoute.children?.find(route => route.path === path)
      )
      .filter((route): route is Route => !!route)
      .map(route => ({
        label: this.titleCase(route.data?.breadcrumb || (route.path as string)),
        path: `/docs/${route.path}`,
        exact: true,
      }));
  }

  private documentationRoute(): Route | undefined {
    return appRoutes[0]?.children?.find(route => route.path === 'docs');
  }

  private dashboardPath(route: Route): string {
    return route.path ? `/dashboard/${route.path}` : '/dashboard';
  }

  private isDashboardNavigationRoute(route: Route): boolean {
    return route.path !== undefined && !!route.data?.breadcrumb;
  }

  private isAdminDashboardRoute(route: Route): boolean {
    const roles = route.data?.roles as Role[] | undefined;
    return roles?.length === 1 && roles.includes(Role.ADMIN);
  }

  private titleCase(value: string): string {
    return value
      .replace(/-/g, ' ')
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => {
        const lowerCaseWord = word.toLowerCase();
        if (this.uppercaseLabels.has(lowerCaseWord))
          return lowerCaseWord.toUpperCase();
        return `${lowerCaseWord.charAt(0).toUpperCase()}${lowerCaseWord.slice(1)}`;
      })
      .join(' ');
  }
}
