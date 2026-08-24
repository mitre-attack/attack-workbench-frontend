import { SelectionModel } from '@angular/cdk/collections';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Relationship } from 'src/app/classes/stix/relationship';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { EditorService } from 'src/app/services/editor/editor.service';
import { AddDialogComponent } from '../add-dialog/add-dialog.component';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { forkJoin } from 'rxjs';
import { WorkflowStatusMap } from 'src/app/utils/types';

@Component({
  selector: 'app-object-status',
  template: '',
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class ObjectStatusComponent implements OnInit {
  public loaded = false;
  public select: SelectionModel<string>;
  public workflows = Object.entries(WorkflowStatusMap);
  public objects: StixObject[];
  public object: StixObject;
  public relationships = [];
  public revoked = false;
  public deprecated = false;

  public get disabled(): boolean {
    return (
      this.editorService.editing || this.editorService.type == 'collection'
    );
  }

  public get revokeDisabled(): boolean {
    return this.disabled || this.deprecated || !this.objects;
  }

  public get revokeTooltip(): string {
    return this.object?.revoked || this.revoked ? 'already revoked' : 'revoke';
  }

  public get deprecateDisabled(): boolean {
    return this.disabled || this.revoked || !this.objects;
  }

  public get deprecateTooltip(): string {
    return this.object?.deprecated || this.deprecated
      ? 'already deprecated'
      : 'deprecate';
  }

  constructor(
    public editorService: EditorService,
    private restAPIService: RestApiConnectorService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  public loadData() {
    if (!this.editorService.stixId || this.editorService.stixId == 'new')
      return;
    if (this.loaded && this.object && this.objects) return;

    let data$;
    const options = {
      includeRevoked: true,
      includeDeprecated: true,
    };
    if (this.editorService.stixId && this.editorService.stixId != 'new') {
      // don't load if the object doesn't exist yet
      // retrieve object
      if (this.editorService.type == 'software')
        data$ = this.restAPIService.getAllSoftware(options);
      else if (this.editorService.type == 'group')
        data$ = this.restAPIService.getAllGroups(options);
      else if (this.editorService.type == 'matrix')
        data$ = this.restAPIService.getAllMatrices(options);
      else if (this.editorService.type == 'mitigation')
        data$ = this.restAPIService.getAllMitigations(options);
      else if (this.editorService.type == 'tactic')
        data$ = this.restAPIService.getAllTactics(options);
      else if (this.editorService.type == 'campaign')
        data$ = this.restAPIService.getAllCampaigns(options);
      else if (this.editorService.type == 'technique')
        data$ = this.restAPIService.getAllTechniques(options);
      else if (this.editorService.type == 'collection')
        data$ = this.restAPIService.getAllCollections(options);
      else if (this.editorService.type == 'data-source')
        data$ = this.restAPIService.getAllDataSources(options);
      else if (this.editorService.type == 'data-component')
        data$ = this.restAPIService.getAllDataComponents(options);
      else if (this.editorService.type == 'asset')
        data$ = this.restAPIService.getAllAssets(options);
      else if (this.editorService.type == 'analytic')
        data$ = this.restAPIService.getAllAnalytics(options);
      else if (this.editorService.type == 'detection-strategy')
        data$ = this.restAPIService.getAllDetectionStrategies(options);
      const objSubscription = data$.subscribe({
        next: data => {
          this.objects = data.data;
          this.object = this.objects.find(
            object => object.stixID === this.editorService.stixId
          );
          if (this.object) {
            this.revoked = this.object.revoked;
            this.deprecated = this.object.deprecated;
          }
        },
        complete: () => {
          objSubscription.unsubscribe();
        },
      });

      if (this.editorService.type == 'data-source') {
        // retrieve related data components & their relationships
        data$ = this.restAPIService.getAllRelatedToDataSource(
          this.editorService.stixId
        );
        const dataSubscription = data$.subscribe({
          next: results => {
            this.relationships = this.relationships.concat(results);
          },
          complete: () => {
            dataSubscription.unsubscribe();
          },
        });
      }

      // retrieve relationships with the object
      data$ = this.restAPIService.getRelatedTo({
        sourceOrTargetRef: this.editorService.stixId,
      });
      const relSubscription = data$.subscribe({
        next: data => {
          const relationships = data.data as Relationship[];
          this.relationships = this.relationships.concat(relationships);
          this.loaded = true;
        },
        complete: () => {
          relSubscription.unsubscribe();
        },
      });
    }
  }

  private save() {
    const saveSubscription = this.object.save(this.restAPIService).subscribe({
      complete: () => {
        this.editorService.onReload.emit();
        saveSubscription.unsubscribe();
      },
    });
  }

  public revoke() {
    if (!this.loaded || !this.object || !this.objects) return;
    if (this.revokeDisabled) return;
    this.setRevoke(!this.revoked);
  }

  public toggleDeprecated() {
    if (!this.loaded || !this.object || !this.objects) return;
    if (this.deprecateDisabled) return;
    this.setDeprecated(!this.deprecated);
  }

  private setRevoke(revoked: boolean) {
    this.revoked = revoked;
    if (revoked) {
      // revoke object
      // prompt for revoking object
      this.select = new SelectionModel<string>();
      const revokeDialogData = {
        selectableObjects: this.objects.filter(object => {
          return object.stixID !== this.editorService.stixId;
        }),
        type: this.editorService.type,
        select: this.select,
        selectionType: 'one',
        title: 'Select the revoking object',
        buttonLabel: 'revoke',
        showPreserveRelationshipsOption: true,
        preserveRelationships: false,
      };
      const revokedDialog = this.dialog.open(AddDialogComponent, {
        maxWidth: '70em',
        maxHeight: '70em',
        data: revokeDialogData,
        autoFocus: false, // prevents auto focus on toolbar buttons
      });
      const revokedSubscription = revokedDialog.afterClosed().subscribe({
        next: result => {
          if (result && this.select.selected.length) {
            this.revokeObject(revokeDialogData.preserveRelationships);
          } else {
            // user cancelled or no object selected
            this.revoked = false;
          }
        },
        complete: () => {
          revokedSubscription.unsubscribe();
        },
      });
    } else {
      // unrevoke object, deprecate the 'revoked-by' relationship
      // this is the only case in which a 'revoked-by' relationship is deprecated
      const revokedRelationship = this.relationships.find(
        r =>
          r.relationship_type == 'revoked-by' &&
          r.source_ref == this.object.stixID
      );
      if (revokedRelationship) {
        revokedRelationship.deprecated = true;
        revokedRelationship.save(this.restAPIService);
      }
      this.revoked = false;
      this.object.revoked = false;
      this.save();
    }
  }

  private setDeprecated(deprecated: boolean) {
    this.deprecated = deprecated;
    if (deprecated) {
      this.deprecateObjects(false);
    } else {
      this.object.deprecated = false;
      this.save();
    }
  }

  private revokeObject(preserveRelationships = false) {
    const revokingObjectId = this.select.selected[0];
    const revokingObject = this.objects.find(
      object => object.stixID === revokingObjectId
    );

    if (!revokingObject?.modified) {
      this.revoked = false;
      return;
    }

    const revokePayload = {
      revoking: {
        stixId: revokingObject.stixID,
        modified: revokingObject.modified.toISOString(),
      },
    };

    const revoke = this.object.revoke?.(
      this.restAPIService,
      revokePayload,
      preserveRelationships
    );
    if (!revoke) {
      this.revoked = false;
      return;
    }

    const revokeSubscription = revoke.subscribe({
      complete: () => {
        this.editorService.onReload.emit();
        revokeSubscription.unsubscribe();
      },
      error: () => {
        this.revoked = false;
      },
    });
  }

  /**
   * Deprecates or revokes the object and deprecates all relationships with this object,
   * with the exception of 'subtechnique-of' relationships
   */
  private deprecateObjects(revoked: boolean, revoked_by_id?: string) {
    const saves = [];

    // inform users of relationship changes
    const confirmationPrompt = this.dialog.open(ConfirmationDialogComponent, {
      maxWidth: '35em',
      data: {
        message:
          'All relationships with this object will be deprecated. Do you want to continue?',
      },
      autoFocus: false, // prevents auto focus on toolbar buttons
    });

    const confirmationSub = confirmationPrompt.afterClosed().subscribe({
      next: result => {
        if (!result) {
          // user cancelled
          if (revoked) this.revoked = false;
          else this.deprecated = false;
          return;
        }

        // deprecate or revoke object
        if (revoked) this.object.revoked = true;
        else this.object.deprecated = true;
        saves.push(this.object.save(this.restAPIService));

        // update relationships with the object
        for (const relationship of this.relationships) {
          // do not deprecate 'subtechnique-of' or 'revoked-by' relationships
          if (
            !relationship.deprecated &&
            !['subtechnique-of', 'revoked-by'].includes(
              relationship.relationship_type
            )
          ) {
            relationship.deprecated = true;
            saves.push(relationship.save(this.restAPIService));
          }
        }

        if (revoked_by_id) {
          // create a new 'revoked-by' relationship
          const revokedRelationship = new Relationship();
          revokedRelationship.relationship_type = 'revoked-by';
          revokedRelationship.source_ref = this.object.stixID;
          revokedRelationship.target_ref = revoked_by_id;
          saves.push(revokedRelationship.save(this.restAPIService));
        }

        // complete save calls
        const saveSubscription = forkJoin(saves).subscribe({
          complete: () => {
            this.editorService.onReload.emit();
            saveSubscription.unsubscribe();
          },
        });
      },
      complete: () => {
        confirmationSub.unsubscribe();
      },
    });
  }
}
