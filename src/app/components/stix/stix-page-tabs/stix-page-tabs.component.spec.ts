import { CommonModule } from '@angular/common';
import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTabsModule } from '@angular/material/tabs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { StixPageTabsComponent } from './stix-page-tabs.component';

@Component({
  standalone: false,
  template: `
    <app-stix-page-tabs
      [detailsTemplate]="board"
      detailsLabel="Board"
      [showHistory]="false"
      [showMembership]="false"
      [showNotes]="false"
      [customTabs]="[{ label: 'Releases', template: releases }]"
      (selectedIndexChange)="selectedIndex = $event"></app-stix-page-tabs>
    <ng-template #board><p>Board contents</p></ng-template>
    <ng-template #releases><p>Release contents</p></ng-template>
  `,
})
class TabsHostComponent {
  selectedIndex = 0;
}

describe('StixPageTabsComponent', () => {
  it('notifies its page when the user enters and leaves a custom tab', async () => {
    await TestBed.configureTestingModule({
      declarations: [TabsHostComponent, StixPageTabsComponent],
      imports: [CommonModule, MatTabsModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const fixture = TestBed.createComponent(TabsHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    tabs[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.selectedIndex).toBe(1);
    expect(
      fixture.nativeElement.querySelector(
        '[role="tabpanel"].mat-mdc-tab-body-active'
      ).textContent
    ).toContain('Release contents');
    tabs[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.selectedIndex).toBe(0);
    expect(
      fixture.nativeElement.querySelector(
        '[role="tabpanel"].mat-mdc-tab-body-active'
      ).textContent
    ).toContain('Board contents');
    fixture.destroy();
  });
});
