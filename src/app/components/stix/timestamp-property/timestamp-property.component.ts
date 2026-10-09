import { Component, Input, OnInit } from '@angular/core';
import { StixObject } from 'src/app/classes/stix/stix-object';

@Component({
  selector: 'app-timestamp-property',
  templateUrl: './timestamp-property.component.html',
  styleUrls: ['./timestamp-property.component.scss'],
  standalone: false,
})
export class TimestampPropertyComponent implements OnInit {
  @Input() public config: TimestampPropertyConfig;

  constructor() {
    // intentionally left blank
  }

  ngOnInit(): void {
    // intentionally left blank
  }

  /** Check if the object has a workflow identity attached */
  public hasIdentity(): boolean {
    return (
      this.config.field.includes('modified') &&
      this.config.object &&
      'created_by_user_account' in this.config.object &&
      !!this.config.object.created_by_user_account
    );
  }
}

export interface TimestampPropertyConfig {
  /* What is the current mode? Default: 'view'
   *    view: viewing the timestamp property
   *    diff: displaying the diff between two STIX objects. If this mode is selected, two StixObjects must be specified in the objects field
   */
  mode?: 'view' | 'diff';
  /* humanize the timestamp? Default: false
   *       if true, displays relative to the current date if within last week, and older timestamps don't display the exact edit time, only date.
   *       if false, display the full timestamp including the exact edit time.
   */
  humanize?: boolean;
  /* Show a tooltip of the full timestamp? Default: false
   *      if true, displays the formatted timestamp in a tooltip
   */
  tooltip?: boolean;
  /* The object to show the timestamp of
   * Note: if mode is diff, pass an array of two objects to diff
   */
  object: StixObject | [StixObject, StixObject];
  /* the field of the object(s) to visualize as a timestamp. Typically "created" or "modified".
   * Note: will not work with fields that are actually get functions!
   */
  field: string;
  /* if specified, label with this string instead of field */
  label?: string;
  /* field to display attribution information from. If omitted, does not display attribution.
   */
  attribution?: string;
  displayName?: boolean;
  /*
      if true, the username of the user who created the object will be displayed before the timestamp. Default: false
    */
  showDisplayName?: boolean;
}
