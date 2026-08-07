import { Component, Input, ViewEncapsulation } from '@angular/core';
import { StixViewConfig } from 'src/app/views/stix/stix-view-page';
import { EditorService } from 'src/app/services/editor/editor.service';
import { StixObject } from 'src/app/classes/stix/stix-object';

@Component({
  selector: 'app-subheading',
  templateUrl: './subheading.component.html',
  styleUrls: ['./subheading.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class SubheadingComponent {
  @Input() public config!: StixViewConfig;

  public get object() {
    return Array.isArray(this.config.object)
      ? this.config.object[0]
      : this.config.object;
  }
  public get editing(): boolean {
    return this.editorService.editing;
  }

  public get showStixIdProperty(): boolean {
    return (
      !!this.object?.stixID &&
      !(
        this.config.mode === 'view' &&
        this.object instanceof StixObject &&
        this.object.attackType !== 'collection'
      )
    );
  }

  constructor(private editorService: EditorService) {
    // intentionally left blank
  }
}
