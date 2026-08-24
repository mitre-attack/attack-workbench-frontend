import {
  Component,
  Input,
  ViewChild,
  ViewEncapsulation,
  OnInit,
} from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { DictionaryPropertyConfig } from '../dictionary-property.component';

@Component({
  selector: 'app-dictionary-view',
  standalone: false,
  templateUrl: './dictionary-view.component.html',
  styleUrls: ['./dictionary-view.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DictionaryViewComponent implements OnInit {
  @Input() public config: DictionaryPropertyConfig;
  @ViewChild(MatSort) sort: MatSort;

  public dataSource: any[] = [];
  public displayedColumns: string[] = [];

  ngOnInit() {
    this.dataSource = this.config.object[this.config.field];
    this.displayedColumns = this.config.columns.map(c => c.name);

    const sortColumn = this.config.columns.find(c => c.sort).name;
    if (sortColumn) {
      this.dataSource.sort((a, b) => {
        const aValue = a[sortColumn] ?? '';
        const bValue = b[sortColumn] ?? '';
        return String(aValue).localeCompare(String(bValue), undefined, {
          sensitivity: 'base',
        });
      });
    }
  }
}
