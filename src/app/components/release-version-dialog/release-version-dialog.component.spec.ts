import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { vi } from 'vitest';

import { ReleaseVersionDialogComponent } from './release-version-dialog.component';

describe('ReleaseVersionDialogComponent', () => {
  let component: ReleaseVersionDialogComponent;
  let fixture: ComponentFixture<ReleaseVersionDialogComponent>;
  const dialogRef = { close: vi.fn() };

  beforeEach(async () => {
    dialogRef.close.mockReset();
    await TestBed.configureTestingModule({
      declarations: [ReleaseVersionDialogComponent],
      imports: [FormsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { currentVersion: '1.1' } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ReleaseVersionDialogComponent);
    component = fixture.componentInstance;
  });

  it('accepts a normalized MAJOR.MINOR version', () => {
    component.version = ' 1.2 ';
    component.save();
    expect(dialogRef.close).toHaveBeenCalledWith('1.2');
  });

  it('rejects malformed versions', () => {
    component.version = '1.2.3';
    component.save();
    expect(component.isInvalid).toBe(true);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
