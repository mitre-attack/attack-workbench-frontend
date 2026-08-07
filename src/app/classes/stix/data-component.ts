import { map, Observable } from 'rxjs';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { ValidationData } from '../serializable';
import { StixObject } from './stix-object';
import { logger } from '../../utils/logger';
import { DataSource } from './data-source';
import { WorkflowStatusType } from 'src/app/utils/types';

export class DataComponent extends StixObject {
  public name = '';
  public description = '';
  public domains: string[] = [];
  public logSources: LogSource[] = [];

  // NOTE: the following field will only be populated when this object
  // is fetched using RestApiConnectorServicegetDataComponent()
  public data_source: DataSource = null;
  public dataSourceRef: string; // (deprecated) stix ID of the data source

  // data components do not support ATT&CK IDs
  public readonly supportsAttackID = true;
  protected get attackIDValidator() {
    return {
      regex: 'DC\\d{4}',
      format: 'DC####',
    };
  }

  constructor(sdo?: any) {
    super(sdo, 'x-mitre-data-component');
    if (sdo) {
      this.deserialize(sdo);
    }
  }

  /**
   * Transform the current object into a raw object for sending to the back-end
   * @abstract
   * @returns {*} the raw object to send
   */
  public serialize(keepModified?: string): any {
    const rep = super.base_serialize();
    if (keepModified) {
      rep.stix.modified = keepModified;
    }
    rep.stix.name = this.name.trim();
    rep.stix.description = this.description;
    rep.stix.x_mitre_domains = this.domains;
    if (this.logSources.length) {
      rep.stix.x_mitre_log_sources = this.logSources;
    }

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
    if (!('stix' in raw)) return;

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

    if ('description' in sdo) {
      if (typeof sdo.description === 'string')
        this.description = sdo.description;
      else
        logger.error(
          'TypeError: description field is not a string:',
          sdo.description,
          '(',
          typeof sdo.description,
          ')'
        );
    } else this.description = '';

    if ('x_mitre_data_source_ref' in sdo) {
      if (typeof sdo.x_mitre_data_source_ref === 'string')
        this.dataSourceRef = sdo.x_mitre_data_source_ref;
      else
        logger.error(
          'TypeError: data source ref field is not a string:',
          sdo.x_mitre_data_source_ref,
          '(',
          typeof sdo.x_mitre_data_source_ref,
          ')'
        );
    } else this.dataSourceRef = '';

    if ('x_mitre_domains' in sdo) {
      if (this.isStringArray(sdo.x_mitre_domains))
        this.domains = sdo.x_mitre_domains;
      else logger.error('TypeError: domains field is not a string array.');
    } else this.domains = [];

    if ('x_mitre_log_sources' in sdo) {
      if (this.isLogSourcesArray(sdo.x_mitre_log_sources))
        this.logSources = sdo.x_mitre_log_sources;
      else
        logger.error(
          `TypeError: x_mitre_log_sources field is not an array of log sources: ${sdo.x_mitre_log_sources} (${typeof sdo.x_mitre_log_sources})`
        );
    } else this.logSources = [];
  }

  private isLogSourcesArray(arr): boolean {
    return arr.every(a => {
      return 'name' in a && 'channel' in a;
    });
  }

  /**
   * Validate the current object state and return information on the result of the validation
   * @param {RestApiConnectorService} restAPIService: the REST API connector through which asynchronous validation can be completed
   * @returns {Observable<ValidationData>} the validation warnings and errors once validation is complete.
   */
  public validate(
    restAPIService: RestApiConnectorService,
    tempWorkflowState?: WorkflowStatusType
  ): Observable<ValidationData> {
    return this.base_validate(restAPIService, tempWorkflowState);
  }

  /**
   * Save the current state of the STIX object in the database. Update the current object from the response
   * @param restAPIService [RestApiConnectorService] the service to perform the POST/PUT through
   * @returns {Observable} of the post
   */
  public save(
    restAPIService: RestApiConnectorService
  ): Observable<DataComponent> {
    const postObservable = restAPIService.postDataComponent(this);
    const subscription = postObservable.subscribe({
      next: result => {
        this.deserialize(result.serialize());
      },
      complete: () => {
        subscription.unsubscribe();
      },
    });
    return postObservable;
  }

  /**
   * Delete this STIX object from the database.
   * @param restAPIService [RestApiConnectorService] the service to perform the DELETE through
   */
  public delete(restAPIService: RestApiConnectorService): Observable<object> {
    const deleteObservable = restAPIService.deleteDataComponent(this.stixID);
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
  public update(
    restAPIService: RestApiConnectorService
  ): Observable<DataComponent> {
    const putObservable = restAPIService.putDataComponent(this);
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

  /**
   * Revoke the STIX object in the database.
   * @param restAPIService [RestApiConnectorService] the service to perform the revoke through
   * @param revokingObject the revoking object payload
   * @returns {Observable} of the revoke
   */
  public revoke(
    restAPIService: RestApiConnectorService,
    revokingObject: { revoking: { stixId: string; modified: string } },
    preserveRelationships = false
  ): Observable<object> {
    return restAPIService.revokeDataComponent(
      this.stixID,
      revokingObject,
      preserveRelationships
    );
  }
}

export interface LogSource {
  name: string;
  channel: string;
}
