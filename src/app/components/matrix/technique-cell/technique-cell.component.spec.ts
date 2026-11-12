import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { TechniqueCellComponent } from './technique-cell.component';
import { Technique } from 'src/app/classes/stix/technique';

describe('TechniqueCellComponent', () => {
  let component: TechniqueCellComponent;
  let fixture: ComponentFixture<TechniqueCellComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [TechniqueCellComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TechniqueCellComponent);
    component = fixture.componentInstance;

    // Initialize the required technique input with a mock
    const mockTechnique = new Technique();
    mockTechnique.attackID = 'T1234';
    mockTechnique.name = 'Test Technique';
    mockTechnique.subTechniques = [];
    component.technique = mockTechnique;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
