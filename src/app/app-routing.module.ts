import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LandingPageComponent } from './views/landing-page/landing-page.component';
import { HelpPageComponent } from './views/help-page/help-page.component';
import { DashboardPageComponent } from './views/dashboard-page/dashboard-page.component';
import { DataQualityComponent } from './views/dashboard-page/data-quality/data-quality.component';
import { OrgSettingsPageComponent } from './views/dashboard-page/org-settings-page/org-settings-page.component';
import { UserAccountsPageComponent } from './views/dashboard-page/user-accounts-page/user-accounts-page.component';
import { DefaultMarkingDefinitionsComponent } from './views/dashboard-page/default-marking-definitions/default-marking-definitions.component';
import { ValidationBypassesComponent } from './views/dashboard-page/validation-bypasses/validation-bypasses.component';
import { ProfilePageComponent } from './views/profile-page/profile-page.component';
import { AuthorizationGuard } from './services/helpers/authorization.guard';
import { Role } from './classes/authn/role';
import { TeamsListPageComponent } from './views/dashboard-page/teams/teams-list-page/teams-list-page.component';
import { TeamsViewPageComponent } from './views/dashboard-page/teams/teams-view-page/teams-view-page.component';
import { ReleaseManagementComponent } from './views/dashboard-page/release-management/release-management.component';
import { ReleaseTrackPageComponent } from './views/dashboard-page/release-management/release-track-page/release-track-page.component';

const editRoles = [Role.EDITOR, Role.TEAM_LEAD, Role.ADMIN];

export const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: 'home',
    },
    children: [
      {
        path: '',
        data: {
          breadcrumb: 'welcome',
        },
        component: LandingPageComponent,
      },
      {
        path: 'register',
        data: {
          breadcrumb: 'welcome',
        },
        component: LandingPageComponent,
      },
      {
        path: 'dashboard',
        canActivate: [AuthorizationGuard],
        canActivateChild: [AuthorizationGuard],
        data: {
          breadcrumb: 'dashboard',
          title: 'Dashboard',
          roles: [Role.TEAM_LEAD, Role.ADMIN],
        },
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'overview',
          },
          {
            path: 'overview',
            data: {
              breadcrumb: 'overview',
              title: 'Knowledge Base Overview',
            },
            component: DashboardPageComponent,
          },
          {
            path: 'release-management',
            data: {
              breadcrumb: 'release management',
              title: 'Release Management',
              roles: [Role.ADMIN, Role.TEAM_LEAD],
            },
            children: [
              {
                path: '',
                data: {
                  breadcrumb: 'release management',
                  title: 'Release Management',
                },
                component: ReleaseManagementComponent,
              },
              {
                path: ':id',
                data: {
                  breadcrumb: 'view release track',
                  editable: false,
                  title: 'Release Track',
                },
                component: ReleaseTrackPageComponent,
              },
            ],
          },
          {
            path: 'teams',
            data: {
              breadcrumb: 'teams',
              title: 'Teams',
            },
            children: [
              {
                path: '',
                data: {
                  breadcrumb: 'teams',
                  title: 'Teams',
                },
                component: TeamsListPageComponent,
              },
              {
                path: ':id',
                data: {
                  breadcrumb: 'view team',
                  editable: true,
                  title: 'View Team',
                  editRoles: editRoles,
                },
                component: TeamsViewPageComponent,
              },
            ],
          },
          {
            path: 'data-quality',
            data: {
              breadcrumb: 'data quality',
              title: 'Data Quality',
              roles: [Role.ADMIN, Role.TEAM_LEAD],
            },
            component: DataQualityComponent,
          },
          {
            path: 'org-settings',
            data: {
              breadcrumb: 'organization settings',
              title: 'Organization Identity',
              roles: [Role.ADMIN],
            },
            component: OrgSettingsPageComponent,
          },
          {
            path: 'user-accounts',
            data: {
              breadcrumb: 'user accounts',
              title: 'User Accounts',
              roles: [Role.ADMIN],
            },
            component: UserAccountsPageComponent,
          },
          {
            path: 'default-marking-definitions',
            data: {
              breadcrumb: 'default marking definitions',
              title: 'Default Marking Definitions',
              roles: [Role.ADMIN],
            },
            component: DefaultMarkingDefinitionsComponent,
          },
          {
            path: 'validation-bypasses',
            data: {
              breadcrumb: 'validation bypasses',
              title: 'ADM Validation Bypasses',
              roles: [Role.ADMIN],
            },
            component: ValidationBypassesComponent,
          },
        ],
      },
      {
        path: 'docs',
        data: {
          breadcrumb: 'documentation',
          title: 'Documentation',
        },
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'usage',
          },
          {
            path: 'usage',
            data: {
              breadcrumb: 'usage',
              markdown: '/assets/docs/usage.md',
              title: 'Usage',
            },
            component: HelpPageComponent,
          },
          {
            path: 'collections',
            data: {
              breadcrumb: 'collections',
              markdown: '/assets/docs/collections.md',
              title: 'About Collections',
            },
            component: HelpPageComponent,
          },
          {
            path: 'changelog',
            data: {
              breadcrumb: 'changelog',
              markdown: '/assets/docs/changelog.md',
              title: 'Changelog',
            },
            component: HelpPageComponent,
          },
          {
            path: 'integrations',
            data: {
              breadcrumb: 'integrations',
              markdown: '/assets/docs/integrations.md',
              title: 'Integrations',
            },
            component: HelpPageComponent,
          },
          {
            path: 'contributing',
            data: {
              breadcrumb: 'contributing',
              markdown: '/assets/docs/contributing.md',
              title: 'Contributing',
            },
            component: HelpPageComponent,
          },
        ],
      },
      {
        path: 'profile',
        canActivate: [AuthorizationGuard],
        canActivateChild: [AuthorizationGuard],
        data: {
          breadcrumb: 'profile',
          title: 'Profile',
          roles: [Role.VISITOR, Role.EDITOR, Role.TEAM_LEAD, Role.ADMIN],
          editRoles: [Role.VISITOR, Role.EDITOR, Role.TEAM_LEAD, Role.ADMIN],
        },
        children: [
          {
            path: '',
            data: {
              breadcrumb: 'profile',
              title: 'Profile',
              editable: true,
            },
            component: ProfilePageComponent,
          },
        ],
      },
    ],
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      anchorScrolling: 'enabled',
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
