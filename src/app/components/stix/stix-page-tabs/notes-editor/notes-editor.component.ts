import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { fromEvent } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  tap,
} from 'rxjs/operators';
import { Note } from 'src/app/classes/stix/note';
import { ConfirmationDialogComponent } from 'src/app/components/confirmation-dialog/confirmation-dialog.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';

@Component({
  selector: 'app-notes-editor',
  templateUrl: './notes-editor.component.html',
  styleUrls: ['./notes-editor.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class NotesEditorComponent implements OnInit, AfterViewInit {
  @ViewChild('search') search: ElementRef;

  public loading = false;
  public notes: Note[] = [];
  public objectStixID: string;
  public selected: FormControl;

  constructor(
    private router: Router,
    private restAPIConnectorService: RestApiConnectorService,
    private dialog: MatDialog,
    private snackbar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.objectStixID = this.getObjectStixID();
    this.selected = new FormControl('date-descending');
    this.parseNotes();
  }

  ngAfterViewInit() {
    // search input listener
    fromEvent(this.search.nativeElement, 'keyup')
      .pipe(
        filter(Boolean),
        debounceTime(250),
        distinctUntilChanged(),
        tap(_ => {
          this.parseNotes();
        })
      )
      .subscribe();
  }

  /** Retrieve objects from backend */
  private parseNotes(): void {
    this.loading = true;
    if (!this.objectStixID) {
      this.notes = [];
      this.loading = false;
      return;
    }

    const query = this.search
      ? this.search.nativeElement.value.toLowerCase()
      : '';

    const objects$ = this.restAPIConnectorService.getAllNotes();
    const subscription = objects$.subscribe({
      next: result => {
        const notes = result.data as Note[];
        this.notes = notes.filter(note =>
          note.object_refs.includes(this.objectStixID)
        );

        if (query) {
          this.notes = this.notes.filter(note => {
            return (
              note.title.toLowerCase().includes(query) ||
              note.content.toLowerCase().includes(query)
            );
          });
        }

        if (this.selected?.value) {
          // retain sorting selection
          if (this.selected.value == 'title-ascending') this.sortTitle(true);
          else if (this.selected.value == 'title-descending') this.sortTitle();
          else if (this.selected.value == 'date-ascending') this.sortDate(true);
          else if (this.selected.value == 'date-descending') this.sortDate();
        } else this.sortDate();

        this.loading = false;
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
  }

  private getObjectStixID(): string {
    const [path] = this.router.url.split('?');
    const segments = path.split('/').filter(Boolean);
    if (segments[0] === 'dashboard') return '';
    return segments[1] || '';
  }

  /** Limit editing to one note at a time */
  public startEditing(note: Note): void {
    if (!this.isEditing() || note.editing) note.editing = true;
    else this.snack();
  }

  /** Check if editing a note */
  public isEditing(): boolean {
    return this.notes.filter(note => note.editing).length > 0;
  }

  /** Add new note */
  public addNote(): void {
    const newNote = new Note();
    newNote.object_refs.push(this.objectStixID);
    if (!this.isEditing()) {
      newNote.editing = true;
      this.notes.unshift(newNote);

      // set focus to title
      window.setTimeout(function () {
        document.getElementById('noteTitle').focus();
      }, 0);
    } else this.snack();
  }

  /** Confirm note deletion */
  public deleteNote(note: Note): void {
    // open confirmation dialog
    const prompt = this.dialog.open(ConfirmationDialogComponent, {
      maxWidth: '35em',
      data: {
        message: '# Are you sure you want to delete this note?',
      },
      autoFocus: false, // prevents auto focus on toolbar buttons
    });

    const subscription = prompt.afterClosed().subscribe({
      next: result => {
        if (result) {
          // remove note from list
          const i = this.notes.indexOf(note);
          if (i >= 0) this.notes.splice(i, 1);

          if (note.modified) {
            note.delete(this.restAPIConnectorService);
          } // else note has not been saved to database
        }
      },
      complete: () => {
        subscription.unsubscribe();
      }, //prevent memory leaks
    });
  }

  /** Save note */
  public saveNote(note: Note): void {
    if (note.content) {
      note.save(this.restAPIConnectorService).subscribe({
        complete: () => {
          note.editing = false;
          this.parseNotes();
        },
      });
    }
  }

  /** Sort notes alphabetically by title */
  public sortTitle(ascending?: boolean): void {
    if (ascending) this.notes.sort((a, b) => a.title.localeCompare(b.title));
    else this.notes.sort((a, b) => b.title.localeCompare(a.title));
  }

  /** Sort notes by date */
  public sortDate(ascending?: boolean): void {
    if (ascending)
      this.notes.sort((a, b) => a.modified.getTime() - b.modified.getTime());
    else this.notes.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  }

  /** Display snackbar warning message */
  private snack(): void {
    this.snackbar.open(
      'Only one note can be edited at a time. Please save your changes before editing another note.',
      'dismiss',
      {
        duration: 3000,
        panelClass: 'warn',
      }
    );
  }
}
