import { CollectionManagerComponent } from './views/collection-manager/collection-manager.component';
import { CollectionImportComponent } from './views/stix/collection/collection-import/collection-import-workflow/collection-import.component';
import { CollectionIndexImportComponent } from './views/stix/collection/collection-index/collection-index-import/collection-index-import.component';
import { ReferenceManagerComponent } from './views/reference-manager/reference-manager.component';
import { NotesPageComponent } from './views/notes-page/notes-page.component';
import { StixPageComponent } from './views/stix/stix-page/stix-page.component';
import { ContributorsPageComponent } from './views/contributors-page/contributors-page.component';

import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { environment } from '../environments/environment';
import { AuthorizationGuard } from './services/helpers/authorization.guard';
import { Role } from './classes/authn/role';
import { AttackTypeToRoute } from './utils/type-mappings';
import { StixListPageComponent } from './views/stix/stix-list-page/stix-list-page.component';

const viewRoles = [Role.VISITOR, Role.EDITOR, Role.TEAM_LEAD, Role.ADMIN];
const editRoles = [Role.EDITOR, Role.TEAM_LEAD, Role.ADMIN];

const stixRouteData = [
  {
    attackType: 'matrix',
    editable: true,
  },
  {
    attackType: 'tactic',
    editable: true,
  },
  {
    attackType: 'technique',
    editable: true,
  },
  // cti
  {
    attackType: 'group',
    editable: true,
    headerSection: 'cti',
  },
  {
    attackType: 'software',
    editable: true,
    headerSection: 'cti',
  },
  {
    attackType: 'campaign',
    editable: true,
    headerSection: 'cti',
  },
  // defenses
  {
    attackType: 'mitigation',
    editable: true,
    headerSection: 'defenses',
  },
  {
    attackType: 'asset',
    editable: true,
    headerSection: 'defenses',
  },
  {
    attackType: 'detection-strategy',
    editable: true,
    headerSection: 'defenses',
  },
  {
    attackType: 'analytic',
    editable: true,
    headerSection: 'defenses',
  },
  {
    attackType: 'data-component',
    editable: true,
    headerSection: 'defenses',
  },
  {
    attackType: 'data-source',
    editable: true,
    headerSection: 'defenses',
    deprecated: true,
  },
  // more
  {
    attackType: 'identity',
    editable: true,
    headerSection: 'more',
  },
];

const stixRoutes: Routes = [];
stixRouteData.forEach(stixRoute => {
  stixRoutes.push({
    path: stixRoute.attackType,
    canActivateChild: [AuthorizationGuard],
    data: {
      breadcrumb: AttackTypeToRoute[stixRoute.attackType].replace(/-/g, ' '),
      headerSection: stixRoute.headerSection || undefined,
      deprecated: stixRoute.deprecated ?? false,
    },
    children: [
      {
        path: '',
        data: {
          breadcrumb: 'list',
          title: AttackTypeToRoute[stixRoute.attackType].replace(/-/g, ' '),
          roles: viewRoles,
        },
        component: StixListPageComponent,
      },
      {
        path: ':id',
        data: {
          breadcrumb: 'loading...',
        },
        children: [
          {
            path: '',
            data: {
              breadcrumb: 'view',
              editable: stixRoute.editable,
              title: `view ${stixRoute.attackType.replace(/-/g, ' ')}`,
              roles: viewRoles,
              editRoles: editRoles,
            },
            component: StixPageComponent,
          },
        ],
      },
      {
        path: ':new',
        data: {
          breadcrumb: `new ${stixRoute.attackType.replace(/-/g, ' ')}`,
        },
        children: [
          {
            path: '',
            data: {
              breadcrumb: 'view',
              editable: stixRoute.editable,
              title: `new ${stixRoute.attackType.replace(/-/g, ' ')}`,
              roles: editRoles,
              editRoles: editRoles,
            },
            component: StixPageComponent,
          },
        ],
      },
    ],
  });
});

stixRoutes.push({
  path: 'marking-definition',
  canActivateChild: [AuthorizationGuard],
  data: {
    breadcrumb: 'marking definitions',
    headerSection: 'more',
  },
  children: [
    {
      path: '',
      data: {
        breadcrumb: 'list',
        title: 'marking definitions',
        roles: viewRoles,
      },
      component: StixListPageComponent,
    },
    {
      path: ':id',
      data: {
        breadcrumb: 'loading...',
      },
      children: [
        {
          path: '',
          data: {
            breadcrumb: 'view',
            editable: false,
            title: 'view marking definition',
            roles: viewRoles,
          },
          component: StixPageComponent,
        },
      ],
    },
    {
      path: ':new',
      data: {
        breadcrumb: 'new marking definition',
      },
      children: [
        {
          path: '',
          data: {
            breadcrumb: 'view',
            editable: false,
            title: 'new marking definition',
            roles: [Role.ADMIN],
          },
          component: StixPageComponent,
        },
      ],
    },
  ],
});

if (environment.integrations.collection_manager.enabled) {
  stixRoutes.push({
    path: 'collection',
    canActivateChild: [AuthorizationGuard],
    data: {
      breadcrumb: 'collections',
      headerSection: 'more',
    },
    children: [
      {
        path: '',
        data: {
          breadcrumb: 'list',
          title: 'collections',
          roles: viewRoles,
        },
        component: CollectionManagerComponent,
      },
      {
        path: 'import-collection',
        data: {
          breadcrumb: 'import a collection',
          title: 'import collection',
        },
        children: [
          {
            path: '',
            data: {
              breadcrumb: 'import',
              title: 'import collection',
              roles: [Role.ADMIN],
            },
            component: CollectionImportComponent,
          },
        ],
      },
      {
        path: 'import-collection-index',
        data: {
          breadcrumb: 'add a collection index',
          title: 'add collection index',
        },
        children: [
          {
            path: '',
            data: {
              breadcrumb: 'import',
              title: 'add collection index',
              roles: [Role.ADMIN],
            },
            component: CollectionIndexImportComponent,
          },
        ],
      },
      {
        path: ':id/modified/:modified',
        data: {
          breadcrumb: 'loading...',
        },
        children: [
          {
            path: '',
            data: {
              breadcrumb: 'view',
              editable: true,
              title: 'view collection',
              roles: viewRoles,
              editRoles: [Role.ADMIN],
            },
            component: StixPageComponent,
          },
        ],
      },
      {
        path: 'new',
        data: {
          breadcrumb: 'new collection',
          title: 'new collection',
        },
        children: [
          {
            path: '',
            data: {
              breadcrumb: 'new collection',
              editable: true,
              title: 'new collection',
              roles: [Role.ADMIN],
              editRoles: [Role.ADMIN],
            },
            component: StixPageComponent,
          },
        ],
      },
    ],
  });
}

stixRoutes.push(
  {
    path: 'reference-manager',
    canActivateChild: [AuthorizationGuard],
    data: {
      breadcrumb: 'reference manager',
      headerSection: 'more',
    },
    children: [
      {
        path: '',
        data: {
          breadcrumb: 'list',
          title: 'references',
          roles: viewRoles,
          editRoles: editRoles,
        },
        component: ReferenceManagerComponent,
      },
    ],
  },
  {
    path: 'contributors',
    canActivateChild: [AuthorizationGuard],
    data: {
      breadcrumb: 'contributors',
      headerSection: 'more',
    },
    children: [
      {
        path: '',
        data: {
          breadcrumb: 'list',
          title: 'Contributors',
          roles: viewRoles,
        },
        component: ContributorsPageComponent,
      },
    ],
  },
  {
    path: 'notes',
    canActivateChild: [AuthorizationGuard],
    data: {
      breadcrumb: 'notes',
      headerSection: 'more',
    },
    children: [
      {
        path: '',
        data: {
          breadcrumb: 'list',
          title: 'Notes Search',
          roles: editRoles,
        },
        component: NotesPageComponent,
      },
    ],
  }
);

@NgModule({
  imports: [RouterModule.forChild(stixRoutes)],
  exports: [RouterModule],
  providers: [],
})
export class AppRoutingStixModule {}
export { stixRoutes };
