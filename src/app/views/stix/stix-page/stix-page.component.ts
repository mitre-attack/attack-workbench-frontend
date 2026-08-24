import {
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  Output,
  EventEmitter,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';

import { Observable, forkJoin } from 'rxjs';
import {
  DetectionStrategy,
  Note,
  Software,
  StixObject,
} from 'src/app/classes/stix';
import { concatMap } from 'rxjs/operators';
import { Collection } from 'src/app/classes/stix/collection';
import { VersionNumber } from 'src/app/classes/version-number';
import { DeleteDialogComponent } from 'src/app/components/delete-dialog/delete-dialog.component';
import { MultipleChoiceDialogComponent } from 'src/app/components/multiple-choice-dialog/multiple-choice-dialog.component';
import { SaveDialogComponent } from 'src/app/components/save-dialog/save-dialog.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { EditorService } from 'src/app/services/editor/editor.service';
import { TitleService } from 'src/app/services/title/title.service';
import { CollectionViewComponent } from '../collection/collection-view/collection-view.component';
import { MarkingDefinitionViewComponent } from '../marking-definition-view/marking-definition-view.component';
import { StixViewConfig } from '../stix-view-page';
import { BreadcrumbService } from 'src/app/services/helpers/breadcrumb.service';
import { AttackTypeToClass } from 'src/app/utils/class-mappings';
import { StixJsonDialogComponent } from 'src/app/components/stix-json-dialog/stix-json-dialog.component';

@Component({
  selector: 'app-stix-page',
  templateUrl: './stix-page.component.html',
  styleUrls: ['./stix-page.component.scss'],
  standalone: false,
})
export class StixPageComponent implements OnInit, OnDestroy {
  public objects: StixObject[];
  public initialVersion: VersionNumber;
  public objectType: string;
  private objectID: string;
  private oldAnalytics = new Set<string>();
  private routerEvents;
  private saveSubscription;
  private deleteSubscription;
  private reloadSubscription;
  private stixSubscription;

  @Output() created = new EventEmitter();

  @ViewChild(CollectionViewComponent)
  private collectionViewComponent: CollectionViewComponent;
  @ViewChild(MarkingDefinitionViewComponent)
  private markingDefinitionViewComponent: MarkingDefinitionViewComponent;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private restApiService: RestApiConnectorService,
    private breadcrumbService: BreadcrumbService,
    private editorService: EditorService,
    private dialog: MatDialog,
    private titleService: TitleService
  ) {}

  /**
   * Parse an object list and build a config for passing into child components
   * @param {StixObject} objects the objects to display
   * @param {allVersions} return all versions instead of just a single version
   * @returns {StixViewConfig} the built config
   */
  public buildConfig(): StixViewConfig {
    return {
      mode: this.editorService.editing ? 'edit' : 'view',
      object: this.objects[0],
    };
  }

  private save() {
    if (this.objectType == 'collection') {
      // pass into collection property component
      this.collectionViewComponent.validate();
    } else if (this.objectType == 'marking-definition') {
      // pass into marking definition property component
      this.markingDefinitionViewComponent.validate();
    } else {
      const versionChanged =
        this.objects[0].version.compareTo(this.initialVersion) != 0;
      const prompt = this.dialog.open(SaveDialogComponent, {
        // increment version number save panel
        data: {
          object: this.objects[0],
          // patch LinkByIds on other objects if this object's ATT&CK ID has changed
          patchId:
            this.objects[0].supportsAttackID &&
            this.objectID &&
            this.objectID != this.objects[0].attackID
              ? this.objectID
              : undefined,
          patchAnalytics:
            this.objectType === 'detection-strategy' &&
            this.analyticsChanged(
              this.oldAnalytics,
              new Set<string>(
                (this.objects[0] as DetectionStrategy)?.analytics ?? []
              )
            )
              ? this.oldAnalytics
              : undefined,
          versionAlreadyIncremented: versionChanged,
          showWorkflow: this.editorService.hasWorkflow,
        },
        autoFocus: false, // prevent auto focus on form field
      });

      const subscription = prompt.afterClosed().subscribe({
        next: result => {
          if (result) {
            this.router.navigate([
              this.objects[0].attackType,
              this.objects[0].stixID,
            ]);
            setTimeout(() => {
              this.loadObjects();
            }, 500);
            this.editorService.onEditingStopped.emit();
          }
        },
        complete: () => {
          subscription.unsubscribe();
        }, // prevent memory leaks
      });
    }
  }

  private delete() {
    const prompt = this.dialog.open(DeleteDialogComponent, {
      maxWidth: '35em',
      disableClose: true,
      autoFocus: false,
      data: {
        collectionDelete: this.objectType == 'collection',
        stixId: this.objects[0]?.stixID,
      },
    });
    const closeSubscription = prompt.afterClosed().subscribe({
      next: confirm => {
        if (confirm) {
          const deleteSubscription = this.deleteObjects().subscribe({
            complete: () => {
              this.router.navigate(['..'], { relativeTo: this.route });
              deleteSubscription.unsubscribe();
            },
          });
        }
      },
      complete: () => closeSubscription.unsubscribe(),
    });
  }

  private deleteObjects() {
    return this.restApiService.getAllNotes().pipe(
      concatMap(notes => {
        const delObject = this.objects[0];
        const relatedNotes = (notes.data as Note[]).filter(note =>
          note.object_refs.includes(delObject.stixID)
        );
        if (
          delObject.attackType == 'technique' &&
          delObject['is_subtechnique']
        ) {
          // if sub-technique, delete the 'subtechnique-of' relationship
          return this.restApiService
            .getRelatedTo({
              sourceRef: delObject.stixID,
              relationshipType: 'subtechnique-of',
            })
            .pipe(
              concatMap(sub_relationship => {
                const noteSubs = relatedNotes.map(note =>
                  note.delete(this.restApiService)
                );
                const relSubs = sub_relationship.data.map(r =>
                  r.delete(this.restApiService)
                );
                const sub_api_calls = [
                  ...noteSubs,
                  ...relSubs,
                  delObject.delete(this.restApiService),
                ];
                return forkJoin(sub_api_calls);
              })
            );
        }
        const noteSubscribers = relatedNotes.map(note =>
          note.delete(this.restApiService)
        );
        const api_calls = [
          ...noteSubscribers,
          delObject.delete(this.restApiService),
        ];
        if (
          delObject.attackType == 'collection' &&
          (delObject as Collection).imported
        ) {
          this.editorService.onDeleteImportedCollection.emit();
          api_calls.push(
            this.restApiService.deleteCollection(
              delObject.stixID,
              true,
              delObject.modified.toISOString()
            )
          );
        }
        return forkJoin(api_calls);
      })
    );
  }

  ngOnInit(): void {
    this.loadObjects();
    this.saveSubscription = this.editorService.onSave.subscribe({
      next: () => this.save(),
    });
    this.deleteSubscription = this.editorService.onDelete.subscribe({
      next: () => this.delete(),
    });
    this.reloadSubscription = this.editorService.onReload.subscribe({
      next: () => {
        this.objects = undefined;
        this.loadObjects();
      },
    });
    this.stixSubscription = this.editorService.viewStix.subscribe({
      next: () => this.viewStix(),
    });
    this.routerEvents = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        // Load objects when navigation ends successfully
        this.loadObjects();
      }
    });
  }

  private analyticsChanged(
    oldAnalytics: Set<string>,
    newAnalytics: Set<string>
  ) {
    return (
      oldAnalytics?.size !== newAnalytics?.size ||
      ![...newAnalytics].every(a => oldAnalytics.has(a))
    );
  }

  private viewStix() {
    const prompt = this.dialog.open(StixJsonDialogComponent, {
      maxWidth: '45em',
      autoFocus: false,
      data: {
        stixObject: this.objects[0],
      },
    });
    const closeSubscription = prompt.afterClosed().subscribe({
      complete: () => closeSubscription.unsubscribe(),
    });
  }

  /**
   * Load the objects for this page from the REST API
   * @memberof StixPageComponent
   */
  private loadObjects(): void {
    this.objectType = this.router.url.split('/')[1];
    const objectStixID = this.route.snapshot.params['id'];
    const objectModified = this.route.snapshot.params['modified'];
    if (objectStixID && objectStixID != 'new') {
      // get objects at REST API
      let objects$: Observable<StixObject[]>;
      if (this.objectType == 'software')
        objects$ = this.restApiService.getSoftware(objectStixID);
      else if (this.objectType == 'group')
        objects$ = this.restApiService.getGroup(objectStixID);
      else if (this.objectType == 'campaign')
        objects$ = this.restApiService.getCampaign(objectStixID);
      else if (this.objectType == 'matrix')
        objects$ = this.restApiService.getMatrix(objectStixID);
      else if (this.objectType == 'mitigation')
        objects$ = this.restApiService.getMitigation(objectStixID);
      else if (this.objectType == 'tactic')
        objects$ = this.restApiService.getTactic(objectStixID);
      else if (this.objectType == 'technique')
        objects$ = this.restApiService.getTechnique(
          objectStixID,
          null,
          'latest',
          true
        );
      else if (this.objectType == 'collection')
        /**
         * Note: This only loads the collection object without
         * retrieving the full set of contained STIX objects.
         * The contents are streamed and managed separately
         * by the CollectionView child component, which handles
         * progress updates and additional processing.
         */
        objects$ = this.restApiService.getCollection(
          objectStixID,
          objectModified,
          'latest',
          false,
          false, // retrieveContents <- do not load contents
          false,
          { preferStream: true }
        );
      else if (this.objectType == 'data-source')
        objects$ = this.restApiService.getDataSource(
          objectStixID,
          null,
          'latest',
          false,
          false,
          true
        );
      else if (this.objectType == 'data-component')
        objects$ = this.restApiService.getDataComponent(objectStixID);
      else if (this.objectType == 'detection-strategy')
        objects$ = this.restApiService.getDetectionStrategy(objectStixID);
      else if (this.objectType == 'analytic')
        objects$ = this.restApiService.getAnalytic(
          objectStixID,
          null,
          'latest',
          null,
          null,
          null,
          { includeRefs: true }
        );
      else if (this.objectType == 'asset')
        objects$ = this.restApiService.getAsset(objectStixID);
      else if (this.objectType == 'identity')
        objects$ = this.restApiService.getIdentity(objectStixID);
      else if (this.objectType == 'marking-definition')
        objects$ = this.restApiService.getMarkingDefinition(objectStixID);
      const subscription = objects$.subscribe({
        next: result => {
          this.updateBreadcrumbs(result, this.objectType);
          this.objects = result;
          if (objectModified)
            this.objects = this.objects.filter(
              x => x.modified.toISOString() == objectModified
            ); //filter to just the object with that date
          if (this.objects.length > 0)
            this.initialVersion = new VersionNumber(
              this.objects[0].version.toString()
            );
          this.objectID = this.objects[0].supportsAttackID
            ? this.objects[0].attackID
            : null;
          if (this.objectType == 'detection-strategy') {
            // set up changes to analytic list for analytic URL patching
            const det = this.objects[0] as DetectionStrategy;
            this.oldAnalytics = new Set<string>(det?.analytics ?? []);
          }
        },
        complete: () => {
          if (subscription) subscription.unsubscribe();
        },
      });
    } else if (this.objectType == 'software') {
      // ask the user what sub-type of software they want to create
      const prompt = this.dialog.open(MultipleChoiceDialogComponent, {
        maxWidth: '35em',
        disableClose: true,
        data: {
          title: 'Create a malware or a tool?',
          choices: [
            {
              label: 'malware',
              description:
                'Commercial, custom closed source, or open source software intended to be used for malicious purposes by adversaries.',
            },
            {
              label: 'tool',
              description:
                'Commercial, open-source, built-in, or publicly available software that could be used by a defender, pen tester, red teamer, or an adversary.',
            },
          ],
        },
      });
      const subscription = prompt.afterClosed().subscribe({
        next: result => {
          this.objects = [new Software(result)];
          this.initialVersion = new VersionNumber(
            this.objects[0].version.toString()
          );
          this.updateBreadcrumbs(this.objects, this.objectType);
        },
        complete: () => {
          subscription.unsubscribe();
        },
      });
    } else {
      // create a new object to edit
      this.objects = [];
      this.objects.push(new AttackTypeToClass[this.objectType]());
      this.initialVersion = new VersionNumber(
        this.objects[0].version.toString()
      );
      this.updateBreadcrumbs(this.objects, this.objectType);
    }
  }

  ngOnDestroy() {
    this.saveSubscription.unsubscribe();
    this.deleteSubscription.unsubscribe();
    this.reloadSubscription.unsubscribe();
    this.stixSubscription.unsubscribe();
    this.routerEvents.unsubscribe();
  }

  private updateBreadcrumbs(result, objectType) {
    if (result.length == 0) {
      this.breadcrumbService.changeBreadcrumb(
        this.route.snapshot,
        'object not found'
      );
      this.titleService.setTitle('object not found', true);
    } else if ('name' in result[0] && result[0].name) {
      this.breadcrumbService.changeBreadcrumb(
        this.route.snapshot,
        result[0].name
      );
      this.titleService.setTitle(result[0].name, false);
    } else if (objectType == 'marking-definition') {
      if ('definition_string' in result[0] && result[0].definition_string) {
        this.breadcrumbService.changeBreadcrumb(
          this.route.snapshot,
          `marking definition`
        );
        this.titleService.setTitle(`Marking Definition`);
      } else {
        this.breadcrumbService.changeBreadcrumb(
          this.route.snapshot,
          `new ${objectType.replace(/-/g, ' ')}`
        );
        this.titleService.setTitle(`New Marking Definition`);
      }
    } else {
      this.breadcrumbService.changeBreadcrumb(
        this.route.snapshot,
        `new ${objectType.replace(/-/g, ' ')}`
      );
      this.titleService.setTitle(`new ${objectType}`);
    }
  }
}
