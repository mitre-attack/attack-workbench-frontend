import {
  Component,
  Input,
  OnInit,
  ViewEncapsulation,
  ViewChild,
  ElementRef,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { DictionaryPropertyConfig } from '../dictionary-property.component';
import { MatTable } from '@angular/material/table';
import { EditorService } from 'src/app/services/editor/editor.service';

@Component({
  selector: 'app-dictionary-edit',
  standalone: false,
  templateUrl: './dictionary-edit.component.html',
  styleUrls: ['./dictionary-edit.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DictionaryEditComponent implements OnInit, OnChanges {
  @Input() public config: DictionaryPropertyConfig;
  @ViewChild('editInput', { static: false }) editInput: ElementRef;
  @ViewChild(MatTable) table!: MatTable<any>;

  public displayedColumns: string[] = [];
  public editingIdx: number | undefined;
  public editingCol: string | undefined;

  private originalCellValue: any;
  private originalTableValue: any;

  constructor(private editorService: EditorService) {}

  ngOnInit() {
    this.originalTableValue = JSON.parse(
      JSON.stringify(this.config.object[this.config.field])
    );

    this.displayedColumns = [
      ...this.config.columns.map(c => c.name),
      'actions',
    ];

    this.sortRows();

    this.editorService.onEditingStopped.subscribe(discard => {
      if (discard) {
        this.config.object[this.config.field] = this.originalTableValue;
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) this.sortRows();
  }

  public sortRows(): void {
    const sortColumn = this.config.columns.find(c => c.sort)?.name;
    if (!sortColumn) return;

    this.config.object[this.config.field].sort((a, b) => {
      const aValue = a[sortColumn] ?? '';
      const bValue = b[sortColumn] ?? '';
      return String(aValue).localeCompare(String(bValue), undefined, {
        sensitivity: 'base',
      });
    });
  }

  public isEditing(index: number, column: string): boolean {
    return index === this.editingIdx && column === this.editingCol;
  }

  public stopEditing(): void {
    this.editingIdx = undefined;
    this.editingCol = undefined;
    this.originalCellValue = undefined;
  }

  public cancelEditing(): void {
    if (this.editingIdx === undefined || !this.editingCol) return;
    const row = this.config.object[this.config.field]?.[this.editingIdx];
    if (row) row[this.editingCol] = this.originalCellValue;
    this.stopEditing();
  }

  public addRow(): void {
    const newRow: any = {};
    this.config.columns.forEach(c => (newRow[c.name] = ''));
    this.config.object[this.config.field].unshift(newRow);
    this.table?.renderRows();
    this.editCell(0, this.config.columns[0]?.name);
  }

  public editCell(index: number, column: string): void {
    if (this.isEditing(index, column)) return;

    this.editingIdx = index;
    this.editingCol = column;

    const row = this.config.object[this.config.field]?.[index];
    this.originalCellValue = row ? row[column] : undefined;

    setTimeout(() => this.editInput?.nativeElement?.focus());
  }

  public deleteRow(index: number): void {
    this.config.object[this.config.field]?.splice(index, 1);
    this.table?.renderRows();
    this.stopEditing();
  }
}
