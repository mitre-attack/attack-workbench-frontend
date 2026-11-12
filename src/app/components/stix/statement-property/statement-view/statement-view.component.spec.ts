import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MtxPopoverModule } from '@ng-matero/extensions/popover';

import { StatementViewComponent } from './statement-view.component';

describe('StatementViewComponent', () => {
  let component: StatementViewComponent;
  let fixture: ComponentFixture<StatementViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StatementViewComponent],
      imports: [MtxPopoverModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StatementViewComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'view',
      object: {} as any,
      field: 'test',
    } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
