import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { DeleteDialogComponent } from './delete-dialog.component';

describe('DeleteDialogComponent', () => {
  let component: DeleteDialogComponent;
  let fixture: ComponentFixture<DeleteDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DeleteDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: {} },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { objectType: 'test', objectName: 'test' },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DeleteDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default the confirmation text to DELETE', () => {
    component.confirmInput = 'DELETE';

    expect(component.confirmationText).toBe('DELETE');
    expect(component.invalid).toBe(false);
  });

  it('should use a STIX ID as the confirmation text when provided', () => {
    component.config = { stixId: 'attack-pattern--123' };
    component.confirmInput = 'attack-pattern--123';

    expect(component.confirmationText).toBe('attack-pattern--123');
    expect(component.invalid).toBe(false);
  });
});
