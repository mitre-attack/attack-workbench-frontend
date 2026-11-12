import { getRuntimeConfiguration } from 'src/configuration/runtime-configuration';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AppConfigService {
  /** Get the default landing page route */
  public get defaultLandingPage() {
    return getRuntimeConfiguration().defaultLandingPage;
  }

  constructor(private router: Router) {
    // intentionally left blank
  }

  /**
   * helper function to redirect to the selected default page
   * redirects to standard landing page on error
   */
  public redirectToLanding(): void {
    if (this.defaultLandingPage && this.defaultLandingPage !== '') {
      this.router.navigate([this.defaultLandingPage]).catch(() => {
        this.router.navigate(['']);
      });
    } else {
      this.router.navigate(['']);
    }
  }
}
