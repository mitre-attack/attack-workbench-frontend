import { EventEmitter, Injectable } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { SidebarService } from '../sidebar/sidebar.service';
import { ConfirmationDialogComponent } from 'src/app/components/confirmation-dialog/confirmation-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthenticationService } from '../connectors/authentication/authentication.service';
import { RestApiConnectorService } from '../connectors/rest-api/rest-api-connector.service';
import { map } from 'rxjs/operators';
import { forkJoin, Observable, of } from 'rxjs';
import { Relationship } from 'src/app/classes/stix/relationship';

const MITRE_IDENTITY_STIX_ID = 'identity--c78cb6e5-0c4b-4611-8297-d1b8b55e40b5';

@Injectable({
  providedIn: 'root',
})
export class EditorService {
  public editable = false;
  public editing = false;
  public deletable = false;
  public hasWorkflow = true;
  public hasRelationships = true;
  public isAnImportedCollection = false;
  public hasConvertedCollection = false;
  public isGroup = false;

  public onSave = new EventEmitter();
  public onDelete = new EventEmitter();
  public onDeleteImportedCollection = new EventEmitter();
  public onEditingStopped = new EventEmitter();
  public onReload = new EventEmitter();
  public onReloadReferences = new EventEmitter();
  public onConvertImportedCollection = new EventEmitter();
  public viewStix = new EventEmitter();

  public get stixId(): string {
    return this.router.url.split('/')[2].split('?')[0];
  }
  public get type(): string {
    return this.router.url.split('/')[1];
  }
  public get sidebarEnabled(): boolean {
    return this.type != 'reference-manager';
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private sidebarService: SidebarService,
    private authenticationService: AuthenticationService,
    private apiService: RestApiConnectorService,
    private dialog: MatDialog,
    private snackbar: MatSnackBar
  ) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isAnImportedCollection = false;
        this.hasConvertedCollection = false;
        const editable = this.getEditableFromRoute(
          this.router.routerState,
          this.router.routerState.root
        );
        const attackType = this.route.root.firstChild.snapshot.data.breadcrumb;
        this.editable =
          editable.length > 0 &&
          editable.every(x => x) &&
          this.authenticationService.canEdit(attackType);
        this.hasWorkflow = attackType !== 'home' && this.type !== 'identity';
        if (!(this.editable && this.hasWorkflow))
          this.sidebarService.currentTab = 'search';
        this.sidebarService.setEnabled(
          'history',
          this.editable && this.hasWorkflow && !this.router.url.includes('/new')
        );
        this.sidebarService.setEnabled(
          'notes',
          this.editable && this.hasWorkflow
        );
        this.isGroup = false;
        if (this.editable) {
          this.sidebarService.currentTab = 'references';
          // if we have a group type and it is NOT new we can create a collection from all of the objects in the group
          this.isGroup =
            this.type === 'group' && !this.router.url.includes('/new');
          if (!this.hasWorkflow) {
            this.hasRelationships = false;
            if (this.type.includes('profile')) this.deletable = false;
            else this.deletable = true;
          } else if (
            this.router.url.includes('/new') ||
            ['matrix', 'tactic', 'collection'].includes(this.type)
          ) {
            // new objects, matrices, tactics, and collections cannot be deleted
            this.deletable = false;
          } else {
            this.deletable = true;
            // determine if this object has existing relationships
            this.getRelationships().subscribe(
              rels => (this.hasRelationships = rels > 0)
            );
          }
          if (this.type === 'collection' && !this.editing) {
            this.checkIfCollectionIsImported();
          }
        }
        if (!this.editable) this.sidebarService.currentTab = 'search';
      }
    });
    this.route.queryParams.subscribe(params => {
      const editingRequested =
        params['editing'] && this.authenticationService.canEdit();
      if (!editingRequested) {
        this.editing = false;
        return;
      }

      this.canEditCurrentObject().subscribe(canEdit => {
        this.editing = canEdit;
        if (!canEdit) this.blockProtectedMitreIdentityEdit();
      });
    });
  }

  public startEditing() {
    if (this.editable) {
      this.canEditCurrentObject().subscribe(canEdit => {
        if (canEdit)
          this.router.navigate([], { queryParams: { editing: true } });
        else this.blockProtectedMitreIdentityEdit();
      });
    }
  }

  private canEditCurrentObject(): Observable<boolean> {
    if (!this.isProtectedMitreIdentityRoute()) return of(true);

    return this.apiService
      .getMitreIdentityWrites()
      .pipe(map(config => config.enabled));
  }

  private isProtectedMitreIdentityRoute(): boolean {
    return this.type === 'identity' && this.stixId === MITRE_IDENTITY_STIX_ID;
  }

  private blockProtectedMitreIdentityEdit(): void {
    this.editing = false;
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
    this.snackbar.open(
      'MITRE identity edits are disabled by system configuration.',
      'dismiss',
      { duration: 4000, panelClass: 'warn' }
    );
  }

  public stopEditing() {
    const prompt = this.dialog.open(ConfirmationDialogComponent, {
      maxWidth: '35em',
      data: {
        message: '# Are you sure you want to discard changes?',
      },
      autoFocus: false, // prevents auto focus on toolbar buttons
    });

    const subscription = prompt.afterClosed().subscribe({
      next: result => {
        if (result) {
          if (!this.router.url.includes('/new'))
            this.router.navigate([], { queryParams: {} });
          else this.router.navigate(['..'], { queryParams: {} });
          this.onEditingStopped.emit(true);
        }
      },
      complete: () => {
        subscription.unsubscribe();
      }, //prevent memory leaks
    });
  }

  //https://stackoverflow.com/questions/38644314/changing-the-page-title-using-the-angular-2-new-router/38652281#38652281
  private getEditableFromRoute(state, parent) {
    const data = [];
    if (parent && parent.snapshot.data && parent.snapshot.data.editable) {
      data.push(parent.snapshot.data.editable);
    }

    if (state && parent) {
      data.push(...this.getEditableFromRoute(state, state.firstChild(parent)));
    }
    return data;
  }

  /**
   * Determine whether or not this object has relationships with other objects
   */
  public getRelationships(): Observable<number> {
    if (this.type == 'data-source') {
      return this.apiService
        .getDataSource(this.stixId, null, 'latest', false, false, true)
        .pipe(
          map(
            dataSource => dataSource[0] && dataSource[0].data_components.length
          )
        );
    } else {
      return this.apiService
        .getRelatedTo({ sourceOrTargetRef: this.stixId })
        .pipe(
          map(relationships => {
            return relationships.data.filter((r: Relationship) => {
              // filter out subtechnique-of relationships, IFF this is the source object (sub-technique)
              // note: the subtechnique-of relationship is automatically deleted with the sub-technique object
              return !(
                r.relationship_type == 'subtechnique-of' &&
                r.source_object &&
                r.source_object['stix']['id'] == this.stixId
              );
            }).length;
          })
        );
    }
  }

  public checkIfCollectionIsImported(): void {
    const modified = this.router.url.split('/')[4];
    const $collections = forkJoin({
      latest: this.apiService.getCollection(this.stixId, null, 'latest'),
      current: this.apiService.getCollection(this.stixId, modified),
    });
    const subscription = $collections.subscribe({
      next: ({ latest, current }) => {
        const latestCollection = latest[0];
        const currentCollection = current[0];
        if (
          !latestCollection.imported &&
          latestCollection.modified > currentCollection.modified
        ) {
          // latest collection with the given stixId is
          // not imported and has a different modified date
          this.hasConvertedCollection = true;
        }
        if (currentCollection.imported) {
          this.editable = false;
          this.isAnImportedCollection = true;
        }
      },
      complete: () => {
        if (subscription) subscription.unsubscribe();
      },
    });
  }
}
