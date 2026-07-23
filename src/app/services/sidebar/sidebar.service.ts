import { EventEmitter, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SidebarService {
  // sidebar tab settings
  private _currentTab: tabOption = 'search';
  public onTabChange = new EventEmitter();
  public get currentTab(): tabOption {
    return this._currentTab;
  }
  public set currentTab(tab: tabOption) {
    this._currentTab = tab;
    setTimeout(() => this.onTabChange.emit()); //emit after render loop
  }
  public tabEnabled(tabName: tabOption): boolean {
    return this.tabs.filter(x => x.name == tabName)[0].enabled;
  }
  public setEnabled(tabName: tabOption, enabled: boolean) {
    this.tabs.filter(x => x.name == tabName)[0].enabled = enabled;
  }
  public readonly tabs: TabDefinition[] = [
    {
      name: 'search',
      icon: 'search',
      enabled: true,
    },
    {
      name: 'references',
      icon: 'superscript',
      enabled: true,
    },
    {
      name: 'notes',
      icon: 'sticky_note_2',
      enabled: true,
    },
  ];
  //is the sidebar currently opened?
  private _opened = false;
  public onOpened = new EventEmitter();
  public get opened(): boolean {
    return this._opened;
  }
  public set opened(value: boolean) {
    this._opened = value;
    this.onOpened.emit();
  }
  public toggleOpened() {
    this._opened = !this._opened;
    setTimeout(() => this.onOpened.emit()); //emit after render loop
  }

  constructor() {
    // intentionally left blank
  }
}
export type tabOption = 'search' | 'references' | 'notes';

interface TabDefinition {
  name: tabOption; // the tab name
  icon: string; //material icon to use for tab
  enabled: boolean; //if false, tab cannot be selected or shown
}
