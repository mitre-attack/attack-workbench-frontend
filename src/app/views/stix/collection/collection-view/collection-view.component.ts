import { SelectionModel } from '@angular/cdk/collections';
import {
  Component,
  OnInit,
  QueryList,
  ViewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { delay, map, switchMap, tap } from 'rxjs/operators';
import { ValidationData } from 'src/app/classes/serializable';
import {
  Analytic,
  Asset,
  Campaign,
  DataComponent,
  DataSource,
  DetectionStrategy,
  Group,
  Matrix,
  Mitigation,
  Relationship,
  Software,
  StixObject,
  Tactic,
  Technique,
} from 'src/app/classes/stix';
import {
  Collection,
  CollectionDiffCategories,
  VersionReference,
} from 'src/app/classes/stix/collection';
import { AddDialogComponent } from 'src/app/components/add-dialog/add-dialog.component';
import { CollectionUpdateDialogComponent } from 'src/app/components/collection-update-dialog/collection-update-dialog.component';
import { StixListComponent } from 'src/app/components/stix/stix-list/stix-list.component';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { StreamProgress } from 'src/app/services/connectors/collection-stream.service';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { EditorService } from 'src/app/services/editor/editor.service';
import { getRuntimeConfiguration } from 'src/configuration/runtime-configuration';
import { logger } from '../../../../utils/logger';
import { ChangelogCategory } from 'src/app/utils/types';
import { AttackTypeToPlural } from 'src/app/utils/type-mappings';
import { StixViewPage } from '../../stix-view-page';

@Component({
  selector: 'app-collection-view',
  templateUrl: './collection-view.component.html',
  styleUrls: ['./collection-view.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class CollectionViewComponent extends StixViewPage implements OnInit {
  @ViewChildren(StixListComponent) stixLists: QueryList<StixListComponent>;

  public previousRelease: Collection;
  public attackObjects: any[]; // all objects in the knowledge base, unserialized
  public knowledgeBaseCollection: Collection;
  public editingReloadToggle = true;
  public release = false;
  public includeNotes = false;
  public loading = false;
  public validating = false;
  public validationData: ValidationData = null;

  public get collection(): Collection {
    return this.configCurrentObject as Collection;
  }

  // type map for the _t
  private typeMap = {
    'Technique': 'technique',
    'Tactic': 'tactic',
    'Campaign': 'campaign',
    'Software': 'software',
    'Course-of-Action': 'mitigation',
    'MatrixModel': 'matrix',
    'Intrusion-Set': 'group',
    'Data-Source': 'data_source',
    'Data-Component': 'data_component',
    'Asset': 'asset',
    'Analytic': 'analytic',
    'Detection-Strategy': 'detection_strategy',
  };

  public get collectionDownloadURL() {
    return `${getRuntimeConfiguration().apiUrl}/collection-bundles/?collectionId=${this.collection.stixID}&collectionModified=${this.collection.modified.toISOString()}${this.includeNotes ? '&includeNotes=true' : ''}`;
  }

  public get hasTechniques() {
    return this.collectionChanges.technique.object_count > 0;
  }

  public stagedData: VersionReference[] = [];

  public potentialChanges = {
    technique: new CollectionDiffCategories<Technique>(),
    tactic: new CollectionDiffCategories<Tactic>(),
    campaign: new CollectionDiffCategories<Campaign>(),
    software: new CollectionDiffCategories<Software>(),
    relationship: new CollectionDiffCategories<Relationship>(),
    mitigation: new CollectionDiffCategories<Mitigation>(),
    matrix: new CollectionDiffCategories<Matrix>(),
    group: new CollectionDiffCategories<Group>(),
    data_source: new CollectionDiffCategories<DataSource>(),
    data_component: new CollectionDiffCategories<DataComponent>(),
    asset: new CollectionDiffCategories<Asset>(),
    analytic: new CollectionDiffCategories<Analytic>(),
    detection_strategy: new CollectionDiffCategories<DetectionStrategy>(),
  };

  public collectionChanges = {
    technique: new CollectionDiffCategories<Technique>(),
    tactic: new CollectionDiffCategories<Tactic>(),
    campaign: new CollectionDiffCategories<Campaign>(),
    software: new CollectionDiffCategories<Software>(),
    relationship: new CollectionDiffCategories<Relationship>(),
    mitigation: new CollectionDiffCategories<Mitigation>(),
    matrix: new CollectionDiffCategories<Matrix>(),
    group: new CollectionDiffCategories<Group>(),
    data_source: new CollectionDiffCategories<DataSource>(),
    data_component: new CollectionDiffCategories<DataComponent>(),
    asset: new CollectionDiffCategories<Asset>(),
    analytic: new CollectionDiffCategories<Analytic>(),
    detection_strategy: new CollectionDiffCategories<DetectionStrategy>(),
  };

  public collection_import_categories = [];

  public streamProgress$: Observable<StreamProgress>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private restApiConnector: RestApiConnectorService,
    private snackbar: MatSnackBar,
    private editor: EditorService,
    public dialog: MatDialog,
    authenticationService: AuthenticationService
  ) {
    super(authenticationService);
  }

  /**
   * Trigger collection save behaviors
   *
   * @memberof CollectionViewComponent
   */
  public validate() {
    this.validating = true;
    this.validationData = null;
    const subscription = this.collection
      .validate(this.restApiConnector)
      .pipe(
        map(results => {
          // add extra results here
          // must have incremented version number compared to prior release
          if (this.release) {
            results.warnings.push({
              result: 'warning',
              field: 'released',
              message: `this version has been marked as a release. Once a version has been marked as a release, it cannot be un-marked even if you choose not to publish it. This should only be marked as a release if you are sure you intend to publish it.`,
            });
          }

          if (this.previousRelease) {
            if (
              this.collection.version.compareTo(this.previousRelease.version) <=
              0
            ) {
              results.errors.push({
                result: 'error',
                field: 'version',
                message:
                  'version number of the collection must be incremented from previous release',
              });
            } else if (
              this.collection.version.isDoubleIncrement(
                this.previousRelease.version
              )
            ) {
              results.warnings.push({
                result: 'warning',
                field: 'version',
                message: `version number of the collection has been incremented twice (v${this.previousRelease.version.toString()} → v${this.collection.version.toString()})`,
              });
            } else {
              results.successes.push({
                result: 'success',
                field: 'version',
                message:
                  'version number of the collection has been incremented from previous release',
              });
            }
          }

          // check for double increments of version numbers

          // build lookup of STIX ID to version number for new collection
          const collectionStixIDToObject = new Map<string, StixObject>();
          for (const attackType in this.collectionChanges) {
            if (attackType == 'relationship') continue;
            for (const object of this.collectionChanges[attackType].flatten(
              true
            ))
              collectionStixIDToObject.set(object.stixID, object);
          }
          // compare to values in old collection
          if (this.previousRelease) {
            for (const oldObject of this.previousRelease.stix_contents) {
              if (collectionStixIDToObject.has(oldObject.stixID)) {
                //only if was in collection previously
                const newObject = collectionStixIDToObject.get(
                  oldObject.stixID
                );
                const objectName =
                  'name' in newObject ? newObject['name'] : newObject.stixID;
                if (newObject.version.compareTo(oldObject.version) < 0) {
                  results.warnings.push({
                    result: 'warning',
                    field: 'version',
                    message: `version number of ${objectName} has been decremented (v${oldObject.version.toString()} → v${newObject.version.toString()})`,
                  });
                } else if (
                  newObject.version.isDoubleIncrement(oldObject.version)
                ) {
                  results.warnings.push({
                    result: 'warning',
                    field: 'version',
                    message: `version number of ${objectName} has been incremented twice (v${oldObject.version.toString()} → v${newObject.version.toString()})`,
                  });
                }
              }
            }
          }

          //list of identities and marking definitions used in the data
          const identities = new Set<string>();
          const marking_defs = new Set<string>();

          //stage data for saving
          this.stagedData = [];
          const missingATTACKIDs = [];
          for (const object of collectionStixIDToObject.values()) {
            // grab name of objects that do not have ATT&CK IDs
            if (object.supportsAttackID && 'attackID' in object) {
              if (object.attackID === '' && 'name' in object) {
                missingATTACKIDs.push(object['name']);
              }
            }
            // record associated identities/marking defs
            if (object.created_by_ref) identities.add(object.created_by_ref);
            if (object.modified_by_ref) identities.add(object.modified_by_ref);
            for (const marking_ref of object.object_marking_refs)
              marking_defs.add(marking_ref);

            if (object.type == 'marking-definition') continue;

            this.stagedData.push(
              new VersionReference({
                object_ref: object.stixID,
                object_modified: object.modified.toISOString(),
              })
            );
          }
          const previousRelationships = this.previousRelease
            ? new Map<string, StixObject>(
                this.previousRelease.stix_contents
                  .filter(x => x.type == 'relationship')
                  .map(x => [x.stixID, x])
              )
            : new Map<string, StixObject>(); // empty if there was nothing here previously
          // stage relationships for saving and determine stats
          const relationship_stats = {
            total_included: 0,
            new: 0,
            updated: 0,
            unchanged: 0,
            excluded_one: 0,
            excluded_both: 0,
          };
          for (const relationship of this.attackObjects.filter(
            x => x.stix.type == 'relationship'
          )) {
            const rel_id = relationship.stix.id;
            const rel_modified = relationship.stix.modified;

            // record associated identities/marking defs
            if (relationship.created_by_ref)
              identities.add(relationship.stix.created_by_ref);
            if (relationship.modified_by_ref)
              identities.add(relationship.stix.modified_by_ref);
            for (const marking_ref of relationship.stix.object_marking_refs)
              marking_defs.add(marking_ref);

            if (
              collectionStixIDToObject.has(relationship.stix.source_ref) &&
              collectionStixIDToObject.has(relationship.stix.target_ref)
            ) {
              // includes the relationship!
              relationship_stats.total_included++;

              this.stagedData.push(
                new VersionReference({
                  object_ref: rel_id,
                  object_modified: rel_modified,
                })
              );
              // track stats
              if (previousRelationships.has(rel_id)) {
                if (
                  previousRelationships.get(rel_id).modified.toISOString() !=
                  rel_modified
                ) {
                  // new version/updated
                  relationship_stats.updated++;
                } else {
                  //same version
                  relationship_stats.unchanged++;
                }
              } else {
                //new relationship
                relationship_stats.new++;
              }
            } else {
              //missing at least one side
              if (
                collectionStixIDToObject.has(relationship.stix.source_ref) ||
                collectionStixIDToObject.has(relationship.stix.target_ref)
              ) {
                // has at least one side
                // stats
                relationship_stats.excluded_one++;
              } else {
                //missing both sides
                relationship_stats.excluded_both++;
              }
            }
          }

          // add stats to validation
          results.info.push({
            result: 'info',
            field: 'contents',
            message: `${relationship_stats.new} total relationships are included in this release`,
          });
          results.info.push({
            result: 'info',
            field: 'contents',
            message: `${relationship_stats.new} new relationships were added in this release`,
          });
          results.info.push({
            result: 'info',
            field: 'contents',
            message: `${relationship_stats.updated} relationships were updated in this release`,
          });
          results.info.push({
            result: 'info',
            field: 'contents',
            message: `${relationship_stats.unchanged} relationships were unchanged by this release`,
          });
          results.info.push({
            result: 'info',
            field: 'contents',
            message: `${relationship_stats.excluded_one} relationships had only one attached object in the collection and were therefore excluded`,
          });
          results.info.push({
            result: 'info',
            field: 'contents',
            message: `${relationship_stats.excluded_both} relationships had neither attached objects in the collection and were therefore excluded`,
          });
          // Check for missing ATT&CK ids
          if (missingATTACKIDs.length != 0) {
            let customMessage = '';
            if (missingATTACKIDs.length == 1) {
              customMessage = `1 object missing ATT&CK ID: ${missingATTACKIDs[0]}`;
            } else {
              customMessage = `${missingATTACKIDs.length} objects missing ATT&CK IDs: ${missingATTACKIDs}`;
            }
            results.warnings.push({
              result: 'warning',
              field: 'attackID',
              message: customMessage,
            });
          }

          //must have contents
          if (this.stagedData.length == 0)
            results.errors.push({
              result: 'error',
              field: 'contents',
              message: 'the collection has no contents',
            });
          //return validation results and list of misc objects we need to stage
          return {
            results,
            identities: Array.from(identities),
            marking_defs: Array.from(marking_defs),
          };
        }),
        switchMap(results_and_extras => {
          //stage misc objects
          logger.log('staging identities and marking_defs', results_and_extras);
          const apis = {
            identities:
              results_and_extras.identities.length > 0
                ? forkJoin(
                    results_and_extras.identities.map(x =>
                      this.restApiConnector.getIdentity(x)
                    )
                  )
                : of([]),
            marking_defs:
              results_and_extras.marking_defs.length > 0
                ? forkJoin(
                    results_and_extras.marking_defs.map(x =>
                      this.restApiConnector.getMarkingDefinition(x)
                    )
                  )
                : of([]),
          };
          return forkJoin(apis).pipe(
            map(results => {
              const any_results = results as any;
              // add resultant identities and marking defs to staged objects
              for (const identity of any_results.identities) {
                if (!identity[0]) continue; // check if identity exists
                this.stagedData.push(
                  new VersionReference({
                    object_ref: identity[0].stixID,
                    object_modified: identity[0].modified.toISOString(),
                  })
                );
                results_and_extras.results.info.push({
                  result: 'info',
                  field: 'contents',
                  message: `includes objects created/edited by ${identity[0].name}`,
                });
              }
              for (const marking_def of any_results.marking_defs) {
                this.stagedData.push(
                  new VersionReference({
                    object_ref: marking_def[0].stixID,
                  })
                );
                results_and_extras.results.info.push({
                  result: 'info',
                  field: 'contents',
                  message: `includes objects marked "${marking_def[0].definition_string}"`,
                });
              }

              // now return the validation results
              return results_and_extras.results;
            })
          );
        })
      )
      .subscribe({
        next: results => (this.validationData = results),
        complete: () => subscription.unsubscribe(),
      });
  }

  public get saveEnabled() {
    return this.validationData && this.validationData.errors.length == 0;
  }

  public save() {
    this.collection.contents = this.stagedData;
    this.collection.release = this.release;
    const subscription = this.collection.save(this.restApiConnector).subscribe({
      next: result => {
        this.router.navigate([
          result.attackType,
          result.stixID,
          'modified',
          result.modified.toISOString(),
        ]);
        this.validating = false;
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
  }

  public downloadCollectionBundle() {
    this.restApiConnector.downloadCollectionBundle(
      this.collection.stixID,
      this.collection.modified,
      `${this.collection.name.toLowerCase().replace(' ', '-')}-${this.collection.version.toString()}.json`,
      this.includeNotes
    );
  }

  /**
   * Move changes between the potential changes and the collection changes
   * @param {StixObject[]} objects objects to move
   * @param {string} attackType attack type of objects
   * @param {changeCategory} category the category, e.g additions
   * @param {("stage" | "unstage")} direction stage moves to collectionChanges, unstage moves to potentialChanges
   * @param {StixListComponent[]} refs list of stix components to trigger redraws of
   */
  public moveChanges(
    objects: StixObject[],
    attackType: string,
    category: ChangelogCategory,
    direction: 'stage' | 'unstage'
  ): void {
    // Addition: stage
    if (category == 'additions' && direction == 'stage') {
      // - Remove from potential additions
      this.potentialChanges[attackType].remove_objects(objects, 'additions');
      // - Add to additions
      this.collectionChanges[attackType].add_objects(objects, 'additions');
    }

    // Addition: unstage
    else if (category == 'additions' && direction == 'unstage') {
      // - Add to potential additions
      this.potentialChanges[attackType].add_objects(objects, 'additions');
      // - Remove from additions
      this.collectionChanges[attackType].remove_objects(objects, 'additions');
    }

    // Change: stage
    else if (category == 'changes' && direction == 'stage') {
      // - Remove from potential changes
      this.potentialChanges[attackType].remove_objects(objects, 'changes');
      // - Remove from unchanged
      this.collectionChanges[attackType].remove_objects(objects, 'duplicates');
      // remove from minor changes (upgrade type)
      this.collectionChanges[attackType].remove_objects(
        objects,
        'minor_changes'
      );
      // sort object changes into following overwrite categories
      const updates = {
        revocations: [],
        deprecations: [],
        changes: [],
      };
      for (const object of objects) {
        // - If object present in revocations, update presence in revocations
        if (
          this.collectionChanges[attackType].has_object(object, 'revocations')
        ) {
          updates['revocations'].push(object);
        }
        // - Else If object is present in deprecations, update presence in deprecations
        else if (
          this.collectionChanges[attackType].has_object(object, 'deprecations')
        ) {
          updates['deprecations'].push(object);
        }
        // - Else update presence /add in changes
        else {
          updates['changes'].push(object);
        }
      }
      for (const update in updates) {
        this.collectionChanges[attackType].add_objects(updates[update], update);
      }
    }

    // Change: unstage
    else if (category == 'changes' && direction == 'unstage') {
      // - Add to potential changes
      this.potentialChanges[attackType].add_objects(objects, 'changes');
      // - Add to unchanged
      this.collectionChanges[attackType].add_objects(objects, 'duplicates');
      // - Remove from changes
      this.collectionChanges[attackType].remove_objects(objects, 'changes');
    }

    // Minor Change: stage
    else if (category == 'minor_changes' && direction == 'stage') {
      // - Remove from potential minor changes
      this.potentialChanges[attackType].remove_objects(
        objects,
        'minor_changes'
      );
      // - Remove from unchanged
      this.collectionChanges[attackType].remove_objects(objects, 'duplicates');
      // sort object changes into following overwrite categories
      const updates = {
        revocations: [],
        deprecations: [],
        changes: [],
        minor_changes: [],
      };
      for (const object of objects) {
        // - If object present in revocations, update presence in revocations
        if (
          this.collectionChanges[attackType].has_object(object, 'revocations')
        ) {
          updates['revocations'].push(object);
        }
        // - Else If object is present in deprecations, update presence in deprecations
        else if (
          this.collectionChanges[attackType].has_object(object, 'deprecations')
        ) {
          updates['deprecations'].push(object);
        }
        // - Else If object present in changes, update presence in changes
        else if (
          this.collectionChanges[attackType].has_object(object, 'changes')
        ) {
          updates['changes'].push(object);
        }
        // - Else update presence /add in minor changes
        else {
          updates['minor_changes'].push(object);
        }
      }
      for (const update in updates) {
        this.collectionChanges[attackType].add_objects(updates[update], update);
      }
    }

    // Minor Change: unstage
    else if (category == 'minor_changes' && direction == 'unstage') {
      // - Remove from minor changes
      this.collectionChanges[attackType].remove_objects(
        objects,
        'minor_changes'
      );
      // - Add to potential minor changes
      this.potentialChanges[attackType].add_objects(objects, 'minor_changes');
      // - Add to unchanged
      this.collectionChanges[attackType].add_objects(objects, 'duplicates');
    }

    // Revocation: stage
    else if (category == 'revocations' && direction == 'stage') {
      // - Remove from potential revocations
      this.potentialChanges[attackType].remove_objects(objects, 'revocations');
      // - Remove from unchanged
      this.collectionChanges[attackType].remove_objects(objects, 'duplicates');
      // - If object present in changes, remove presence from changes
      this.collectionChanges[attackType].remove_objects(objects, 'changes');
      // - Else If object is present in minor changes, remove presence from minor changes
      this.collectionChanges[attackType].remove_objects(
        objects,
        'minor_changes'
      );
      // - Add to revocations
      this.collectionChanges[attackType].add_objects(objects, 'revocations');
    }

    // Revocation: unstage
    else if (category == 'revocations' && direction == 'unstage') {
      // - Remove from revocations
      this.collectionChanges[attackType].remove_objects(objects, 'revocations');
      // - Add to potential revocations
      this.potentialChanges[attackType].add_objects(objects, 'revocations');
      // - Add to unchanged
      this.collectionChanges[attackType].add_objects(objects, 'duplicates');
    }

    // Deprecation: stage
    else if (category == 'deprecations' && direction == 'stage') {
      // - Remove from potential deprecations
      this.potentialChanges[attackType].remove_objects(objects, 'deprecations');
      // - Remove from unchanged
      this.collectionChanges[attackType].remove_objects(objects, 'duplicates');
      // - If object present in changes, remove presence from changes
      this.collectionChanges[attackType].remove_objects(objects, 'changes');
      // - Else If object is present in minor changes, remove presence from minor changes
      this.collectionChanges[attackType].remove_objects(
        objects,
        'minor_changes'
      );
      // - Add to deprecations
      this.collectionChanges[attackType].add_objects(objects, 'deprecations');
    }

    // Deprecation: unstage
    else if (category == 'deprecations' && direction == 'unstage') {
      // - Remove from deprecations
      this.collectionChanges[attackType].remove_objects(
        objects,
        'deprecations'
      );
      // - Add to potential deprecations
      this.potentialChanges[attackType].add_objects(objects, 'deprecations');
      // - Add to unchanged
      this.collectionChanges[attackType].add_objects(objects, 'duplicates');
    }

    // after any update, update the lists since contents may have changed
    setTimeout(() => {
      //update lists after a render cycle
      this.stixLists.forEach(list => {
        list.applyControls();
      });
    });
  }

  /**
   * Determine if the auto add objects button is disabled
   * for a given attack type
   * @param {string} attackType the type of object to add
   * @returns {boolean} false, if objects of this type can be added
   * (button is not disabled), true otherwise (button is disabled)
   */
  public autoAddDisabled(attackType: string): boolean {
    if (attackType == 'tactic') return !this.hasTechniques;
    return true; // only tactics are currently supported for this feature
  }

  /**
   * Open the update dialog to automatically find and add
   * related objects to the collection
   * @param {string} attackType the type of objects to add to the collection
   */
  public addObjectsToCollection(attackType: string): void {
    const prompt = this.dialog.open(CollectionUpdateDialogComponent, {
      data: {
        collectionChanges: this.collectionChanges,
        potentialChanges: this.potentialChanges,
        attackType: attackType,
      },
      maxHeight: '75vh',
    });
    const subscription = prompt.afterClosed().subscribe({
      next: result => {
        if (result) {
          // reinitialize stix lists
          this.editingReloadToggle = false;
          setTimeout(() => (this.editingReloadToggle = true));
        }
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
  }

  /**
   * Get the display text list of object types that will be used
   * to identify objects to automatically add to the collection
   * @param attackType the type of objects to add to the collection
   * @returns {string} display text of relevant objects
   */
  public relevantObjects(attackType: string): string {
    if (attackType == 'tactic') return 'techniques';
    return 'objects'; // only tactics are currently supported for auto-add
  }

  ngOnInit() {
    //set up subscription to route query params to reinitialize stix lists
    this.route.queryParams.subscribe(() => {
      //reinitialize stix lists in case editing has changed and they have different configs now
      this.editingReloadToggle = false;
      setTimeout(() => (this.editingReloadToggle = true));
    });

    // prepare additional data loading
    this.loading = true;
    const apis = {
      attackObjects: this.restApiConnector.getAllObjects({
        revoked: true,
        deprecated: true,
        deserialize: false,
      }),
    };

    // fetch previous version if this was not a new collection
    const objectStixID = this.editor.stixId;
    if (objectStixID && objectStixID != 'new') {
      // Check if collection was loaded without contents (common for list views)
      if (
        (!this.collection.stix_contents ||
          this.collection.stix_contents.length === 0) &&
        this.collection.contents &&
        this.collection.contents.length > 0
      ) {
        // Collection has content references but not the actual objects
        // This means we need to load the full collection with contents

        // Stream the collection contents
        const { collection$, streamProgress$ } =
          this.restApiConnector.getCollectionStream(
            this.collection.stixID,
            this.collection.modified,
            true // retrieveContents
          );

        this.streamProgress$ = streamProgress$;
        const streamSub = collection$.subscribe({
          next: streamedCollection => {
            // Update the existing collection object with streamed data
            this.collection.stix_contents = streamedCollection.stix_contents;
            this.collection.streaming = streamedCollection.streaming;
          },
          error: err => {
            logger.error('Failed to stream collection contents:', err);
            this.loading = false;
            this.snackbar.open('Error loading collection contents', null, {
              duration: 5000,
              panelClass: 'error',
            });
          },
          complete: () => {
            if (streamSub) streamSub.unsubscribe();
            // Continue with the rest of initialization
            this.continueInitialization(apis);
          },
        });

        return; // Exit early, will continue in the subscription
      }

      apis['previousRelease'] = this.restApiConnector
        .getCollection(this.collection.stixID, null, 'all', false)
        .pipe(
          switchMap(collections => {
            // are there newer versions? if so, disable editing
            if (
              collections.some(
                collection =>
                  collection.modified.toISOString() >
                  this.collection.modified.toISOString()
              )
            ) {
              this.collection.editable = false;
              this.editor.editable = false;
            }
            // get the most recent version which was released for comparison
            const last_version = collections.find(
              collection => collection.release
            );
            if (last_version) {
              return this.restApiConnector
                .getCollection(
                  this.collection.stixID,
                  last_version.modified,
                  'latest',
                  null,
                  true
                )
                .pipe(map(full_collection => full_collection[0]));
            } else {
              logger.log('no prior release of this collection');
              return of(null); //no prior release
            }
          })
        );
    }

    // For new collections or collections that don't need streaming, continue with normal initialization
    this.continueInitialization(apis);
  }

  private continueInitialization(apis: any) {
    // fetch previous collection and objects in knowledge base
    const subscription = forkJoin(apis)
      .pipe(
        tap(() => {
          this.loading = true;
        }),
        delay(1) // allow render cycle to display loading text
      )
      .subscribe({
        next: result => {
          const anyResult = result as any;
          this.attackObjects = result['attackObjects'];
          //make sure "previous" release wasn't this release
          if ('previousRelease' in anyResult && anyResult['previousRelease']) {
            this.previousRelease = result['previousRelease'];
            this.collectionChanges = this.collection.compareTo(
              this.previousRelease
            );
          } else {
            this.collectionChanges = this.collection.compareTo(
              new Collection()
            ); // compare to empty
          }
          // initialize potentialChanges based off diff of attackObjects vs contents of collection
          // create a "collection" to represent the entire ATT&CK dataset
          this.knowledgeBaseCollection = new Collection({
            stix: {
              x_mitre_contents: this.attackObjects
                .filter(x => 'modified' in x.stix && x.stix.modified)
                .map(x => {
                  return {
                    object_ref: x.stix.id,
                    object_modified: x.stix.modified,
                  };
                }),
            },
            contents: this.attackObjects,
          });
          this.potentialChanges = this.knowledgeBaseCollection.compareTo(
            this.collection
          );
          // for a new collection we not have to option to create it from a groupId
          // stixObjectID is not set to 'new' for some reason
          if (this.route.snapshot.data.breadcrumb == 'new collection') {
            const groupId = this.route.snapshot.queryParams['groupId'];
            if (groupId) {
              this.updateCollectionFromGroup(groupId, 'add', true);
            }
          }
        },
        complete: () => {
          this.loading = false;
          subscription.unsubscribe();
        },
      });
  }

  /**
   * Handler for the import groups to the collection button
   */
  private handleImportGroups(): void {
    // add the list of all groups currently and potentially in the collection and we have a list of all the possible groups to import to our selection w/o making any API calls
    const allGroups = this.potentialChanges['group'].additions.concat(
      this.collectionChanges['group'].additions
    );
    const select = new SelectionModel(true);
    const prompt = this.dialog.open(AddDialogComponent, {
      maxWidth: '70em',
      maxHeight: '70em',
      data: {
        title: `Select groups which you wish to import into the collection`,
        selectableObjects: allGroups,
        select: select,
        type: 'group',
        buttonLabel: 'import groups into collection',
      },
    });
    let numOfGroups = 0;
    const subscription = prompt.afterClosed().subscribe({
      next: response => {
        if (response) {
          const newSelectedGroupStixIds = select.selected;
          numOfGroups = newSelectedGroupStixIds.length;
          for (const groupIdToAdd of newSelectedGroupStixIds) {
            this.updateCollectionFromGroup(groupIdToAdd, 'add', false);
          }
        }
      },
      complete: () => {
        this.snackbar.open(
          `Added ${numOfGroups} group${numOfGroups > 1 ? 's' : ''} and their related objects to collection`,
          null,
          { duration: 5000, panelClass: 'success' }
        );
        subscription.unsubscribe(); //prevent memory leaks
      },
    });
  }

  public format(attackType: string): string {
    return attackType.replace(/-/g, ' ');
  }

  public plural(attackType: string) {
    return this.format(AttackTypeToPlural[attackType]);
  }

  /**
   * Adds or removes ALL objects within a group to the staged collection
   * @param {string} groupId the groupId to create a collection from
   * @param {string} direction either 'add' or 'remove' selects whether thr objects will be added to the current collection or removed from it
   * @param {boolean} fromPageLoad whether this request is coming from the initial page load of a new collection (if true will change the collection name and description)
   */
  private updateCollectionFromGroup(groupId, direction, fromPageLoad): void {
    if (fromPageLoad) {
      this.loading = true;
    }

    const apiCalls = {
      group: this.restApiConnector.getGroup(groupId),
      relationships: this.restApiConnector.getRelatedTo({
        sourceOrTargetRef: groupId,
      }),
    };

    const subscription = forkJoin(apiCalls)
      .pipe()
      .subscribe({
        next: (result: any) => {
          if (fromPageLoad) {
            this.collection.name = `Collection from Group "${result['group'][0].name}"`;
            this.collection.description = `This collection contains group "${result['group'][0].name}" and its related objects.`;
          }
          // add or remove the group
          if (direction == 'add') {
            this.moveChanges(result['group'], 'group', 'additions', 'stage');
          } else if (direction == 'remove') {
            this.moveChanges(result['group'], 'group', 'additions', 'unstage');
          }
          // add or remove the related objects
          for (const relationship of result['relationships'].data) {
            let reference = '';
            if (relationship['target_ref'] == groupId) {
              reference = 'source_object';
            } else if (relationship['source_ref'] == groupId) {
              reference = 'target_object';
            }
            let object = relationship[reference];
            const type = this.typeMap[object.__t];
            if (type == 'technique') {
              object = new Technique(object);
            } else if (type == 'tactic') {
              object = new Tactic(object);
            } else if (type == 'campaign') {
              object = new Campaign(object);
            } else if (type == 'software') {
              object = new Software(object.stix.type, object);
            } else if (type == 'mitigation') {
              object = new Mitigation(object);
            } else if (type == 'matrix') {
              object = new Matrix(object);
            } else if (type == 'data_source') {
              object = new DataSource(object);
            } else if (type == 'data_component') {
              object = new DataComponent(object);
            } else {
              continue;
            }
            if (direction == 'add') {
              this.moveChanges([object], type, 'additions', 'stage');
            } else if (direction == 'remove') {
              this.moveChanges([object], type, 'additions', 'unstage');
            }
          }
        },
        complete: () => {
          subscription.unsubscribe();
          this.loading = false;
        },
      });
  }
}
