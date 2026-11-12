import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { CommonModule } from '@angular/common';
import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTabsModule } from '@angular/material/tabs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { StixViewConfig } from 'src/app/views/stix/stix-view-page';
import { ExternalReferences } from 'src/app/classes/external-references';
import { VersionNumber } from 'src/app/classes/version-number';
import { ReleaseReviewDialogComponent } from '../../release-review-dialog/release-review-dialog.component';
import { HistoryTimelineComponent } from './history-timeline/history-timeline.component';
import { StixPageTabsComponent } from './stix-page-tabs.component';

@Component({
  standalone: false,
  template: `
    <app-stix-page-tabs
      [config]="config"
      [detailsFields]="['description']"
      [detailsTemplate]="board"
      detailsLabel="Board"
      [showHistory]="false"
      [showMembership]="false"
      [showNotes]="false"
      [customTabs]="[
        { label: 'Releases', template: releases, diffFields: ['release'] },
      ]"
      (selectedIndexChange)="selectedIndex = $event"></app-stix-page-tabs>
    <ng-template #board><p>Board contents</p></ng-template>
    <ng-template #releases><p>Release contents</p></ng-template>
  `,
})
class TabsHostComponent {
  selectedIndex = 0;
  config: StixViewConfig = { mode: 'view', object: {} as any };
}

describe('StixPageTabsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TabsHostComponent, StixPageTabsComponent],
      imports: [CommonModule, MatTabsModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: RestApiConnectorService,
          useValue: {
            getRelatedTo: vi.fn(() =>
              of({ data: [], pagination: { total: 0 } })
            ),
          },
        },
      ],
    }).compileComponents();
  });

  it('notifies its page when the user enters and leaves a custom tab', async () => {
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

  it('marks changed tabs before opening their lazy content and updates for a new comparison', async () => {
    const fixture = TestBed.createComponent(TabsHostComponent);
    fixture.componentInstance.config = {
      mode: 'diff',
      object: [
        { description: 'Same details', release: '2.0' } as any,
        { description: 'Same details', release: '1.0' } as any,
      ],
    };
    fixture.detectChanges();
    await fixture.whenStable();
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs[0].querySelector('.tab-change-indicator')).toBeNull();
    expect(
      tabs[1].querySelector('.tab-change-indicator')?.getAttribute('aria-label')
    ).toBe('Contains changes');
    expect(fixture.nativeElement.textContent).not.toContain('Release contents');

    fixture.componentInstance.config = {
      mode: 'diff',
      object: [{ description: 'Added details' } as any, null],
    };
    fixture.detectChanges();
    expect(
      tabs[0].querySelector('.tab-change-indicator')?.getAttribute('aria-label')
    ).toBe('Contains changes');
    expect(tabs[1].querySelector('.tab-change-indicator')).toBeNull();

    fixture.componentInstance.config.mode = 'view';
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.tab-change-indicator')
    ).toBeNull();
    fixture.destroy();
  });

  it('compares field contents without flagging reference state, empty values, or metadata', () => {
    const component = new StixPageTabsComponent(
      TestBed.inject(RestApiConnectorService)
    );
    const previousReferences = new ExternalReferences([
      { source_name: 'Source', description: 'Original reference' },
    ]);
    const currentReferences = new ExternalReferences([
      { source_name: 'Source', description: 'Original reference' },
    ]);
    currentReferences.sortReferences();
    component.config = {
      mode: 'diff',
      object: [
        {
          description: 'Same text',
          aliases: ['New name', 'Alias'],
          domains: [],
          version: new VersionNumber('1.0'),
          external_references: currentReferences,
          modified: new Date('2026-10-20'),
        } as any,
        {
          description: 'Same text',
          aliases: ['Old name', 'Alias'],
          version: new VersionNumber('1.0'),
          external_references: previousReferences,
          modified: new Date('2026-10-19'),
        } as any,
      ],
    };
    const fields = [
      'description',
      'aliases',
      'domains',
      'version',
      'external_references',
    ];
    expect(component.hasChanges(fields)).toBe(false);

    currentReferences.deserialize([
      { source_name: 'Source', description: 'Updated reference' },
    ]);
    expect(component.hasChanges(fields)).toBe(true);
    expect(component.hasChanges(['description'])).toBe(false);

    component.config.object.reverse();
    expect(component.hasChanges(fields)).toBe(true);
  });

  it('marks relationship tabs before opening them, respects staged dates, and avoids repeat fetches', () => {
    const api = TestBed.inject(RestApiConnectorService);
    const query = vi.mocked(api.getRelatedTo);
    const after = '2026-10-18T14:00:00.000Z';
    const cutoff = '2026-10-19T14:00:00.000Z';
    const added = {
      created: new Date('2026-10-18T18:00:00Z'),
      modified: new Date('2026-10-18T18:00:00Z'),
    };
    const updated = {
      created: new Date(after),
      modified: new Date('2026-10-18T19:00:00Z'),
    };
    const future = {
      created: new Date('2026-10-20T14:00:00Z'),
      modified: new Date('2026-10-20T14:00:00Z'),
    };
    const old = { created: new Date(after), modified: new Date(after) };
    query
      .mockReturnValueOnce(
        of({ data: [added], pagination: { total: 1 } } as any)
      )
      .mockReturnValueOnce(of({ data: [old], pagination: { total: 1 } } as any))
      .mockReturnValueOnce(
        of({ data: [future], pagination: { total: 1 } } as any)
      )
      .mockReturnValueOnce(
        of({ data: [updated], pagination: { total: 1 } } as any)
      )
      .mockReturnValueOnce(throwError(() => new Error('Unavailable')));
    const component = new StixPageTabsComponent(api);
    component.config = {
      mode: 'diff',
      object: [{ description: 'Same' } as any, { description: 'Same' } as any],
      relationshipAddedAfter: after,
      relationshipCreatedBefore: cutoff,
    };
    component.customTabs = ['Added', 'Old', 'Future', 'Updated', 'Failed'].map(
      label => ({
        label,
        template: null,
        relationshipQuery: { targetRef: label, relationshipType: 'uses' },
      })
    );
    component.ngOnChanges();
    expect(
      component.customTabs.map(tab => component.tabHasChanges(tab))
    ).toEqual([true, false, false, true, false]);
    expect(component.hasChanges(['description'])).toBe(false);
    expect(query).toHaveBeenCalledTimes(5);
    component.config = { ...component.config };
    component.customTabs = component.customTabs.map(tab => ({ ...tab }));
    component.ngOnChanges();
    expect(query).toHaveBeenCalledTimes(5);
    component.config.mode = 'view';
    component.ngOnChanges();
    expect(
      component.customTabs.every(tab => !component.tabHasChanges(tab))
    ).toBe(true);
    component.ngOnDestroy();
  });

  it('cancels obsolete relationship comparisons when switching objects or destroying the modal', () => {
    const api = TestBed.inject(RestApiConnectorService);
    const response = new Subject<any>();
    vi.mocked(api.getRelatedTo).mockReturnValue(response);
    const component = new StixPageTabsComponent(api);
    component.config = {
      mode: 'diff',
      object: [] as any,
      relationshipAddedAfter: '2026-10-18T14:00:00Z',
    };
    component.customTabs = [
      {
        label: 'Relationships',
        template: null,
        relationshipQuery: { targetRef: 'first' },
      },
    ];
    component.ngOnChanges();
    expect(response.observed).toBe(true);
    component.customTabs = [];
    component.ngOnChanges();
    expect(response.observed).toBe(false);
    component.customTabs = [
      {
        label: 'Relationships',
        template: null,
        relationshipQuery: { targetRef: 'second' },
      },
    ];
    component.ngOnChanges();
    expect(response.observed).toBe(true);
    component.ngOnDestroy();
    expect(response.observed).toBe(false);
  });

  it.each(['Review', 'History'])(
    'marks relationship additions from the %s entry point',
    entry => {
      const current = {
        type: 'attack-pattern',
        stixID: 'attack-pattern--example',
        modified: new Date('2026-10-19T14:00:00Z'),
      } as any;
      const prior = { ...current, modified: new Date('2026-10-18T14:00:00Z') };
      const api = TestBed.inject(RestApiConnectorService);
      vi.mocked(api.getRelatedTo).mockReturnValue(
        of({
          data: [
            {
              created: new Date('2026-10-18T18:00:00Z'),
              modified: new Date('2026-10-18T18:00:00Z'),
            },
          ],
        } as any)
      );
      const component = new StixPageTabsComponent(api);
      if (entry === 'Review') {
        component.config = new ReleaseReviewDialogComponent(null as any, {
          items: [{ item: {} as any, current, prior }],
        }).config;
      } else {
        const open = vi.fn();
        HistoryTimelineComponent.prototype.preview.call(
          { dialog: { open } } as any,
          current,
          prior
        );
        component.config = open.mock.calls[0][1].data;
        expect(component.config.relationshipCreatedBefore).toEqual(
          current.modified
        );
      }
      const tab = {
        label: 'Mitigations',
        template: null,
        relationshipQuery: {
          targetRef: current.stixID,
          relationshipType: 'mitigates',
        },
      };
      component.customTabs = [tab];
      component.ngOnChanges();
      expect(component.tabHasChanges(tab)).toBe(true);
      component.ngOnDestroy();
    }
  );

  it.each(['Review', 'History'])(
    'treats relationships as additions when %s has no prior revision',
    entry => {
      const current = {
        type: 'attack-pattern',
        stixID: 'attack-pattern--new',
        modified: new Date('2026-10-19T14:00:00Z'),
      } as any;
      const component = new StixPageTabsComponent(
        TestBed.inject(RestApiConnectorService)
      );
      if (entry === 'Review') {
        component.config = new ReleaseReviewDialogComponent(null as any, {
          items: [{ item: {} as any, current, prior: null }],
        }).config;
      } else {
        const open = vi.fn();
        HistoryTimelineComponent.prototype.preview.call(
          { dialog: { open } } as any,
          current,
          null
        );
        component.config = open.mock.calls[0][1].data;
      }
      const tab = {
        label: 'Mitigations',
        template: null,
        relatedObjects: [
          { created: current.modified, modified: current.modified } as any,
        ],
      };
      expect(component.tabHasChanges(tab)).toBe(true);
    }
  );

  it('uses preloaded tab data without extra requests and responds to refreshed lists', () => {
    const api = TestBed.inject(RestApiConnectorService);
    const component = new StixPageTabsComponent(api);
    component.config = {
      mode: 'diff',
      object: [] as any,
      relationshipAddedAfter: '2026-10-18T14:00:00Z',
      relationshipCreatedBefore: '2026-10-19T14:00:00Z',
    };
    const tab = {
      label: 'Techniques',
      template: null,
      relatedObjects: [
        {
          created: new Date('2026-10-18T18:00:00Z'),
          modified: new Date('2026-10-18T18:00:00Z'),
        } as any,
      ],
    };
    component.customTabs = [tab];
    component.ngOnChanges();
    expect(component.tabHasChanges(tab)).toBe(true);
    expect(api.getRelatedTo).not.toHaveBeenCalled();
    tab.relatedObjects = [
      {
        created: new Date('2026-10-20T14:00:00Z'),
        modified: new Date('2026-10-20T14:00:00Z'),
      } as any,
    ];
    expect(component.tabHasChanges(tab)).toBe(false);
    tab.relatedObjects = [];
    expect(component.tabHasChanges(tab)).toBe(false);
    component.ngOnDestroy();
  });
});
