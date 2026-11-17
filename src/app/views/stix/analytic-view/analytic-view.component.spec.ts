import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Analytic } from 'src/app/classes/stix';
import { StixPageTabsComponent } from 'src/app/components/stix/stix-page-tabs/stix-page-tabs.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { AnalyticViewComponent } from './analytic-view.component';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  createMockRestApiConnector,
  createAsyncObservable,
} from 'src/app/testing/mocks/rest-api-connector.mock';

describe('AnalyticViewComponent', () => {
  let component: AnalyticViewComponent;
  let fixture: ComponentFixture<AnalyticViewComponent>;

  beforeEach(async () => {
    const mockRestApiConnector = createMockRestApiConnector({
      getDefaultMarkingDefinitions: () => createAsyncObservable([]),
      getNextAttackId: () => createAsyncObservable('ANA-0001'),
    });

    await TestBed.configureTestingModule({
      declarations: [AnalyticViewComponent, StixPageTabsComponent],
      imports: [CommonModule, MatTabsModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        { provide: RestApiConnectorService, useValue: mockRestApiConnector },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticViewComponent);
    component = fixture.componentInstance;
    component.config = { mode: 'view', object: {} as any };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ignores detection strategy data hidden in diff mode but marks visible changes', async () => {
    const current = new Analytic();
    current.firstInitialized = false;
    const prior = new Analytic();
    current.relatedDetections = [
      { stixID: 'x-mitre-detection-strategy--example', name: 'A strategy' },
    ] as any;
    component.config = { mode: 'diff', object: [current, prior] };
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('.tab-change-indicator')
    ).toBeNull();
    current.description = 'A visible description change';
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.tab-change-indicator')
    ).not.toBeNull();
  });
});
