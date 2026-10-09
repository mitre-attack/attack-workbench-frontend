import { HttpErrorResponse } from '@angular/common/http';
import { ExemptionReport } from 'src/app/classes/validation-policy';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, of, throwError } from 'rxjs';
import { logger } from '../../utils/logger';

export abstract class ApiConnector {
  private theSnackbar: MatSnackBar; //note: constructor in super must import snackbar
  constructor(snackbar: MatSnackBar) {
    this.theSnackbar = snackbar;
  }

  /**
   * create an informative snackbar from the error
   * @param {*} error error to handle
   */
  private errorSnack(error: any) {
    // show error field if it's a string (for some error's it's a string, for some it's an Object)
    if ('error' in error && typeof error.error?.message == 'string')
      this.snack(error.error.message, 'warn');
    else if ('error' in error && typeof error.error == 'string')
      this.snack(error.error, 'warn');
    // otherwise, try showing the message
    else if ('message' in error) this.snack(error.message, 'warn');
    // otherwise, show the status text
    else if ('statusText' in error) this.snack(error.statusText, 'warn');
    // otherwise show generic error
    else
      this.snack('Unknown error, check javascript console for details', 'warn');
  }

  /** Preserve an object result when optional report delivery wraps it. */
  protected unwrapReportedObject<T>(response: T): T {
    const envelope = response as {
      result?: unknown;
      exemptionReport?: ExemptionReport;
    };
    if (
      !envelope?.exemptionReport ||
      !envelope.result ||
      typeof envelope.result !== 'object' ||
      Array.isArray(envelope.result)
    )
      return response;
    return {
      ...envelope.result,
      exemptionReport: envelope.exemptionReport,
    } as T;
  }

  protected unwrapReportedError(error: any): any {
    const body = this.unwrapReportedObject(error?.error);
    if (body === error?.error) return error;
    return error instanceof HttpErrorResponse
      ? new HttpErrorResponse({
          error: body,
          headers: error.headers,
          status: error.status,
          statusText: error.statusText,
          url: error.url,
        })
      : { ...error, error: body };
  }

  /**
   * Log the error and then raise it to the next level
   * @param {boolean} showSnack if true, show the error snackbar
   */
  protected handleError_raise<T>(showSnack = true) {
    return (error: any): Observable<T> => {
      error = this.unwrapReportedError(error);
      logger.error(error);
      if (showSnack) this.errorSnack(error);
      return throwError(error);
    };
  }

  /**
   * Handle the error with logging and return a default value so that the app can continue
   * @param {boolean} showSnack if true, show the error snackbar
   */
  protected handleError_continue<T>(defaultValue?: T, showSnack = true) {
    return (error: any): Observable<T> => {
      logger.error(error);
      if (showSnack) this.errorSnack(error);
      return of(defaultValue as T);
    };
  }

  protected handleSuccess(message = 'success') {
    return (success: any) => {
      logger.log(message, success);
      this.snack(message, 'success');
    };
  }

  /**
   * Show a snackbar
   * @param {string} message the message to show
   * @param {("warn" | "success")} [snackType] formatting of the snackbart
   */
  private snack(message: string, snackType?: 'warn' | 'success'): void {
    this.theSnackbar.open(message, 'dismiss', {
      duration: snackType === 'warn' ? 6000 : 2000,
      panelClass: snackType,
    });
  }
}
