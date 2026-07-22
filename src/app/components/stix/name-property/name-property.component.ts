import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Relationship } from 'src/app/classes/stix/relationship';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { Technique } from 'src/app/classes/stix/technique';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { EditorService } from 'src/app/services/editor/editor.service';
import { SaveDialogComponent } from '../../save-dialog/save-dialog.component';
import { WorkflowStatus, WorkflowStatusMap } from 'src/app/utils/types';

@Component({
  selector: 'app-name-property',
  templateUrl: './name-property.component.html',
  styleUrls: ['./name-property.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class NamePropertyComponent implements OnInit {
  @Input() public config: NamePropertyConfig;
  public currentTargetObj?: any;
  public loaded = false;
  public statusControl: FormControl<WorkflowStatus | null>;
  public workflows = Object.entries(WorkflowStatusMap);

  public get field() {
    return this.config.field ? this.config.field : 'name';
  }

  public get object(): any {
    return Array.isArray(this.config.object)
      ? this.config.object[0]
      : this.config.object;
  }

  public get showWorkflowControl(): boolean {
    return (
      this.config.mode === 'view' &&
      this.object instanceof StixObject &&
      this.object.attackType !== 'collection'
    );
  }

  /**
   * retrieve the internal link to the parent technique
   */
  public get internalParentLink(): string {
    return `/${this.config.parent.attackType}/${this.config.parent.stixID}`;
  }

  public get current() {
    return this.config.object[0] || null;
  }
  public get currentName() {
    return this.current?.[this.field] || '';
  }
  public get previous() {
    return this.config.object[1] || null;
  }
  public get previousName() {
    return this.previous?.[this.field] || '';
  }

  constructor(
    private dialog: MatDialog,
    private editorService: EditorService,
    private restAPIService: RestApiConnectorService
  ) {}

  ngOnInit(): void {
    const object = this.object;
    this.statusControl = new FormControl(WorkflowStatus.WorkInProgress);
    this.statusControl.setValue(
      object?.workflow?.state || WorkflowStatus.WorkInProgress
    );
    if (this.config.mode !== 'diff' && object.revoked) {
      // retrieve revoking object
      const data$ = this.restAPIService.getRelatedTo({
        sourceRef: object.stixID,
        relationshipType: 'revoked-by',
      });
      const relSubscription = data$.subscribe({
        next: data => {
          const relationship = data.data[0] as Relationship;
          this.currentTargetObj = relationship.target_object as Technique;
          this.loaded = true;
        },
        complete: () => {
          relSubscription.unsubscribe();
        },
      });
    }
  }

  public getStatus(obj: StixObject): string {
    if (obj?.['revoked']) return 'revoked';
    else if (obj?.['deprecated']) return 'deprecated';
    return '';
  }

  public workflowChange(event): void {
    const previousWorkflowState =
      this.object?.workflow?.state || WorkflowStatus.WorkInProgress;
    if (event.isUserInput) {
      const dialogRef = this.dialog.open(SaveDialogComponent, {
        maxWidth: '70em',
        maxHeight: '70em',
        data: {
          object: this.object,
          versionAlreadyIncremented: false,
          initialWorkflowState: event.source.value,
        },
        autoFocus: false,
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.statusControl.setValue(event.source.value);
          this.editorService.onReload.emit();
        } else {
          this.statusControl.setValue(previousWorkflowState);
        }
      });
    }
  }

  public workflowIcon(status: WorkflowStatus): string {
    switch (status) {
      case WorkflowStatus.WorkInProgress:
        return 'assignment';
      case WorkflowStatus.AwaitingReview:
        return 'assignment_ind';
      case WorkflowStatus.Reviewed:
        return 'assignment_turned_in';
    }
  }

  public workflowColor(status: WorkflowStatus): string {
    switch (status) {
      case WorkflowStatus.WorkInProgress:
        return 'error';
      case WorkflowStatus.AwaitingReview:
        return 'warn';
      case WorkflowStatus.Reviewed:
        return 'success';
    }
  }
}

export interface NamePropertyConfig {
  /* What is the current mode? Default: 'view
   *    view: viewing the list property
   *    edit: editing the list property
   *    diff: displaying the diff between two STIX objects. If this mode is selected, two StixObjects must be specified in the objects field
   */
  mode?: 'view' | 'edit' | 'diff';
  /* The object to show the field of
   * Note: if mode is diff, pass an array of two objects to diff
   */
  object: StixObject | [StixObject, StixObject];
  /* The parent object. If specified, the object name will be
   * prefixed with the name of the parent
   */
  parent?: StixObject;
  /* the field of the object(s) to visualize as a name
   * If unspecified, uses 'name' field as defined on StixObject
   */
  field?: string;
}
