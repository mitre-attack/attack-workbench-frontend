import { SelectionModel } from '@angular/cdk/collections';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Relationship } from 'src/app/classes/stix/relationship';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { EditorService } from 'src/app/services/editor/editor.service';
import { AddDialogComponent } from '../add-dialog/add-dialog.component';
import { of } from 'rxjs';
import { finalize, map, switchMap } from 'rxjs/operators';
import { DeprecationService } from 'src/app/services/helpers/deprecation.service';
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
  public lifecyclePending = false;

  public get disabled(): boolean {
    return (
      this.lifecyclePending ||
      this.editorService.editing ||
      this.editorService.type == 'collection'
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
    private dialog: MatDialog,
    private deprecationService: DeprecationService
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
          return (
            object.stixID !== this.editorService.stixId &&
            !object.revoked &&
            !object.deprecated
          );
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
      const revokedRelationship = this.relationships.find(
        r =>
          r.relationship_type == 'revoked-by' &&
          r.source_ref == this.object.stixID
      );
      this.lifecyclePending = true;
      const retire = revokedRelationship
        ? this.deprecationService.deprecate(revokedRelationship)
        : of(true);
      retire
        .pipe(
          switchMap(retired => {
            if (!retired) return of(false);
            this.object.revoked = false;
            return this.object.save(this.restAPIService).pipe(map(() => true));
          }),
          finalize(() => (this.lifecyclePending = false))
        )
        .subscribe({
          next: saved => {
            this.revoked = !saved;
            if (saved) this.editorService.onReload.emit();
          },
          error: error => {
            this.revoked = true;
            this.object.revoked = true;
            this.deprecationService.showError(error);
          },
        });
    }
  }

  private setDeprecated(deprecated: boolean) {
    this.lifecyclePending = true;
    if (deprecated) {
      this.deprecationService
        .deprecate(this.object)
        .pipe(finalize(() => (this.lifecyclePending = false)))
        .subscribe(saved => {
          this.deprecated = this.object.deprecated;
          if (saved) this.editorService.onReload.emit();
        });
    } else {
      this.object.deprecated = false;
      this.object
        .save(this.restAPIService)
        .pipe(finalize(() => (this.lifecyclePending = false)))
        .subscribe({
          complete: () => {
            this.deprecated = false;
            this.editorService.onReload.emit();
          },
          error: error => {
            this.object.deprecated = true;
            this.deprecationService.showError(error);
          },
        });
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
      error: error => {
        this.deprecationService.showError(error);
        this.revoked = false;
      },
    });
  }
}
