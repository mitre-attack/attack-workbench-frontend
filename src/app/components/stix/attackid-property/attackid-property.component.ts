import { Component, Input } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StixObject } from 'src/app/classes/stix/stix-object';

@Component({
  selector: 'app-attackid-property',
  templateUrl: './attackid-property.component.html',
  styleUrls: ['./attackid-property.component.scss'],
  standalone: false,
})
export class AttackIDPropertyComponent {
  @Input() public config: AttackIDPropertyConfig;

  public get currentId(): string {
    return this.config.object[0]?.['attackID'] || '';
  }

  public get previousId(): string {
    return this.config.object[1]?.['attackID'] || '';
  }

  public get linkById(): string {
    return `(LinkById: ${this.config.object['attackID']})`;
  }

  constructor(public snackbar: MatSnackBar) {
    // intentionally left blank
  }
}
export interface AttackIDPropertyConfig {
  /* What is the current mode? Default: 'view
   *    view: viewing the attack id property
   *    diff: displaying the diff between two STIX objects. If this mode is selected, two StixObjects must be specified in the objects field
   */
  mode?: 'view' | 'diff';
  /* The object to show the field of
   * Note: if mode is diff, pass an array of two objects to diff
   */
  object: StixObject | [StixObject, StixObject];
}
