import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { Collection } from 'src/app/classes/stix/collection';
import { Relationship } from 'src/app/classes/stix/relationship';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { VersionNumber } from 'src/app/classes/version-number';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { EditorService } from 'src/app/services/editor/editor.service';
import { StixDialogComponent } from 'src/app/views/stix/stix-dialog/stix-dialog.component';

interface HistoryEvent {
  change_types: {
    versionChanged: boolean; // did the version number change? corresponds to prior_version
    stateChanged: boolean; // did the workflow state change?
    objectCreated: boolean; // was the object created?
    objectImported: boolean; // was the object imported for the first time,
    release: boolean; //for collections, was this a release?
  };
  icon: string; // icon representing the change
  name: string; //name of the object being changed
  description: string; // description of what happened in the event
  sdo: StixObject; // StixObject version corresponding to the event (post-change)
  prior_sdo: StixObject; // StixObject version corresponding to the event (pre-change)
  prior_version?: VersionNumber; // if specified, the version number changed; this field is the prior version number
  prior_state?: string; // if specified, the workflow state changed; this field is the prior workflow state
}

@Component({
  selector: 'app-history-timeline',
  templateUrl: './history-timeline.component.html',
  styleUrls: ['./history-timeline.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class HistoryTimelineComponent implements OnInit, OnDestroy {
  public historyEvents: HistoryEvent[];
  public loading = false;
  public hoveredHistoryEvent: HistoryEvent = null;
  public showObjectHistory = true;
  public showRelationshipHistory = true;
  public showCollectionHistory = true;
  public onEditStopSubscription: Subscription;

  constructor(
    private router: Router,
    private apiService: RestApiConnectorService,
    private dialog: MatDialog,
    private editorService: EditorService
  ) {
    this.onEditStopSubscription = this.editorService.onEditingStopped.subscribe(
      {
        next: () => {
          this.loadHistory();
        },
      }
    );
  }

  ngOnInit(): void {
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.onEditStopSubscription.unsubscribe();
  }

  private buildObjectHistory(objectVersions: StixObject[]): void {
    // ensure that the stix objects are sorted in ascending order of date
    objectVersions = objectVersions.sort(
      (a, b) => (a.modified as any) - (b.modified as any)
    );

    let previousSdo = null;
    let previousVersion = null;
    let previousState = null;
    for (const objectVersion of objectVersions) {
      const versionChanged =
        previousVersion &&
        objectVersion.version.compareTo(previousVersion) != 0;
      const stateChanged =
        previousState && objectVersion.workflow?.state
          ? objectVersion.workflow.state != previousState
          : false;
      const objectCreated =
        objectVersion.created.getTime() == objectVersion.modified.getTime();
      const release =
        objectVersion.attackType == 'collection' &&
        (objectVersion as Collection).release;
      const objectImported = !objectCreated && !previousVersion;

      // set up icon and tooltip
      const [description, icon] = this.getStixObjectEventDescription(
        objectCreated,
        objectImported,
        objectVersion['name']
      );

      // add historyEvent
      this.historyEvents.push({
        change_types: {
          versionChanged: versionChanged,
          stateChanged: stateChanged,
          objectImported: objectImported,
          objectCreated: objectCreated,
          release: release,
        },
        icon: icon,
        name: objectVersion['name'],
        description: description,
        sdo: objectVersion,
        prior_sdo: previousSdo ?? null,
        prior_version: versionChanged ? previousVersion : null,
        prior_state: stateChanged ? previousState : 'unset',
      });
      previousSdo = objectVersion;
      previousVersion = objectVersion.version;
      previousState = objectVersion.workflow
        ? objectVersion.workflow.state
        : 'unset';
    }
  }

  private buildRelationshipHistory(relationships: Relationship[]): void {
    // ensure that the stix objects are sorted in ascending order of date
    relationships = relationships.sort(
      (a, b) => (a.modified as any) - (b.modified as any)
    );

    // group relationships by ID
    const stixIDtoRelVersions = this.groupObjectsById(relationships);

    for (const relationshipID in stixIDtoRelVersions) {
      let previousSdo = null;
      for (const relationshipVersion of stixIDtoRelVersions[relationshipID]) {
        const objectCreated =
          relationshipVersion.created.getTime() ==
          relationshipVersion.modified.getTime();
        const objectImported = !objectCreated && !previousSdo;
        const relationshipName = `${relationshipVersion.source_name} ${relationshipVersion.relationship_type} ${relationshipVersion.target_name}`;

        // set up icon and tooltip
        const [description, icon] = this.getStixObjectEventDescription(
          objectCreated,
          objectImported,
          relationshipName
        );

        this.historyEvents.push({
          change_types: {
            versionChanged: false,
            stateChanged: false,
            objectImported: objectImported,
            objectCreated: objectCreated,
            release: false,
          },
          icon: icon,
          name: relationshipName,
          description: description,
          sdo: relationshipVersion,
          prior_sdo: previousSdo,
        });
        previousSdo = relationshipVersion;
      }
    }
  }

  private buildCollectionHistory(collections: Collection[], stixId): void {
    // ensure that the stix objects are sorted in ascending order of date
    collections = collections.sort(
      (a, b) => (a.modified as any) - (b.modified as any)
    );

    // group collections by ID
    const stixIDtoCollectionVersions = this.groupObjectsById(collections);

    // build historyEvents for collections
    for (const collectionID in stixIDtoCollectionVersions) {
      let inPreviousVersion = false;
      const collectionVersions: Collection[] =
        stixIDtoCollectionVersions[collectionID];
      let previousVersion: VersionNumber = null;
      let previousSdo: Collection = null;
      for (const collectionVersion of collectionVersions) {
        const objectImported =
          collectionVersion.created.getTime() !=
            collectionVersion.modified.getTime() && !previousVersion;
        const objectInCollection = collectionVersion.contents.filter(
          c => c.object_ref == stixId
        );
        const versionChanged =
          previousVersion &&
          collectionVersion.version.compareTo(previousVersion) != 0;

        // get icon and tooltip
        let description;
        let icon;
        if (objectInCollection?.length && objectImported) {
          // object in imported collection
          description = `Imported from ${collectionVersion.name} (v${collectionVersion.version.version})`;
          icon = 'cloud_download';
        } else if (objectInCollection?.length && collectionVersion.release) {
          // object exists in release collection
          description = `Released in ${collectionVersion.name} (v${collectionVersion.version.version})`;
          icon = 'verified';
        } else if (
          objectInCollection?.length &&
          (!inPreviousVersion || versionChanged)
        ) {
          // object added to collection
          description = `Added to ${collectionVersion.name} (v${collectionVersion.version.version})`;
          icon = 'add';
        } else if (!objectInCollection?.length && inPreviousVersion) {
          // object was removed from the collection
          description = `Removed from ${collectionVersion.name} (v${collectionVersion.version.version})`;
          icon = 'remove';
        }

        if (description && icon) {
          this.historyEvents.push({
            change_types: {
              versionChanged: false,
              stateChanged: false,
              objectImported: objectImported,
              objectCreated: false,
              release: collectionVersion.release,
            },
            icon: icon,
            name: collectionVersion.name,
            description: description,
            sdo: collectionVersion,
            prior_sdo: previousSdo,
          });
        }
        previousSdo = collectionVersion;
        inPreviousVersion = objectInCollection.length > 0;
        previousVersion = collectionVersion.version;
      }
    }
  }

  private getStixObjectEventDescription(
    objectCreated: boolean,
    objectImported: boolean,
    name: string
  ): string[] {
    let description = '';
    let icon;
    if (objectCreated) {
      description = `${name} was created`;
      icon = 'add';
    } else if (objectImported) {
      description = `Earliest imported version of ${name}`;
      icon = 'cloud_download';
    } else {
      description = `${name} was edited`;
      icon = 'edit';
    }
    return [description, icon];
  }

  private groupObjectsById(objectVersions: StixObject[]): any {
    const stixIDtoVersions = {};
    for (const version of objectVersions) {
      if (version.stixID in stixIDtoVersions)
        stixIDtoVersions[version.stixID].push(version);
      else stixIDtoVersions[version.stixID] = [version];
    }
    return stixIDtoVersions;
  }

  /**
   * transform the object versions into HistoryEvent objects
   */
  private parseHistory(
    stixId: string,
    objectVersions: StixObject[],
    relationships: Relationship[],
    collections: Collection[]
  ): void {
    // clear previously parsed historyEvents
    this.historyEvents = [];

    // build historyEvents
    this.buildObjectHistory(objectVersions);
    this.buildRelationshipHistory(relationships);
    this.buildCollectionHistory(collections, stixId);

    // sort historyEvents
    this.historyEvents.sort(
      (a, b) => (b.sdo.modified as any) - (a.sdo.modified as any)
    );
  }

  public preview(sdo: StixObject, prior_sdo: StixObject) {
    this.dialog.open(StixDialogComponent, {
      data: {
        object: [sdo, prior_sdo],
        mode: 'diff',
        editable: false,
        sidebarControl: 'disable',
      },
      maxHeight: '75vh',
      autoFocus: false, // prevents auto focus on toolbar buttons
    });
  }

  public loadHistory() {
    this.loading = true;
    const objectType = this.router.url.split('/')[1];
    const objectStixID = this.router.url.split('/')[2].split('?')[0];
    // set up subscribers to get object versions
    let objects$;
    if (objectType == 'software')
      objects$ = this.apiService.getSoftware(objectStixID, null, 'all');
    else if (objectType == 'group')
      objects$ = this.apiService.getGroup(objectStixID, null, 'all');
    else if (objectType == 'matrix')
      objects$ = this.apiService.getMatrix(objectStixID, null, 'all');
    else if (objectType == 'mitigation')
      objects$ = this.apiService.getMitigation(objectStixID, null, 'all');
    else if (objectType == 'tactic')
      objects$ = this.apiService.getTactic(objectStixID, null, 'all');
    else if (objectType == 'campaign')
      objects$ = this.apiService.getCampaign(objectStixID, null, 'all');
    else if (objectType == 'technique')
      objects$ = this.apiService.getTechnique(objectStixID, null, 'all');
    else if (objectType == 'collection')
      objects$ = this.apiService.getCollection(objectStixID, null, 'all');
    else if (objectType == 'data-source')
      objects$ = this.apiService.getDataSource(objectStixID, null, 'all');
    else if (objectType == 'data-component')
      objects$ = this.apiService.getDataComponent(objectStixID, null, 'all');
    else if (objectType == 'asset')
      objects$ = this.apiService.getAsset(objectStixID, null, 'all');
    else if (objectType == 'analytic')
      objects$ = this.apiService.getAnalytic(objectStixID, null, 'all');
    else if (objectType == 'detection-strategy')
      objects$ = this.apiService.getDetectionStrategy(
        objectStixID,
        null,
        'all'
      );

    // set up subscribers to get relationships and collections
    const relationships$ = this.apiService.getRelatedTo({
      sourceOrTargetRef: objectStixID,
      versions: 'all',
      includeDeprecated: true,
    });
    const collections$ = this.apiService.getAllCollections({
      versions: 'all',
    });
    // join subscribers
    const subscription = forkJoin({
      objectVersions: objects$,
      relationships: relationships$,
      collections: collections$,
    }).subscribe({
      next: result => {
        this.parseHistory(
          objectStixID,
          result.objectVersions as StixObject[],
          result.relationships.data as Relationship[],
          result.collections.data as Collection[]
        );
        this.loading = false;
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
  }
}
