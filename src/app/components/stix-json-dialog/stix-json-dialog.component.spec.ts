import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';

import { StixJsonDialogComponent } from './stix-json-dialog.component';

describe('StixJsonDialogComponent', () => {
  let component: StixJsonDialogComponent;
  let fixture: ComponentFixture<StixJsonDialogComponent>;

  beforeEach(async () => {
    const mockStixObject = {
      name: 'Test Object',
      attackID: 'T1234',
      serialize: vi.fn().mockReturnValue({
        name: 'Test Object',
        id: 'test-id',
      }),
    };

    await TestBed.configureTestingModule({
      declarations: [StixJsonDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: {} },
        { provide: MAT_DIALOG_DATA, useValue: { stixObject: mockStixObject } },
        { provide: MatSnackBar, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(StixJsonDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
