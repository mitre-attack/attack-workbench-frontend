import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { AllObjectsPageComponent } from './all-objects-page.component';

describe('AllObjectsPageComponent', () => {
  let component: AllObjectsPageComponent;
  let fixture: ComponentFixture<AllObjectsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AllObjectsPageComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AllObjectsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should use the all objects column preset', () => {
    expect(component.stixListConfig.columnsPreset).toBe('all-objects');
  });
});
