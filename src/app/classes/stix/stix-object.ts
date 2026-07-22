import {
  createAttackIdSchema,
  StixTypesWithAttackIds,
} from '@mitre-attack/attack-data-model';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  Paginated,
  RestApiConnectorService,
} from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import {
  AttackTypeToRoute,
  StixTypeToAttackType,
} from 'src/app/utils/type-mappings';
import { WorkflowStatus, WorkflowStatusType } from 'src/app/utils/types';
import { v4 as uuid } from 'uuid';
import { logger } from '../../utils/logger';
import { ExternalReferences } from '../external-references';
import { Serializable, ValidationData } from '../serializable';
import { VersionNumber } from '../version-number';

export abstract class StixObject extends Serializable {
  public stixID: string; // STIX ID
  public type: string; // STIX type
  public attackType: string; // ATT&CK type
  public attackID: string; // ATT&CK ID
  public description: string;

  public created_by_ref: string; //embedded relationship
  public created_by?: any;
  public modified_by_ref: string; //embedded relationship
  public modified_by?: any;
  public firstInitialized: boolean; // boolean to track if it is a newly created object

  public object_marking_refs: string[] = []; //list of embedded relationships to marking_defs

  public abstract readonly supportsAttackID: boolean; // boolean to determine if object supports ATT&CK IDs
  public tempWorkflowState: WorkflowStatusType;
  protected abstract get attackIDValidator(): {
    regex: string; // regex to validate the ID
    format: string; // format to display to user
  };

  // fields to omit. By default, do not omit any fields
  protected excludedFields: string[] = [];

  protected buildAttackExternalReference(): object | null {
    if (this.attackID && AttackTypeToRoute[this.attackType]) {
      return {
        source_name: 'mitre-attack',
        external_id: this.attackID,
        url: `https://attack.mitre.org/${AttackTypeToRoute[this.attackType]}/${this.attackID.replace(/\./g, '/')}`,
      };
    }
    return null;
  }

  private defaultMarkingDefinitionsLoaded = false; // avoid overloading of default marking definitions

  public created: Date; // object created date
  public modified: Date; // object modified date
  public version: VersionNumber; // version number of the object
  public external_references: ExternalReferences;
  public workflow: {
    state: WorkflowStatusType;
    created_by_user_account?: string;
  };

  public deprecated = false; //is object deprecated?
  public revoked = false; //is object revoked?

  /**
   * Initialize the STIX object
   * @param sdo the STIX domain object to initialize data from
   */
  constructor(sdo?: any, type?: string) {
    super();
    if (sdo) {
      this.base_deserialize(sdo);
      this.firstInitialized = false;
    } else {
      // create new SDO
      this.stixID = type + '--' + uuid();
      this.type = type;
      this.version = new VersionNumber('0.1');
      this.attackID = '';
      this.external_references = new ExternalReferences();
      if (this.type !== 'x-mitre-collection' && this.type !== 'relationship') {
        this.workflow = {
          state: WorkflowStatus.WorkInProgress,
        };
      }
      this.description = '';
      this.firstInitialized = true;
    }
    this.attackType = StixTypeToAttackType[this.type];
  }

  /**
   * Transform the current object into a raw object for sending to the back-end, stripping any unnecessary fields
   * @abstract
   * @returns {*} the raw object to send
   */
  public base_serialize(): any {
    const serialized_external_references = this.external_references.serialize();

    // Add attackID entry
    const attackExtRef = this.buildAttackExternalReference();
    if (attackExtRef) {
      serialized_external_references.unshift(attackExtRef);
    }

    const stix = this.filterObject({
      type: this.type,
      id: this.stixID,
      created: this.created
        ? this.created.toISOString()
        : new Date().toISOString(),
      modified:
        this.type !== 'marking-definition'
          ? new Date().toISOString()
          : undefined,
      x_mitre_version: this.version?.toString(),
      x_mitre_deprecated: this.deprecated,
      revoked: this.revoked,
      spec_version: '2.1',
      description: this.description,
      created_by_ref: this.created_by_ref,
      object_marking_refs: this.object_marking_refs,
      external_references: serialized_external_references,
    });

    for (const field of this.excludedFields) {
      delete stix[field];
    }

    return {
      workspace: {
        workflow: this.workflow || {},
      },
      stix: stix,
    };
  }

  /**
   * Parse the object from the record returned from the back-end
   * @abstract
   * @param {*} raw the raw object to parse
   */
  public base_deserialize(raw: any) {
    if ('stix' in raw) {
      const sdo = raw.stix;

      // initialize common fields from SDO stix
      if ('id' in sdo) {
        if (typeof sdo.id === 'string') this.stixID = sdo.id;
        else
          logger.error(
            'TypeError: id field is not a string:',
            sdo.id,
            '(',
            typeof sdo.id,
            ')'
          );
      }

      if ('object_marking_refs' in sdo) {
        if (this.isStringArray(sdo.object_marking_refs))
          this.object_marking_refs = sdo.object_marking_refs;
        else
          logger.error(
            'TypeError, object_marking_refs field is not a string array',
            this.object_marking_refs,
            '(',
            typeof this.object_marking_refs,
            ')'
          );
      }

      if ('type' in sdo) {
        if (typeof sdo.type === 'string') this.type = sdo.type;
        else
          logger.error(
            'TypeError: type field is not a string:',
            sdo.type,
            '(',
            typeof sdo.type,
            ')'
          );
      }

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

      if ('created' in sdo) {
        if (typeof sdo.created === 'string')
          this.created = new Date(sdo.created);
        else
          logger.error(
            'TypeError: created field is not a string:',
            sdo.created,
            '(',
            typeof sdo.created,
            ')'
          );
      } else this.created = new Date();

      if ('created_by_ref' in sdo) {
        if (typeof sdo.created === 'string')
          this.created_by_ref = sdo.created_by_ref;
        else
          logger.error(
            'TypeError: created_by_Ref field is not a string:',
            sdo.created_by_ref,
            '(',
            typeof sdo.created_by_ref,
            ')'
          );
      }

      if ('modified' in sdo) {
        if (typeof sdo.modified === 'string')
          this.modified = new Date(sdo.modified);
        else
          logger.error(
            'TypeError: modified field is not a string:',
            sdo.modified,
            '(',
            typeof sdo.modified,
            ')'
          );
      } else if ('type' in sdo && sdo.type != 'marking-definition')
        this.modified = new Date();

      if ('x_mitre_modified_by_ref' in sdo) {
        if (typeof sdo.created === 'string')
          this.modified_by_ref = sdo.x_mitre_modified_by_ref;
        else
          logger.error(
            'TypeError: x_mitre_modified_by_ref field is not a string:',
            sdo.x_mitre_modified_by_ref,
            '(',
            typeof sdo.x_mitre_modified_by_ref,
            ')'
          );
      }

      if ('x_mitre_version' in sdo) {
        if (typeof sdo.x_mitre_version === 'string')
          this.version = new VersionNumber(sdo.x_mitre_version);
        else
          logger.error(
            'TypeError: x_mitre_version field is not a string:',
            sdo.x_mitre_version,
            '(',
            typeof sdo.x_mitre_version,
            ')'
          );
      } else this.version = new VersionNumber('0.1');

      if ('external_references' in sdo && sdo['external_references']) {
        if (typeof sdo.external_references === 'object') {
          this.external_references = new ExternalReferences(
            sdo.external_references
          );
          const attack_sources = [
            'mitre-attack',
            'mitre-mobile-attack',
            'mitre-ics-attack',
          ];
          if (
            sdo.external_references.length > 0 &&
            this.type != 'relationship' &&
            sdo.external_references[0].hasOwnProperty('external_id') &&
            sdo.external_references[0].hasOwnProperty('source_name') &&
            attack_sources.includes(sdo.external_references[0].source_name)
          ) {
            if (typeof sdo.external_references[0].external_id === 'string')
              this.attackID = sdo.external_references[0].external_id;
            else
              logger.error(
                'TypeError: attackID field is not a string:',
                sdo.external_references[0].external_id,
                '(',
                typeof sdo.external_references[0].external_id,
                ')'
              );
          } else this.attackID = '';
        } else
          logger.error(
            'TypeError: external_references field is not an object:',
            sdo.external_references,
            '(',
            typeof sdo.external_references,
            ')'
          );
      } else {
        this.external_references = new ExternalReferences();
        this.attackID = '';
      }

      if ('x_mitre_deprecated' in sdo) {
        if (typeof sdo.x_mitre_deprecated === 'boolean')
          this.deprecated = sdo.x_mitre_deprecated;
        else
          logger.error(
            'TypeError: x_mitre_deprecated field is not a boolean:',
            sdo.x_mitre_deprecated,
            '(',
            typeof sdo.x_mitre_deprecated,
            ')'
          );
      }
      if ('revoked' in sdo) {
        if (typeof sdo.revoked === 'boolean') this.revoked = sdo.revoked;
        else
          logger.error(
            'TypeError: revoked field is not a boolean:',
            sdo.revoked,
            '(',
            typeof sdo.revoked,
            ')'
          );
      }
    } else logger.error("ObjectError: 'stix' field does not exist in object");

    if ('created_by_identity' in raw && raw.created_by_identity) {
      const identityData = raw.created_by_identity;
      if ('stix' in identityData) {
        this.created_by = identityData.stix;
      } else
        logger.error(
          "ObjectError: 'stix' field does not exist in created_by_identity object"
        );
    }
    if ('modified_by_identity' in raw && raw.modified_by_identity) {
      const identityData = raw.modified_by_identity;
      if ('stix' in identityData) {
        this.modified_by = identityData.stix;
      } else
        logger.error(
          "ObjectError: 'stix' field does not exist in modified_by_identity object"
        );
    }

    if ('workspace' in raw) {
      // parse workspace fields
      const workspaceData = raw.workspace;
      if ('workflow' in workspaceData && workspaceData.workflow !== undefined) {
        if (typeof workspaceData.workflow == 'object') {
          this.workflow = workspaceData.workflow;
        } else
          logger.error(
            'TypeError: workflow field is not an object',
            workspaceData
          );
      }
    }
  }

  /**
   * Validate the object's ATT&CK ID
   * This function handles cases in which the object has an organization prefix
   * @returns true if the ATT&CK ID is valid, false otherwise
   */
  public isValidAttackId(): boolean {
    if (this.type in StixTypeToAttackType) {
      const attackIDSchema = createAttackIdSchema(
        this.type as StixTypesWithAttackIds
      );
      const attackIDValid = attackIDSchema.safeParse(this.attackID);
      return attackIDValid.success;
    }
    return false;
  }

  /**
   * Validate the current object state and return information on the result of the validation
   * @abstract
   * @param {RestApiConnectorService} restAPIService: the REST API connector through which asynchronous validation can be completed
   * @returns {Observable<ValidationData>} the validation warnings and errors once validation is complete.
   */
  public base_validate(
    restAPIService: RestApiConnectorService,
    tempWorkflowState?
  ): Observable<ValidationData> {
    if (tempWorkflowState) {
      this.workflow = { state: tempWorkflowState };
    }
    // check any asynchronous validators
    const result = new ValidationData();
    // Throws user friendly error when name is missing in the stix object
    // Need to exclude analytics from this check because user cannot set names
    // for analytics and those are automatically generated
    if (this.hasOwnProperty('name') && this.type != 'x-mitre-analytic') {
      if ('name' in this) {
        const name = this.name;
        if (typeof name !== 'string' || name.trim() === '') {
          result.errors.push({
            result: 'error',
            field: 'name',
            message: 'name is required',
          });
          return of(result);
        }
      }
    }
    const validator = restAPIService.validateStixObject();

    return validator(this).pipe(
      switchMap(validatorResult => {
        // Process validation errors from API (backend now handles error-to-warning conversion)
        (validatorResult.errors || []).forEach((err: any) => {
          const errorMessage = `${err.path.join('.')}: ${err.message}`;
          result.errors.push({
            result: 'error',
            field: 'temp',
            message: errorMessage,
          });
        });

        // Process validation warnings from API
        (validatorResult.warnings || []).forEach((warning: any) => {
          const warningMessage =
            warning.message || `${warning.path.join('.')}: ${warning.message}`;
          result.warnings.push({
            result: 'warning',
            field: warning.path[warning.path.length - 1] || 'temp',
            message: warningMessage,
          });
        });
        // check if the name is unique if it has a name
        //do not check name or attackID for relationships or marking definitions
        if (
          this.attackType == 'relationship' ||
          this.attackType == 'marking-definition'
        )
          return of(result);
        // check if name & ATT&CK ID is unique, record result in validation, and return validation
        const options = {
          // validate against revoked & deprecated objects
          includeRevoked: true,
          includeDeprecated: true,
        };
        let accessor: Observable<Paginated<StixObject>>;
        if (this.attackType == 'collection')
          accessor = restAPIService.getAllCollections(options);
        else if (this.attackType == 'group')
          accessor = restAPIService.getAllGroups(options);
        else if (this.attackType == 'campaign')
          accessor = restAPIService.getAllCampaigns(options);
        else if (this.attackType == 'software')
          accessor = restAPIService.getAllSoftware(options);
        else if (this.attackType == 'matrix')
          accessor = restAPIService.getAllMatrices(options);
        else if (this.attackType == 'mitigation')
          accessor = restAPIService.getAllMitigations(options);
        else if (this.attackType == 'technique')
          accessor = restAPIService.getAllTechniques(options);
        else if (this.attackType == 'data-source')
          accessor = restAPIService.getAllDataSources(options);
        else if (this.attackType == 'data-component')
          accessor = restAPIService.getAllDataComponents(options);
        else if (this.attackType == 'asset')
          accessor = restAPIService.getAllAssets();
        else if (this.attackType == 'analytic')
          accessor = restAPIService.getAllAnalytics(options);
        else if (this.attackType == 'detection-strategy')
          accessor = restAPIService.getAllDetectionStrategies(options);
        else accessor = restAPIService.getAllTactics(options);

        return accessor.pipe(
          map(objects => {
            // check name
            if (this.hasOwnProperty('name')) {
              if (
                objects.data.some(
                  x =>
                    x['name'].toLowerCase() == this['name'].toLowerCase() &&
                    x.stixID != this.stixID
                )
              ) {
                result.warnings.push({
                  result: 'warning',
                  field: 'name',
                  message: 'name is not unique',
                });
              } else {
                result.successes.push({
                  result: 'success',
                  field: 'name',
                  message: 'name is unique',
                });
              }
            }
            return result;
          })
        );
      }), //end switchmap
      // validate external references
      switchMap(result => {
        // build list of fields to validate external references on according to ATT&CK type
        const refs_fields = ['description'];
        if (['software', 'group', 'campaign'].includes(this.attackType))
          refs_fields.push('aliases');
        if (this.attackType == 'asset') refs_fields.push('relatedAssets');
        if (this.attackType == 'technique') refs_fields.push('detection');

        return this.external_references
          .validate(restAPIService, { object: this, fields: refs_fields })
          .pipe(
            map(refs_result => {
              result.merge(refs_result);
              return result;
            })
          );
      }),
      // validate LinkByIDs
      switchMap(result => {
        // build list of fields supporting LinkByIDs
        const refs_fields = ['description'];
        if (this.attackType == 'technique') refs_fields.push('detection');

        const parse_apis = [];
        for (const field of refs_fields) {
          parse_apis.push(this.parseLinkByIds(this[field], restAPIService));
        }

        return forkJoin(parse_apis).pipe(
          map(api_results => {
            const validation_results = api_results as LinkByIdParseResult[];
            const linkResult = new LinkByIdParseResult();
            for (const validation_result of validation_results) {
              linkResult.merge(validation_result); // merge all results to a single object
            }

            // broken links
            const brokenLinks = Array.from(linkResult.brokenLinks);
            if (brokenLinks.length == 1)
              result.errors.push({
                result: 'error',
                field: 'description',
                message: `LinkById ${brokenLinks[0]} does not match format (LinkById: ATT&CK ID)`,
              });
            else if (brokenLinks.length > 1)
              result.errors.push({
                result: 'error',
                field: 'description',
                message: `LinkByIds ${brokenLinks.join(', ')} do not match format (LinkById: ATT&CK ID)`,
              });

            // missing links
            const missingLinks = Array.from(linkResult.missingLinks);
            if (missingLinks.length == 1)
              result.errors.push({
                result: 'error',
                field: 'description',
                message: `Cannot find linked object: ${missingLinks[0]}`,
              });
            else if (missingLinks.length > 1)
              result.errors.push({
                result: 'error',
                field: 'description',
                message: `Cannot find linked objects: ${missingLinks.join(', ')}`,
              });
            return result;
          })
        );
      }),
      // validate 'revoked-by' relationship exists
      switchMap(result => {
        if (!this.revoked) return of(result); // do not check for revoked-by relationship

        const accessor = restAPIService.getRelatedTo({
          sourceRef: this.stixID,
        });
        return accessor.pipe(
          map(objects => {
            if (
              !objects.data.find(
                relationship =>
                  relationship['relationship_type'] == 'revoked-by'
              )
            ) {
              result.errors.push({
                result: 'error',
                field: 'revoked',
                message: "'revoked-by' relationship does not exist",
              });
            } else {
              result.successes.push({
                result: 'success',
                field: 'revoked',
                message: "'revoked-by' relationship exists",
              });
            }
            return result;
          })
        );
      })
    ); //end pipe
  }

  /**
   * parses given field for linked objects
   * @param field the field in which to parse LinkByIds
   */
  private parseLinkByIds(
    field: string,
    restAPIService: RestApiConnectorService
  ): Observable<LinkByIdParseResult> {
    const reLinkById = /\(LinkById: (.*?)\)/gmu;
    const links = field.match(reLinkById);
    const result = new LinkByIdParseResult({
      brokenLinks: this.validateBrokenLinks(field, [
        /\(LinkById:([^ ].*?)\)/gmu,
        /\(LinkByID:(.*?)\)/gmu,
        /\(linkById:(.*?)\)/gmu,
      ]),
    });

    if (!links) return of(result); // no LinkByIds found

    const ids = [];
    for (const link of links) {
      const id = link.split('(LinkById: ')[1].slice(0, -1);
      if (!ids.includes(id) && id != '') ids.push(id);
    }

    return restAPIService
      .getAllObjects({
        attackIDs: ids,
        revoked: true,
        deprecated: true,
        deserialize: true,
      })
      .pipe(
        map((results: any) => {
          // objects must be validated in cases where more than one object is
          // returned by the given ATT&CK ID, this occurs due to older versions
          // of ATT&CK in which techniques shared their IDs with mitigations
          const validObjects = (results.data as StixObject[]).filter(
            obj => obj.supportsAttackID && obj.isValidAttackId()
          );
          const retrieved_ids = validObjects.map(obj => obj.attackID);
          for (const id of ids) {
            if (!retrieved_ids.includes(id)) result.missingLinks.add(id);
          }
          return result;
        })
      );
  }

  /**
   * validate the given field for broken LinkByIds found via regex
   * @param field field that may have LinkByIds
   * @param {regex[]} regExes regular expressions matching potential invalid tags
   */
  private validateBrokenLinks(field: string, regExes): Set<string> {
    const result = new Set<string>();
    for (const regex of regExes) {
      const brokenLinks = field.match(regex);
      if (brokenLinks) {
        brokenLinks.forEach(l => result.add(l));
      }
    }
    return result;
  }

  /**
   * Checks if the provided field has a valid value.
   * Returns undefined or the value of the field if it is valid
   * @param {*} field - The value to validate.
   * @returns {value} - Value if the field has a valid value, undefined otherwise.
   */
  public clean(value) {
    if (value == null) return undefined; // null or undefined
    if (typeof value === 'string' && value.trim() === '') return undefined;
    if (typeof value === 'number' && Number.isNaN(value)) return undefined;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return undefined;
      } else {
        const arr = value.map(v => this.clean(v)).filter(v => v !== undefined);
        return arr.length ? arr : undefined;
      }
    }

    if (typeof value === 'object') {
      const obj = this.filterObject(value);
      return Object.keys(obj).length ? obj : undefined;
    }

    return value;
  }

  /**
   * Filters the properties of an object, returning a new object containing only
   * those entries whose values pass the validity check.
   * @param {Object} obj - The object to filter.
   * @returns {Object} - A new object with only the valid entries.
   */
  public filterObject(obj) {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleaned = this.clean(value);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }

  /**
   * Check if the given array is a list of strings
   * @param arr the array to check
   * @returns true if all objects in the array are of type string, false otherwise
   */
  public isStringArray = function (arr): boolean {
    for (const a of arr) {
      if (typeof a !== 'string') {
        logger.error('TypeError:', a, '(', typeof a, ')', 'is not a string');
        return false;
      }
    }
    return true;
  };

  /**
   * Conditionally serializes an array field to the target object only if it contains at least one element.
   * This ensures that empty arrays are never included in the serialized STIX object sent to the backend,
   * which is critical because the REST API does not accept empty arrays in POST/PUT requests.
   *
   * Use this method in serialize() implementations to prevent empty array fields from being set.
   *
   * @param target - The target object (typically rep.stix) to set the field on
   * @param key - The field name in the STIX object (e.g., 'x_mitre_platforms')
   * @param value - The array value to conditionally serialize
   * @param transform - Optional transformation function to apply to the array before setting (e.g., mapping, trimming)
   *
   * @example
   * // Simple usage - only set if array is non-empty
   * this.serializeArrayField(rep.stix, 'x_mitre_platforms', this.platforms);
   *
   * @example
   * // With transformation - trim strings before serializing
   * this.serializeArrayField(
   *   rep.stix,
   *   'x_mitre_contributors',
   *   this.contributors,
   *   (contributors) => contributors.map(x => x.trim())
   * );
   */
  protected serializeArrayField<T, R = T>(
    target: any,
    key: string,
    value: T[],
    transform?: (val: T[]) => R[]
  ): void {
    if (Array.isArray(value) && value.length > 0) {
      target[key] = transform ? transform(value) : value;
    }
  }

  /**
   * Save the current state of the STIX object in the database. Update the current object from the response
   * @param restAPIService [RestApiConnectorService] the service to perform the POST/PUT through
   * @returns {Observable} of the post
   */
  abstract save(
    restAPIService: RestApiConnectorService
  ): Observable<StixObject>;

  /**
   * Delete the STIX object from the database.
   * @param restAPIService [RestApiConnectorService] the service to perform the DELETE through
   */
  abstract delete(restAPIService: RestApiConnectorService): Observable<object>;

  /**
   * Update the state of the STIX object in the database. Update the current object from the response
   * @param restAPIService [RestApiConnectorService] the service to perform the PUT through
   * @returns {Observable} of the pout
   */
  abstract update(restAPIService: RestApiConnectorService): Observable<object>;

  /**
   * Revoke the STIX object in the database.
   * @param restAPIService [RestApiConnectorService] the service to perform the revoke through
   * @param revokingObject the revoking object payload
   * @returns {Observable} of the revoke
   */
  public revoke?(
    restAPIService: RestApiConnectorService,
    revokingObject: { revoking: { stixId: string; modified: string } },
    preserveRelationships?: boolean
  ): Observable<object>;

  /**
   * Updates the object's marking definitions with the default the first time an object is created
   * @param restAPIService [RestApiConnectorService] the service to perform the POST/PUT through
   */
  public setDefaultMarkingDefinitions(restAPIService: RestApiConnectorService) {
    const data$ = restAPIService.getDefaultMarkingDefinitions();
    const sub = data$.subscribe({
      next: data => {
        const marking_refs = [];
        for (const i in data) {
          marking_refs.push(data[i].stix.id); // Select current statements by default
        }
        this.object_marking_refs = marking_refs;
        this.defaultMarkingDefinitionsLoaded = true;
      },
      complete: () => {
        sub.unsubscribe();
      },
    });
  }
}

/**
 * The results of parsing LinkByIds in a single field
 */
export class LinkByIdParseResult {
  public missingLinks = new Set<string>(); // LinkByIds that could not be found
  public brokenLinks = new Set<string>(); // list of broken LinkByIds detected in the field

  constructor(initData?: {
    missingLinks?: Set<string>;
    brokenLinks: Set<string>;
  }) {
    if (initData && initData.missingLinks)
      this.missingLinks = initData.missingLinks;
    if (initData && initData.brokenLinks)
      this.brokenLinks = initData.brokenLinks;
  }

  /**
   * Merge results from another LinkByIdParseResult into this object
   * @param {LinkByIdParseResult} that results from other object
   */
  public merge(that: LinkByIdParseResult) {
    this.missingLinks = new Set([...this.missingLinks, ...that.missingLinks]);
    this.brokenLinks = new Set([...this.brokenLinks, ...that.brokenLinks]);
  }
}

export interface EmbeddedRelationship {
  stixId: string;
  name: string;
  attackId: string;
}
