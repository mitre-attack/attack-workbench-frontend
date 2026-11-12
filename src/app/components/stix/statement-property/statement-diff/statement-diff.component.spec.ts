import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MtxPopoverModule } from '@ng-matero/extensions/popover';

import { StatementDiffComponent } from './statement-diff.component';

describe('StatementDiffComponent', () => {
  let component: StatementDiffComponent;
  let fixture: ComponentFixture<StatementDiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StatementDiffComponent],
      imports: [MtxPopoverModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StatementDiffComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'diff',
      object: [{} as any, {} as any],
      field: 'statement',
    } as any;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
