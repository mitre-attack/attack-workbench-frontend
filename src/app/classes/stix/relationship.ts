import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  Asset,
  Campaign,
  DataComponent,
  DataSource,
  DetectionStrategy,
  Group,
  Matrix,
  Mitigation,
  Software,
  Tactic,
  Technique,
} from 'src/app/classes/stix';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { logger } from '../../utils/logger';
import { ValidationData } from '../serializable';
import { StixObject } from './stix-object';
import { WorkflowStatus, WorkflowStatusType } from 'src/app/utils/types';

export class Relationship extends StixObject {
  public source_ref = '';
  public get source_name(): string {
    return `${this.source_parent ? this.source_parent.stix.name + ': ' : ''}${this.source_object ? this.source_object.stix.name : '[unknown object]'}`;
  }
  public source_ID = '';
  public source_object: any;
  public source_parent: any;

  public target_ref = '';
  public get target_name(): string {
    return `${this.target_parent ? this.target_parent.stix.name + ': ' : ''}${this.target_object ? this.target_object.stix.name : '[unknown object]'}`;
  }
  public target_ID = '';
  public target_object: any;
  public target_parent: any;

  public updating_refs = false; //becomes true while source and target refs are being asynchronously updated.

  public relationship_type = '';

  public readonly supportsAttackID = false; // relationships do not have ATT&CK IDs
  protected get attackIDValidator() {
    return null;
  } // relationships have no ATT&CK ID

  // override StixObject excludedFields
  protected excludedFields = ['x_mitre_version'];

  /**
   * Creates and returns the deserialized object
   * @param type the stix type of the object
   * @param raw the raw STIX object
   */
  private getObject(type: string, raw: any) {
    // transform AttackType to the relevant class
    // note: cannot use type-mappings.ts due to circular dependency
    const StixTypeToClass = {
      'attack-pattern': Technique,
      'x-mitre-tactic': Tactic,
      'campaign': Campaign,
      'intrusion-set': Group,
      'tool': Software,
      'malware': Software,
      'course-of-action': Mitigation,
      'x-mitre-matrix': Matrix,
      'x-mitre-data-source': DataSource,
      'x-mitre-data-component': DataComponent,
      'x-mitre-asset': Asset,
      'x-mitre-detection-strategy': DetectionStrategy,
    };
    if (type == 'malware' || type == 'tool') return new Software(type, raw);
    return new StixTypeToClass[type](raw);
  }
  /**
   * The valid source types according to relationship_type
   * null if any type is valid or relationship_type is not recognized
   */
  public get valid_source_types(): string[] {
    if (this.relationship_type == 'uses') {
      if (
        this.target_object &&
        (this.target_object.stix.type == 'malware' ||
          this.target_object.stix.type == 'tool')
      )
        return ['group', 'campaign'];
      else return ['software', 'group', 'campaign'];
    }
    if (this.relationship_type == 'mitigates') return ['mitigation'];
    if (this.relationship_type == 'subtechnique-of') return ['technique'];
    if (this.relationship_type == 'detects') return ['detection-strategy'];
    if (this.relationship_type == 'attributed-to') return ['campaign'];
    if (this.relationship_type == 'targets') return ['technique'];
    else return null;
  }
  /**
   * The valid source types according to relationship_type
   * null if any type is valid or relationship_type is not recognized
   */
  public get valid_target_types(): string[] {
    if (this.relationship_type == 'uses') {
      if (
        this.source_object &&
        (this.source_object.stix.type == 'malware' ||
          this.source_object.stix.type == 'tool')
      )
        return ['technique'];
      else return ['software', 'technique'];
    }
    if (this.relationship_type == 'mitigates') return ['technique'];
    if (this.relationship_type == 'subtechnique-of') return ['technique'];
    if (this.relationship_type == 'detects') return ['technique'];
    if (this.relationship_type == 'attributed-to') return ['group'];
    if (this.relationship_type == 'targets') return ['asset'];
    else return null;
  }

  constructor(sdo?: any) {
    super(sdo, 'relationship');
    if (sdo) {
      if ('stix' in sdo) {
        this.deserialize(sdo);
      }
    }
  }

  /**
   * set the source ref, and set the source_object and source_id to the new values
   * @param {string} new_source_ref the new source ref
   * @param {RestApiConnectorService} restAPIService: the REST API connector through which the source can be fetched
   * @returns {Observable<Relationship>} of this object after the data has been updated
   */
  public set_source_ref(
    new_source_ref: string,
    restAPIService: RestApiConnectorService
  ): Observable<Relationship> {
    this.source_ref = new_source_ref;
    this.updating_refs = true;
    return restAPIService.getAllObjects().pipe(
      map(results => {
        const x = results as any;
        const serialized = this.serialize();
        serialized.source_object = x.find(
          result => result.stix.id == new_source_ref
        );
        this.deserialize(serialized);
        return this;
      }),
      switchMap(relationship => {
        if (
          relationship.source_object.stix.x_mitre_is_subtechnique ||
          relationship.source_object.stix.type == 'x-mitre-data-component'
        ) {
          return this.get_parent_object(
            relationship.source_object,
            restAPIService
          ).pipe(
            map(res => {
              this.source_parent = res;
              this.updating_refs = false;
              return this;
            })
          );
        } else {
          this.source_parent = undefined; // source object has no parent
          this.updating_refs = false;
          return of(this);
        }
      })
    );
  }

  /**
   * Set the source object
   * @param {StixObject} new_source_object the object to set
   * @param {RestApiConnectorService} restAPIService: the REST API connector through which the parent of the source can be fetched
   * @returns {Observable<Relationship>} of this object after the data has been updated
   */
  public set_source_object(
    new_source_object: StixObject,
    restAPIService: RestApiConnectorService
  ): Observable<Relationship> {
    this.updating_refs = true;
    this.source_ref = new_source_object.stixID;
    const serialized = this.serialize();
    const modified = new_source_object.modified;
    serialized.source_object = new_source_object.serialize();
    serialized.source_object['stix'].modified = modified
      ? modified.toISOString()
      : undefined; // fix modified date overwrite by serialization
    this.deserialize(serialized);

    if (
      this.source_object.stix.x_mitre_is_subtechnique ||
      this.source_object.stix.type == 'x-mitre-data-component'
    ) {
      return this.get_parent_object(this.source_object, restAPIService).pipe(
        map(result => {
          this.source_parent = result;
          this.updating_refs = false;
          return this;
        })
      );
    } else this.source_parent = undefined; // source object has no parent

    this.updating_refs = false;
    return of(this);
  }

  /**
   * set the target ref, and set the target_object and target_id to the new values
   * @param {string} new_target_ref the new target ref
   * @param {RestApiConnectorService} restAPIService: the REST API connector through which the target can be fetched
   * @returns {Observable<Relationship>} of this object after the data has been updated
   */
  public set_target_ref(
    new_target_ref: string,
    restAPIService: RestApiConnectorService
  ): Observable<Relationship> {
    this.target_ref = new_target_ref;
    this.updating_refs = true;
    return restAPIService.getAllObjects().pipe(
      map(results => {
        const x = results as any;
        const serialized = this.serialize();
        serialized.target_object = x.find(
          result => result.stix.id == new_target_ref
        );
        this.deserialize(serialized);
        return this;
      }),
      switchMap(relationship => {
        if (
          relationship.target_object.stix.x_mitre_is_subtechnique ||
          relationship.target_object.stix.type == 'x-mitre-data-component'
        ) {
          return this.get_parent_object(
            relationship.target_object,
            restAPIService
          ).pipe(
            map(res => {
              this.target_parent = res;
              this.updating_refs = false;
              return this;
            })
          );
        } else {
          this.target_parent = undefined; // target object has no parent
          this.updating_refs = false;
          return of(this);
        }
      })
    );
  }

  /**
   * Set the target object
   * @param {StixObject} new_target_object the object to set
   * @param {RestApiConnectorService} restAPIService: the REST API connector through which the parent of the target can be fetched
   * @returns {Observable<Relationship>} of this object after the data has been updated
   */
  public set_target_object(
    new_target_object: StixObject,
    restAPIService: RestApiConnectorService
  ): Observable<Relationship> {
    this.updating_refs = true;
    this.target_ref = new_target_object.stixID;
    const serialized = this.serialize();
    const modified = new_target_object.modified;
    serialized.target_object = new_target_object.serialize();
    serialized.target_object['stix'].modified = modified
      ? modified.toISOString()
      : undefined; // fix modified date overwrite by serialization
    this.deserialize(serialized);

    if (
      this.target_object.stix.x_mitre_is_subtechnique ||
      this.target_object.stix.type == 'x-mitre-data-component'
    ) {
      return this.get_parent_object(this.target_object, restAPIService).pipe(
        map(result => {
          this.target_parent = result;
          this.updating_refs = false;
          return this;
        })
      );
    } else this.target_parent = undefined; // target object has no parent

    this.updating_refs = false;
    return of(this);
  }

  /**
   * Retrieve parent object from the REST API, if applicable.
   * Fetches the parent technique of a sub-technique and the parent data source of
   * a data component.
   * @param {any} object the raw source or target object
   * @param {RestApiConnectorService} restAPIService the REST API connector through which the parent can be fetched
   * @returns {Observable<StixObject>} of the parent object
   */
  public get_parent_object(
    object: any,
    restAPIService: RestApiConnectorService
  ): Observable<StixObject> {
    if (object.stix.x_mitre_is_subtechnique) {
      // sub-technique
      return restAPIService
        .getRelatedTo({
          sourceRef: object.stix.id,
          relationshipType: 'subtechnique-of',
        })
        .pipe(
          // fetch parent from REST API
          map(relationship => {
            if (!relationship || relationship.data.length == 0) return null; // no parent technique found
            const p = relationship.data[0] as Relationship;
            return p.target_object;
          })
        );
    } else {
      // data component
      return restAPIService
        .getDataSource(object.stix.x_mitre_data_source_ref)
        .pipe(
          // fetch data source from REST API
          map(data_sources => {
            if (!data_sources || data_sources.length == 0) return null; // no data source found
            return data_sources[0].serialize();
          })
        );
    }
  }

  /**
   * Retrieve the parent object of this source object
   * @param {RestApiConnectorService} restAPIService the REST API connector through which the parent can be fetched
   * @returns {Observable<Relationship>} of this object after the source parent has been updated
   */
  public update_source_parent(
    restAPIService: RestApiConnectorService
  ): Observable<Relationship> {
    this.updating_refs = true;
    return this.get_parent_object(this.source_object, restAPIService).pipe(
      map(result => {
        this.source_parent = result;
        this.updating_refs = false;
        return this;
      })
    );
  }

  /**
   * Retrieve the parent object of this target object
   * @param {RestApiConnectorService} restAPIService the REST API connector through which the parent can be fetched
   * @returns {Observable<Relationship>} of this object after the target parent has been updated
   */
  public update_target_parent(
    restAPIService: RestApiConnectorService
  ): Observable<Relationship> {
    this.updating_refs = true;
    return this.get_parent_object(this.target_object, restAPIService).pipe(
      map(result => {
        this.target_parent = result;
        this.updating_refs = false;
        return this;
      })
    );
  }

  /**
   * Transform the current object into a raw object for sending to the back-end, stripping any unnecessary fields
   * @abstract
   * @returns {*} the raw object to send
   */
  public serialize(keepModified?: string): any {
    const rep = super.base_serialize();
    if (keepModified) {
      rep.stix.modified = keepModified;
    }

    rep.stix.relationship_type = this.relationship_type;
    rep.stix.source_ref = this.source_ref;
    rep.stix.target_ref = this.target_ref;

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
    const sdo = raw.stix;
    if ('source_ref' in sdo) {
      if (typeof sdo.source_ref === 'string') this.source_ref = sdo.source_ref;
      else
        logger.error(
          'TypeError: source_ref field is not a string:',
          sdo.source_ref,
          '(',
          typeof sdo.source_ref,
          ')'
        );
    }
    if ('target_ref' in sdo) {
      if (typeof sdo.target_ref === 'string') this.target_ref = sdo.target_ref;
      else
        logger.error(
          'TypeError: target_ref field is not a string:',
          sdo.target_ref,
          '(',
          typeof sdo.target_ref,
          ')'
        );
    }
    if ('relationship_type' in sdo) {
      if (typeof sdo.relationship_type === 'string')
        this.relationship_type = sdo.relationship_type;
      else
        logger.error(
          'TypeError: relationship_type field is not a string:',
          sdo.relationship_type,
          '(',
          typeof sdo.relationship_type,
          ')'
        );
    }
    // check for api attached source object
    if ('source_object' in raw) {
      this.source_object = raw.source_object;

      const src_sdo = raw.source_object.stix;
      if ('external_references' in src_sdo && src_sdo['external_references']) {
        if (
          src_sdo.external_references.length > 0 &&
          src_sdo.external_references[0].hasOwnProperty('external_id')
        ) {
          if (typeof src_sdo.external_references[0].external_id === 'string')
            this.source_ID = src_sdo.external_references[0].external_id;
          else
            logger.error(
              'TypeError: attackID field is not a string:',
              src_sdo.external_references[0].external_id,
              '(',
              typeof src_sdo.external_references[0].external_id,
              ')'
            );
        }
      } else this.source_ID = '';
    }
    // check for api attached target object
    if ('target_object' in raw) {
      this.target_object = raw.target_object;

      const tgt_sdo = raw.target_object.stix;
      if ('external_references' in tgt_sdo && tgt_sdo['external_references']) {
        if (
          tgt_sdo.external_references.length > 0 &&
          tgt_sdo.external_references[0].hasOwnProperty('external_id')
        ) {
          if (typeof tgt_sdo.external_references[0].external_id === 'string')
            this.target_ID = tgt_sdo.external_references[0].external_id;
          else
            logger.error(
              'TypeError: attackID field is not a string:',
              tgt_sdo.external_references[0].external_id,
              '(',
              typeof tgt_sdo.external_references[0].external_id,
              ')'
            );
        }
        // else logger.warn("ObjectWarning: cannot find attackID for target object");
      } else this.target_ID = '';
    }
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
    return this.base_validate(restAPIService).pipe(
      map(result => {
        // presence of source-ref
        if (!this.source_ref) {
          result.errors.push({
            field: 'source_ref',
            result: 'error',
            message: 'source object is not specified',
          });
        } else {
          result.successes.push({
            field: 'source_ref',
            result: 'error',
            message: 'source object specified',
          });
        }
        //presence of target ref
        if (!this.target_ref) {
          result.errors.push({
            field: 'target_ref',
            result: 'error',
            message: 'target object is not specified',
          });
        } else {
          result.successes.push({
            field: 'target_ref',
            result: 'error',
            message: 'target object specified',
          });
        }
        // is this a valid sub-technique-of relationship?
        if (
          this.source_ref &&
          this.target_ref &&
          this.relationship_type == 'subtechnique-of'
        ) {
          if (
            !this.source_object.stix.hasOwnProperty(
              'x_mitre_is_subtechnique'
            ) ||
            !this.source_object.stix.x_mitre_is_subtechnique
          ) {
            result.errors.push({
              field: 'source_ref',
              result: 'error',
              message: 'source is not a sub-technique',
            });
          }
          if (this.target_object.stix.x_mitre_is_subtechnique) {
            result.errors.push({
              field: 'target_ref',
              result: 'error',
              message: 'target is a sub-technique',
            });
          }
        }

        return result;
      }),
      //check for parallel relationships
      switchMap(result => {
        // find all objects connected to the source or target ref
        return restAPIService
          .getRelatedTo({
            sourceRef: this.source_ref,
            targetRef: this.target_ref,
          })
          .pipe(
            map(objects => {
              const relationships = objects.data as Relationship[];
              if (
                relationships.find(relationship => {
                  //parallel relationship
                  return (
                    relationship.stixID != this.stixID &&
                    relationship.source_ref == this.source_ref &&
                    relationship.target_ref == this.target_ref
                  );
                })
              ) {
                result.errors.push({
                  field: 'source_ref',
                  result: 'error',
                  message:
                    'a relationship already exists between these objects',
                });
              } else {
                result.successes.push({
                  field: 'source_ref',
                  result: 'success',
                  message: 'relationship is unique',
                });
              }
              return result;
            })
          );
      }),
      switchMap(result => {
        // check for existing sub-technique-of for targeted technique
        if (this.relationship_type == 'subtechnique-of') {
          return restAPIService
            .getRelatedTo({
              sourceRef: this.source_ref,
              relationshipType: 'subtechnique-of',
            })
            .pipe(
              map(objects => {
                if (objects.data.length > 0) {
                  //already has a parent
                  result.errors.push({
                    field: 'source_ref',
                    result: 'error',
                    message: 'sub-technique already has a parent',
                  });
                }
                return result;
              })
            );
        } else {
          return of(result);
        }
      })
    );
  }

  /**
   * Save the current state of the STIX object in the database. Update the current object from the response
   * @param restAPIService [RestApiConnectorService] the service to perform the POST/PUT through
   * @returns {Observable} of the post
   */
  public save(
    restAPIService: RestApiConnectorService
  ): Observable<Relationship> {
    if (!this.workflow) {
      // Initialize the workflow object if it doesn't exist
      this.workflow = { state: WorkflowStatus.WorkInProgress };
    }
    this.workflow.state = WorkflowStatus.WorkInProgress;
    const postObservable = restAPIService.postRelationship(this);
    const subscription = postObservable.subscribe({
      next: result => {
        this.deserialize(result.serialize());
        const source_object = this.getObject(
          this.source_object.stix.type,
          this.source_object
        );
        this.updateSourceTargetObject(restAPIService, source_object);
        const target_object = this.getObject(
          this.target_object.stix.type,
          this.target_object
        );
        this.updateSourceTargetObject(restAPIService, target_object);
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
    const deleteObservable = restAPIService.deleteRelationship(this.stixID);
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
  ): Observable<Relationship> {
    const putObservable = restAPIService.putRelationship(this);
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
   * Helper function to update the workflow status of the source object of the relationship,
   * @param restAPIService the rest api service
   * @param object the relationship source object
   */
  public updateSourceTargetObject(
    restAPIService: RestApiConnectorService,
    object: StixObject
  ) {
    // Check if the workflow object exists
    if (!object.workflow) {
      // Initialize the workflow object if it doesn't exist
      object.workflow = { state: WorkflowStatus.WorkInProgress };
    }
    object.workflow.state = WorkflowStatus.WorkInProgress;
    object.update(restAPIService).subscribe({
      next: response => {
        console.log('Object updated successfully:', response);
        window.location.reload();
      },
      error: error => {
        console.error('Error updating object:', error);
      },
      complete: () => {
        console.log('Complete');
      },
    });
  }
}
