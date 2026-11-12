import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserAccountEventsService {
  private readonly userAccountsChangedSubject = new Subject<void>();

  public readonly userAccountsChanged$ =
    this.userAccountsChangedSubject.asObservable();

  public notifyUserAccountsChanged(): void {
    this.userAccountsChangedSubject.next();
  }
}
