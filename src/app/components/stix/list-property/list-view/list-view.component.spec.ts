import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListViewComponent } from './list-view.component';

describe('ListViewComponent', () => {
  let component: ListViewComponent;
  let fixture: ComponentFixture<ListViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ListViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ListViewComponent);
    component = fixture.componentInstance;
    // Set required config input
    component.config = {
      mode: 'view',
      object: { test: [] } as any,
      field: 'test',
      label: 'Test',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return an empty list for missing list fields', () => {
    component.config = {
      mode: 'view',
      object: {} as any,
      field: 'domains',
      label: 'Domain',
    };

    expect(component.values).toEqual([]);
    expect(component.tooltip).toBe('');
  });

  it('should not mutate list fields when sorting values', () => {
    const object = { domains: ['mobile', 'enterprise'] };
    component.config = {
      mode: 'view',
      object: object as any,
      field: 'domains',
      label: 'Domain',
    };

    expect(component.values).toEqual(['enterprise', 'mobile']);
    expect(object.domains).toEqual(['mobile', 'enterprise']);
  });
});
