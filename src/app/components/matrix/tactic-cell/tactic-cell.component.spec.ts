import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Tactic } from 'src/app/classes/stix/tactic';

import { TacticCellComponent } from './tactic-cell.component';

describe('TacticCellComponent', () => {
  let component: TacticCellComponent;
  let fixture: ComponentFixture<TacticCellComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [TacticCellComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TacticCellComponent);
    component = fixture.componentInstance;

    // Initialize the required tactic input with a mock
    const mockTactic = new Tactic();
    mockTactic.attackID = 'TA0001';
    mockTactic.name = 'Test Tactic';
    component.tactic = mockTactic;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
