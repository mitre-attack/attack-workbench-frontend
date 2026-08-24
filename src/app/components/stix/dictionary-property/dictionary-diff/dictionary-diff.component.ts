import { Component, Input, OnInit } from '@angular/core';
import { DictionaryPropertyConfig } from '../dictionary-property.component';

@Component({
  selector: 'app-dictionary-diff',
  standalone: false,
  templateUrl: './dictionary-diff.component.html',
  styleUrl: './dictionary-diff.component.scss',
})
export class DictionaryDiffComponent implements OnInit {
  @Input() public config: DictionaryPropertyConfig;

  public get current() {
    return this.config.object?.[0]?.[this.config.field] || [];
  }

  public get previous() {
    return this.config.object?.[1]?.[this.config.field] || [];
  }

  public detailTable = [];

  public get columns() {
    return this.config.columns;
  }

  public get columnNames(): string[] {
    return this.config.columns.map(c => c.name);
  }

  public get columnsLabels(): string[] {
    return this.config.columns.map(c => (c.label ? c.label : c.name));
  }

  ngOnInit(): void {
    this.detailTable = this.mergeTable();
  }

  private mergeTable(): any[] {
    const merged = new Map();

    const prevCounts = new Map();
    const currCounts = new Map();

    // add before state to map
    for (const item of this.previous) {
      const sig = this.rowSignature(item);
      const n = (prevCounts.get(sig) ?? 0) + 1;
      prevCounts.set(sig, n);

      const key = `${sig}__#${n}`;
      merged.set(key, { before: item, after: null });
    }

    // add after state to map
    for (const item of this.current) {
      const sig = this.rowSignature(item);
      const n = (currCounts.get(sig) ?? 0) + 1;
      currCounts.set(sig, n);

      const key = `${sig}__#${n}`;
      if (merged.has(key)) {
        merged.get(key)!.after = item;
      } else {
        merged.set(key, { before: null, after: item });
      }
    }

    return Array.from(merged.values());
  }

  private rowSignature(item): string {
    return this.columnNames.map(col => this.normalize(item?.[col])).join('::');
  }

  private normalize(v: any): string {
    if (v == null || v == undefined) return '';
    return String(v).trim().toLowerCase();
  }

  public valueToString(item, columnName) {
    if (!item?.[columnName]) return '';
    if (Array.isArray(item[columnName])) return item[columnName].join('; ');
    return String(item[columnName]);
  }
}
