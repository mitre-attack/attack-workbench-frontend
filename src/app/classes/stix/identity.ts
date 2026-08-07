import { Observable } from 'rxjs';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { logger } from '../../utils/logger';
import { ValidationData } from '../serializable';
import { StixObject } from './stix-object';
import { WorkflowStatusType } from 'src/app/utils/types';

export class Identity extends StixObject {
  public name: string; // identity name
  public identity_class: string; // type of entity this identity describes
  public roles: string[] = []; // list of roles this identity performs
  public sectors: string[] = []; // list of sectors this identity belongs to
  public contact?: string; // contact information for this identity

  public readonly supportsAttackID = false; // Identity does not support ATT&CK IDs
  protected get attackIDValidator() {
    return null;
  } // identities do not have an ATT&CK ID

  // override StixObject excludedFields
  protected excludedFields = ['x_mitre_version'];

  constructor(sdo?: any) {
    super(sdo, 'identity');
    if (sdo) {
      this.deserialize(sdo);
    }
    this.workflow = undefined;
  }

  /**
   * Transform the current object into a raw object for sending to the back-end, stripping any unnecessary fields
   * @abstract
   * @returns {*} the raw object to send
   */
  public serialize(): any {
    const rep = super.base_serialize();

    rep.stix.name = this.name;
    rep.stix.identity_class = this.identity_class;
    if (this.roles) rep.stix.roles = this.roles;
    if (this.sectors?.length) rep.stix.sectors = this.sectors;
    if (this.contact) rep.stix.contact_information = this.contact;

    // Strip properties that are empty strs + lists
    rep.stix = this.filterObject(rep.stix);

    return rep;
  }

  /**
   * Parse the object from the record returned from the back-end
   * @abstract
   * @param {*} raw the raw object to parse
   */
  public deserialize(raw: any) {
    if ('stix' in raw) {
      const sdo = raw.stix;

      if ('name' in sdo) {
        if (typeof sdo.name === 'string') this.name = sdo.name;
        else
          logger.error(
            'TypeError: name field is not a string:',
            sdo.name,
            '(',
            typeof sdo.name,
            ')'
          );
      } else this.name = '';

      if ('identity_class' in sdo) {
        if (typeof sdo.identity_class === 'string')
          this.identity_class = sdo.identity_class;
        else
          logger.error(
            'TypeError: identity_class field is not a string:',
            sdo.identity_class,
            '(',
            typeof sdo.identity_class,
            ')'
          );
      } else this.identity_class = '';

      if ('roles' in sdo) {
        if (this.isStringArray(sdo.roles)) this.roles = sdo.roles;
        else logger.error('TypeError: roles field is not a string array.');
      } else {
        this.roles = [];
      }

      if ('sectors' in sdo) {
        if (this.isStringArray(sdo.sectors)) this.sectors = sdo.sectors;
        else logger.error('TypeError: sectors field is not a string array.');
      } else {
        this.sectors = [];
      }

      if ('contact_information' in sdo) {
        if (typeof sdo.contact_information === 'string')
          this.contact = sdo.contact_information;
        else
          logger.error(
            'TypeError: contact_information field is not a string:',
            sdo.contact_information,
            '(',
            typeof sdo.contact_information,
            ')'
          );
      }
    }
  }

  /**
   * Validate the current object state and return information on the result of the validation
   * @param {RestApiConnectorService} restAPIService: the REST API connector through which asynchronous validation can be completed
   * @returns {Observable<ValidationData>} the validation warnings and errors once validation is complete.
   */
  public validate(
    restAPIService: RestApiConnectorService,
    _tempWorkflowState?: WorkflowStatusType
  ): Observable<ValidationData> {
    void _tempWorkflowState;
    return this.base_validate(restAPIService);
  }

  /**
   * Save the current state of the STIX object in the database. Update the current object from the response
   * @param new_version [boolean] if false, overwrite the current version of the object. If true, creates a new version.
   * @param restAPIService [RestApiConnectorService] the service to perform the POST/PUT through
   * @returns {Observable} of the post
   */
  public save(restAPIService: RestApiConnectorService): Observable<Identity> {
    const postObservable = restAPIService.postIdentity(this);
    const subscription = postObservable.subscribe({
      next: result => {
        this.deserialize(result);
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
    return postObservable;
  }

  public delete(restAPIService: RestApiConnectorService): Observable<object> {
    const deleteObservable = restAPIService.deleteIdentity(this.stixID);
    const subscription = deleteObservable.subscribe({
      complete: () => {
        subscription.unsubscribe();
      },
    });
    return deleteObservable;
  }

  /**
   * Update the state of the STIX object in the database.
   * @param restAPIService [RestApiConnectorService] the service to perform the PUT through
   * @returns {Observable} of the put
   */
  public update(restAPIService: RestApiConnectorService): Observable<Identity> {
    const putObservable = restAPIService.putIdentity(this);
    const subscription = putObservable.subscribe({
      next: result => {
        this.deserialize(result.serialize());
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
    return putObservable;
  }
}
