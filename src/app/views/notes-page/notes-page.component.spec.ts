import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MtxPopoverModule } from '@ng-matero/extensions/popover';

import { NotesPageComponent } from './notes-page.component';

describe('NotesPageComponent', () => {
  let component: NotesPageComponent;
  let fixture: ComponentFixture<NotesPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NotesPageComponent],
      imports: [MtxPopoverModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NotesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
