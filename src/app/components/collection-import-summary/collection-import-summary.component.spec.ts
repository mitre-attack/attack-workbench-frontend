import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatExpansionModule } from '@angular/material/expansion';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { CollectionImportSummaryComponent } from './collection-import-summary.component';

describe('CollectionImportSummaryComponent', () => {
  let component: CollectionImportSummaryComponent;
  let fixture: ComponentFixture<CollectionImportSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CollectionImportSummaryComponent],
      imports: [MatExpansionModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CollectionImportSummaryComponent);
    component = fixture.componentInstance;
    component.config = {
      object_import_categories: {
        technique: {} as any,
        tactic: {} as any,
        campaign: {} as any,
        software: {} as any,
        relationship: {} as any,
        mitigation: {} as any,
        matrix: {} as any,
        group: {} as any,
        data_source: {} as any,
        data_component: {} as any,
        asset: {} as any,
        analytic: {} as any,
        detection_strategy: {} as any,
      },
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
