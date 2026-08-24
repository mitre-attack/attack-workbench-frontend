import { Observable } from 'rxjs';
import { RestApiConnectorService } from '../services/connectors/rest-api/rest-api-connector.service';
import { WorkflowStatusType } from '../utils/types';

/**
 * Objects which are serializable to the REST API implement this class
 */
export abstract class Serializable {
  /**
   *  Transform the current object into a raw object for sending to the back-end, stripping any unnecessary fields
   * @abstract
   * @returns {*} the raw object to send
   */
  public abstract serialize(keepModified?: string): any;
  /**
   * Parse the object from the record returned from the back-end
   * @abstract
   * @param {*} raw the raw object to parse
   */
  public abstract deserialize(raw: any): any;

  /**
   * Validate the current object state and return information on the result of the validation
   * @abstract
   * @param {RestApiConnectorService} restAPIService: the REST API connector through which asynchronous validation can be completed
   * @param {any} [options] extra validation options for more complex validations
   * @returns {Observable<ValidationData>} the validation warnings and errors once validation is complete.
   */
  public abstract validate(
    restAPIService: RestApiConnectorService,
    options?: any,
    tempWorkflowState?: WorkflowStatusType
  ): Observable<ValidationData>;
}

export class ValidationData {
  public successes: ValidationFieldData[] = [];
  public warnings: ValidationFieldData[] = [];
  public errors: ValidationFieldData[] = [];
  public info: ValidationFieldData[] = [];

  public merge(that: ValidationData) {
    this.successes = this.successes.concat(that.successes);
    this.warnings = this.warnings.concat(that.warnings);
    this.errors = this.errors.concat(that.errors);
    this.info = this.info.concat(that.info);
  }
}

export interface ValidationFieldData {
  result: 'success' | 'warning' | 'error' | 'info'; //validation result type
  field: string; //the field that was validated
  message: string; //the validation warning or error message to display to the user.
}
