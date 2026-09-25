import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CreateDraftDialogComponent } from './create-draft-dialog.component';

describe('CreateDraftDialogComponent', () => {
  const close = vi.fn();

  beforeEach(async () => {
    close.mockReset();
    await TestBed.configureTestingModule({
      imports: [CreateDraftDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            trackName: 'Virtual track',
            description: 'Existing notes',
            canManageRetention: true,
          },
        },
      ],
    }).compileComponents();
  });

  it('requires a fresh opt-in for every draft, and submits a validated limit only for that draft', () => {
    const fixture = TestBed.createComponent(CreateDraftDialogComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.save();
    expect(close).toHaveBeenLastCalledWith({ description: 'Existing notes' });
    close.mockClear();
    component.retentionEnabled = true;
    for (const limit of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      component.maxDrafts = limit;
      component.save();
    }
    expect(close).not.toHaveBeenCalled();
    component.maxDrafts = 2;
    component.save();
    expect(close).toHaveBeenCalledWith({
      description: 'Existing notes',
      draft_retention: { max_drafts: 2 },
    });
    fixture.destroy();
    const reopened = TestBed.createComponent(CreateDraftDialogComponent);
    reopened.componentInstance.save();
    expect(close).toHaveBeenLastCalledWith({ description: 'Existing notes' });
  });

  it('does not render or submit a destructive option for non-administrators', () => {
    TestBed.overrideProvider(MAT_DIALOG_DATA, {
      useValue: { trackName: 'Virtual track', canManageRetention: false },
    });
    const fixture = TestBed.createComponent(CreateDraftDialogComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-slide-toggle')).toBeNull();
    fixture.componentInstance.retentionEnabled = true;
    fixture.componentInstance.maxDrafts = 1;
    fixture.componentInstance.save();
    expect(close).toHaveBeenCalledWith({ description: '' });
  });
});
