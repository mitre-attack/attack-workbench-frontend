import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { AuthenticationService } from 'src/app/services/connectors/authentication/authentication.service';
import { StixDialogComponent } from './stix-dialog/stix-dialog.component';

@Component({
  template: '',
  standalone: false,
})
export abstract class StixViewPage {
  constructor(private authenticationService: AuthenticationService) {}

  //configuration for the view page behavior
  @Input() public config: StixViewConfig;
  public get editing(): boolean {
    return this.config.mode == 'edit';
  }
  public get canEdit(): boolean {
    return this.authenticationService.canEdit();
  }
  public get configCurrentObject(): StixObject {
    return Array.isArray(this.config.object)
      ? this.config.object[0]
      : this.config.object;
  }
  public get configPreviousObject(): StixObject | null {
    return this.config.mode == 'diff' ? this.config.object[1] || null : null;
  }
}

export interface StixViewConfig {
  /* What is the current mode? Default: 'view
   *    view: viewing the object
   *    edit: editing the object
   *    diff: displaying the diff between two STIX objects. If this mode is selected, two StixObjects must be specified in the objects field
   */
  mode?: 'view' | 'diff' | 'edit';
  /* The object to show on the page
   * Note: if mode is diff, pass an array of two objects to diff
   */
  object: StixObject | StixObject[];
  sourceType?: string; // the relationship source type (only relevant when creating a new relationship)
  targetType?: string; // the relationship target type (only relevant when creating a new relationship)
  /* if true or omitted, show relationships with the object on the page. If false, omit the relationships */
  showRelationships?: boolean;
  /** Hide relationships created after this timestamp. */
  relationshipCreatedBefore?: Date | string;
  /** Mark relationships created after this timestamp as new. */
  relationshipAddedAfter?: Date | string;
  /* is the current page editable?
   * if true or omitted, include edit elements on the page such as buttons to add a relationship
   * if false, hide such elements
   */
  editable?: boolean;
  /** is this a new object? */
  is_new?: boolean;
  /* How should control of the sidebar be configured? Default if omitted is "service"
   * if "disable", sidebar-related controls should not be present
   * if "events", sidebar-related controls should be passed as an @output event.
   * if "service", use sidebar.service to control the sidebar
   */
  sidebarControl?: 'disable' | 'events' | 'service';
  dialog?: MatDialogRef<StixDialogComponent>; // reference to the current dialog
}
