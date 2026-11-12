import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollectionImportErrorComponent } from './collection-import-error.component';

describe('CollectionImportErrorComponent', () => {
  let component: CollectionImportErrorComponent;
  let fixture: ComponentFixture<CollectionImportErrorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CollectionImportErrorComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CollectionImportErrorComponent);
    component = fixture.componentInstance;
    component.error = {
      bundleErrors: {
        duplicateCollection: false,
        noCollection: false,
        moreThanOneCollection: false,
        badlyFormattedCollection: false,
      },
      objectErrors: {
        summary: {
          invalidAttackSpecVersionCount: 0,
          duplicateObjectInBundleCount: 0,
        },
      },
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
