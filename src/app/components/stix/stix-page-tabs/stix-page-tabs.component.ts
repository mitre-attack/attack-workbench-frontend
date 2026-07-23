import { ViewEncapsulation } from '@angular/core';
import { Component, Input, TemplateRef } from '@angular/core';
import { StixViewConfig } from 'src/app/views/stix/stix-view-page';

interface CustomTab {
  label: string;
  template: TemplateRef<any>;
}

@Component({
  selector: 'app-stix-page-tabs',
  templateUrl: './stix-page-tabs.component.html',
  styleUrls: ['./stix-page-tabs.component.scss'],
  standalone: false,
  encapsulation: ViewEncapsulation.None,
})
export class StixPageTabsComponent {
  @Input() config!: StixViewConfig;
  @Input() detailsTemplate!: TemplateRef<any>;
  @Input() customTabs: CustomTab[] = [];
  @Input() showHistory = true;
}
