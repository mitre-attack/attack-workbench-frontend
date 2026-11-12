import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { StixListPageComponent } from './stix-list-page.component';

describe('StixListPageComponent', () => {
  let component: StixListPageComponent;
  let fixture: ComponentFixture<StixListPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StixListPageComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(StixListPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
