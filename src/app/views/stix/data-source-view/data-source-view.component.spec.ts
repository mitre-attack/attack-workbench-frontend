import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { DataSource, DataComponent } from 'src/app/classes/stix';
import { StixPageTabsComponent } from 'src/app/components/stix/stix-page-tabs/stix-page-tabs.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { DataSourceViewComponent } from './data-source-view.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
  createPaginatedResponse,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('DataSourceViewComponent', () => {
  let component: DataSourceViewComponent;
  let fixture: ComponentFixture<DataSourceViewComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getAllDataComponents: () =>
        createAsyncObservable(createPaginatedResponse()),
    });

    await TestBed.configureTestingModule({
      declarations: [DataSourceViewComponent, StixPageTabsComponent],
      imports: [CommonModule, MatTabsModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DataSourceViewComponent);
    component = fixture.componentInstance;
    const source = new DataSource();
    source.firstInitialized = false;
    component.config = { mode: 'view', object: source };
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('marks both preloaded tabs while Details stays unchanged and does not refetch for indicators', async () => {
    const api = TestBed.inject(RestApiConnectorService);
    const current = component.config.object as DataSource;
    const prior = new DataSource();
    const dataComponent = new DataComponent();
    dataComponent.dataSourceRef = current.stixID;
    dataComponent.created = dataComponent.modified = new Date(
      '2026-10-18T18:00:00Z'
    );
    const componentsResponse = new Subject<any>();
    vi.spyOn(api, 'getAllDataComponents').mockReturnValue(componentsResponse);
    api.getRelatedTo = vi.fn(() =>
      of(
        createPaginatedResponse([
          {
            created: new Date('2026-10-18T19:00:00Z'),
            modified: new Date('2026-10-18T19:00:00Z'),
          } as any,
        ])
      )
    );
    component.config = {
      mode: 'diff',
      object: [current, prior],
      relationshipAddedAfter: '2026-10-18T14:00:00Z',
      relationshipCreatedBefore: '2026-10-19T14:00:00Z',
    };
    fixture.detectChanges();
    componentsResponse.next(createPaginatedResponse([dataComponent]));
    componentsResponse.complete();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.dataComponents).toEqual([dataComponent]);
    expect(component.techniquesDetected).toHaveLength(1);
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs[0].querySelector('.tab-change-indicator')).toBeNull();
    expect(tabs[1].querySelector('.tab-change-indicator')).not.toBeNull();
    expect(tabs[2].querySelector('.tab-change-indicator')).not.toBeNull();
    expect(api.getRelatedTo).toHaveBeenCalledTimes(1);
  });
});
