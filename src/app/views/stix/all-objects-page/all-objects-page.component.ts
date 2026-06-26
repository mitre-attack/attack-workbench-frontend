import { Component } from '@angular/core';
import { StixListConfig } from 'src/app/components/stix/stix-list/stix-list.component';

@Component({
  selector: 'app-all-objects-page',
  templateUrl: './all-objects-page.component.html',
  styleUrls: ['./all-objects-page.component.scss'],
  standalone: false,
})
export class AllObjectsPageComponent {
  public readonly title = 'All Objects';
  public readonly description =
    'Search and browse every object currently available in the knowledge base.';
  public readonly stixListConfig: StixListConfig = {
    showUserSearch: true,
    excludeAttackTypes: ['relationship', 'note', 'collection'],
  };
}
