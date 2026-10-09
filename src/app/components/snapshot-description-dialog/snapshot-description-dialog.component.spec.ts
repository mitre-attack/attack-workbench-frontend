import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { vi } from 'vitest';

import { SnapshotDescriptionDialogComponent } from './snapshot-description-dialog.component';

describe('SnapshotDescriptionDialogComponent', () => {
  let component: SnapshotDescriptionDialogComponent;
  let fixture: ComponentFixture<SnapshotDescriptionDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      declarations: [SnapshotDescriptionDialogComponent],
      imports: [FormsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            title: 'Edit snapshot notes',
            description: 'Existing context',
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SnapshotDescriptionDialogComponent);
    component = fixture.componentInstance;
  });

  it('should initialize with existing notes and save a trimmed value', () => {
    expect(component.description).toBe('Existing context');
    component.description = '  Updated context  ';

    component.save();

    expect(dialogRef.close).toHaveBeenCalledWith('Updated context');
  });

  it('should allow empty notes to clear an annotation', () => {
    component.description = '   ';

    component.save();

    expect(dialogRef.close).toHaveBeenCalledWith('');
  });

  it('should reject notes over the API limit', () => {
    component.description = 'x'.repeat(4001);

    component.save();

    expect(component.isInvalid).toBe(true);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
