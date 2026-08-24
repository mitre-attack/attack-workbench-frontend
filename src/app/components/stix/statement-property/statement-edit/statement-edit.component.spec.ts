import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MtxPopoverModule } from '@ng-matero/extensions/popover';

import { StatementEditComponent } from './statement-edit.component';

describe('StatementEditComponent', () => {
  let component: StatementEditComponent;
  let fixture: ComponentFixture<StatementEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StatementEditComponent],
      imports: [MtxPopoverModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StatementEditComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: 'edit',
      object: {} as any,
      field: 'statement',
    } as any;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
