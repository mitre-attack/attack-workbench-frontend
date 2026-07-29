import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';

import {
  ReleasePreviewDialogComponent,
  ReleasePreviewDialogData,
} from './release-preview-dialog.component';

describe('ReleasePreviewDialogComponent', () => {
  let component: ReleasePreviewDialogComponent;
  let fixture: ComponentFixture<ReleasePreviewDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let data: ReleasePreviewDialogData;

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    data = {
      track: {
        name: 'Core Objects',
        members: [
          {
            object_ref: 'attack-pattern--member',
            attack_id: 'T0001',
            name: 'Existing Member',
            x_mitre_version: '1.0',
          },
        ],
        staged: [
          {
            object_ref: 'attack-pattern--member',
            attack_id: 'T0001',
            name: 'Updated Member',
            x_mitre_version: '1.1',
          },
          {
            object_ref: 'attack-pattern--new',
            attack_id: 'T0002',
            name: 'New Object',
            x_mitre_version: '1.0',
          },
        ],
        candidates: [
          {
            object_ref: 'attack-pattern--candidate',
            attack_id: 'T0003',
            name: 'Candidate',
            object_status: 'work-in-progress',
          },
        ],
      },
    };

    await TestBed.configureTestingModule({
      declarations: [ReleasePreviewDialogComponent],
      imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTabsModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReleasePreviewDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should calculate the draft snapshot summary from track contents', () => {
    expect(component.includedObjects).toHaveLength(2);
    expect(component.newObjectCount).toBe(1);
    expect(component.updatedMemberCount).toBe(1);
    expect(component.unchangedObjectCount).toBe(0);
    expect(component.excludedCandidates).toHaveLength(1);
  });

  it('should use the backend diff when previewing a virtual release', () => {
    data.previewSummary = {
      type: 'virtual',
      after: { members_count: 870, quarantine_count: 0 },
      changes: {
        new_count: 30,
        updated_count: 12,
        removed_count: 10,
        quarantined_count: 0,
      },
    };

    expect(component.isVirtualTrack).toBe(true);
    expect(component.totalIncludedCount).toBe(870);
    expect(component.newObjectCount).toBe(30);
    expect(component.updatedMemberCount).toBe(12);
    expect(component.unchangedObjectCount).toBe(828);
    expect(component.removedObjectCount).toBe(10);
    expect(component.quarantinedObjectCount).toBe(0);
  });

  it('should display the canonical ATT&CK object type', () => {
    data.track.staged[0].attack_type = 'technique';

    expect(component.getObjectType(data.track.staged[0])).toBe('Technique');
  });

  it('should return the selected version bump when all bumps are valid', () => {
    component.tagVersion('minor');
    expect(dialogRef.close).toHaveBeenCalledWith('minor');

    component.tagVersion('major');
    expect(dialogRef.close).toHaveBeenCalledWith('major');
  });

  it('should close without selecting a release version', () => {
    component.close();

    expect(dialogRef.close).toHaveBeenCalledWith();
  });

  it('should block tagging when the backend reports release conflicts', () => {
    data.conflicts = [{ object_ref: 'attack-pattern--member' }];

    expect(component.hasInvalidVersionBumps).toBe(true);
    component.tagVersion('minor');

    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('should provide fallbacks for incomplete object metadata', () => {
    expect(component.getObjectName({})).toBe('ATT&CK object');
    expect(component.getObjectVersion(null)).toBe('Not available');
    expect(component.getObjectType({})).toBe('STIX Object');
    expect(
      component.getObjectType({ object_ref: 'course-of-action--123' })
    ).toBe('Course Of Action');
    expect(component.getWorkflowState({})).toBe('work-in-progress');
  });

  it('should allow tagging when an object has an invalid version string', () => {
    data.track.staged[0].x_mitre_version = 'invalid';

    expect(component.hasInvalidVersionBumps).toBe(false);
    component.tagVersion('minor');

    expect(dialogRef.close).toHaveBeenCalledWith('minor');
  });

  it('should render the objects represented by the Included and Excluded counts', () => {
    const element: HTMLElement = fixture.nativeElement;
    const tabs = Array.from(
      element.querySelectorAll<HTMLElement>('[role="tab"]')
    );
    const includedTab = tabs.find(tab => tab.textContent?.includes('Included'));
    const excludedTab = tabs.find(tab => tab.textContent?.includes('Excluded'));

    includedTab?.click();
    fixture.detectChanges();

    expect(element.textContent).toContain('Updated Member');
    expect(element.textContent).toContain('New Object');

    excludedTab?.click();
    fixture.detectChanges();

    expect(element.textContent).toContain('Candidate');
    expect(
      element.querySelectorAll('.release-preview-table--excluded thead th')
        .length
    ).toBe(2);
  });

  it('should highlight and block an invalid incoming version bump', () => {
    data.track.staged[0].x_mitre_version = '1.3';
    fixture.detectChanges();

    expect(component.hasInvalidVersionBumps).toBe(true);
    component.tagVersion('minor');
    expect(dialogRef.close).not.toHaveBeenCalled();

    const element: HTMLElement = fixture.nativeElement;
    const replacementsTab = Array.from(
      element.querySelectorAll<HTMLElement>('[role="tab"]')
    ).find(tab => tab.textContent?.includes('Replacements'));
    replacementsTab?.click();
    fixture.detectChanges();

    const invalidRow = element.querySelector<HTMLElement>(
      '.release-table-row--invalid'
    );
    const minorButton = element.querySelector<HTMLButtonElement>(
      '.release-preview-tag-minor-button'
    );
    const majorButton = element.querySelector<HTMLButtonElement>(
      '.release-preview-tag-major-button'
    );

    expect(invalidRow).toBeTruthy();
    expect(minorButton?.disabled).toBe(true);
    expect(majorButton?.disabled).toBe(true);
  });
});
