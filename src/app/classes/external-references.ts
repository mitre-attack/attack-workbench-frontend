import { forkJoin, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { RestApiConnectorService } from '../services/connectors/rest-api/rest-api-connector.service';
import { Serializable, ValidationData } from './serializable';
import { StixObject } from './stix/stix-object';
import { logger } from '../utils/logger';
import { RelatedAsset } from './stix/asset';
import { xMitreFirstSeenCitationSchema } from '@mitre-attack/attack-data-model';

export class ExternalReferences extends Serializable {
  private _externalReferences = new Map<string, ExternalReference>();
  private _externalReferencesIndex = new Map<string, number>();
  private usedReferences: string[] = []; // array to store used references
  private missingReferences: string[] = []; // array to store missing references
  private brokenCitations: string[] = []; // array to store broken citations
  private invalidCitations: string[] = []; // array to store invalid citations

  /**
   * return external references list
   */
  public get externalReferences() {
    return this._externalReferences;
  }

  /**
   * Return list of external references in order
   */
  public list(): [number, ExternalReference, string][] {
    const externalRefList: [number, ExternalReference, string][] = [];

    for (const [key, value] of this._externalReferencesIndex) {
      if (this.getReference(key))
        externalRefList.push([value, this.getReference(key), key]);
    }

    return externalRefList;
  }

  /**
   * Sort _externalReferences by alphabetical order
   * Restart map for displaying references
   */
  public sortReferences(): void {
    // Sort map by alphabetical order on descriptions
    this._externalReferences = new Map(
      [...this._externalReferences.entries()].sort((a, b) =>
        a[1].description.localeCompare(b[1].description)
      )
    );

    // Restart _externalReferencesIndex map
    this._externalReferencesIndex = new Map();
    // Start index at 1
    let index = 1;
    // Index 1
    for (const [key, value] of this._externalReferences) {
      // Add to map if it has a description
      if (value.description) {
        // Do not include if description has (Citation: *)
        if (!value.description.includes('(Citation:')) {
          this._externalReferencesIndex.set(key, index);
          index += 1;
        }
      }
    }
  }

  /**
   * Return index of reference to display
   * Returns null if not found
   * @param sourceName source name of reference
   */
  public getIndexOfReference(sourceName: string): number {
    if (this._externalReferencesIndex.get(sourceName)) {
      return this._externalReferencesIndex.get(sourceName);
    }
    return null;
  }

  /**
   * Return if value exists in external references
   * @param sourceName source name of reference
   */
  public hasValue(sourceName: string): boolean {
    if (this._externalReferences.get(sourceName)) {
      return true;
    }
    return false;
  }

  /**
   * Return description of reference
   * @param sourceName source name of reference
   */
  public getDescription(sourceName: string): string {
    if (this._externalReferences.get(sourceName)) {
      const source = this._externalReferences.get(sourceName);
      if (source['description']) {
        return source['description'];
      }
    }
    return '';
  }

  /**
   * Return ExternalReference object of given source name
   * return undefined if not found
   * @param sourceName source name of reference
   */
  public getReference(sourceName: string): ExternalReference {
    return this._externalReferences.get(sourceName);
  }

  /**
   * Add ExternalReference object to external references list
   * @param sourceName source name of reference
   * @param externalReference external reference object
   */
  private addReference(
    sourceName: string,
    externalReference: ExternalReference
  ) {
    if (sourceName && externalReference) {
      this._externalReferences.set(sourceName, externalReference);
      // Sort references by description and update index map
      this.sortReferences();
    }
  }

  /**
   * Check if the reference is on the object, and add it if it is not.
   * Returns an observable that is true if the reference exists or has been added, and false if it couldn't be added
   * @param {string} sourceName  source name string of references
   * @param {RestApiConnectorService} restApiConnector the service to get references
   * @returns {Observable<boolean>} true if references is found in object or global external reference list, false if not
   */
  private checkAndAddReference(
    sourceName: string,
    restApiConnector: RestApiConnectorService
  ): Observable<boolean> {
    if (this.getReference(sourceName)) return of(true);
    return restApiConnector.getReference(sourceName).pipe(
      map(result => {
        const x = result as any[];
        if (x.length > 0) {
          this.addReference(sourceName, x[0]);
          return true;
        }
        return false;
      })
    );
  }

  /**
   * Parses object descriptive fields for citations and updates the
   * objects' external references list
   * @param object the object to parse citations within
   * @param restAPIConnector to connect to the REST API
   * @returns
   */
  public parseObjectCitations(
    object: StixObject,
    restAPIConnector: RestApiConnectorService
  ): Observable<CitationParseResult> {
    // get list of descriptive fields that support citations
    const refs_fields = ['description'];
    if (['software', 'group', 'campaign'].includes(object.attackType))
      refs_fields.push('aliases');
    if (object.attackType == 'asset') refs_fields.push('relatedAssets');
    if (object.attackType == 'technique') refs_fields.push('detection');
    if (object.attackType == 'campaign')
      refs_fields.push('first_seen_citation', 'last_seen_citation');

    // parse citations for each descriptive field on the object
    const parse_apis = [];
    for (const field of refs_fields) {
      if (field == 'aliases')
        parse_apis.push(
          this.parseCitationsFromAliases(object[field], restAPIConnector)
        );
      else if (field == 'relatedAssets')
        parse_apis.push(
          this.parseCitationsFromRelatedAssets(object[field], restAPIConnector)
        );
      else
        parse_apis.push(this.parseCitations(object[field], restAPIConnector));
    }

    return forkJoin(parse_apis).pipe(
      map((api_results: CitationParseResult[]) => {
        const citationResult = new CitationParseResult();
        // merge all results into a single object
        for (const parse_result of api_results) {
          citationResult.merge(parse_result);
        }
        // remove unused citations from external reference list
        this.removeUnusedReferences(Array.from(citationResult.usedCitations));
        return citationResult;
      })
    );
  }

  /**
   * Parses value for references
   * @param value the value to match citations within
   * @param restApiConnector to connect to the REST API
   */
  public parseCitations(
    value: string,
    restApiConnector: RestApiConnectorService
  ): Observable<CitationParseResult> {
    const reReference = /\(Citation: (.*?)\)/gmu;
    const result = new CitationParseResult({
      brokenCitations: this.validateBrokenCitations(value, [
        /\(Citation:([^ ].*?)\)/gmu,
        /\(citation:(.*?)\)/gmu,
        /\(Citation [^)]+\)/gmu,
      ]),
    });

    const apiMap: { [key: string]: Observable<any> } = {}; // Initialize API map
    // Extract citations even if the value doesn't pass validation
    const citations = value.match(reReference); // Extract citations using regex
    // Process citations
    if (citations) {
      for (const citation of citations) {
        const validateValue = xMitreFirstSeenCitationSchema.safeParse(citation);
        if (validateValue.success) {
          // Extract source name from citation
          const sourceName = citation.split('(Citation: ')[1].slice(0, -1);
          // Add API call to the map
          apiMap[sourceName] = this.checkAndAddReference(
            sourceName,
            restApiConnector
          );
        } else {
          if (citation != '') {
            result.invalidCitations.add(citation);
          }
        }
      }
    }
    // If there are valid citations to process, use forkJoin
    if (Object.keys(apiMap).length > 0) {
      return forkJoin(apiMap).pipe(
        map(apiResults => {
          const citationResults = apiResults as any;
          for (const key of Object.keys(citationResults)) {
            // Check if the citation was successfully processed
            if (citationResults[key]) {
              result.usedCitations.add(key);
            } else {
              result.missingCitations.add(key);
            }
          }
          return result;
        })
      );
    } else {
      // If no valid citations, return the result immediately
      return of(result);
    }
  }

  /**
   * validate given field for broken citation found by regular expression
   * @param field descriptive field that may contain citation
   * @param {regex[]} regExes regular expression
   */
  private validateBrokenCitations(field, regExes): Set<string> {
    const result = new Set<string>();
    for (const regex of regExes) {
      const brokenReferences = field.match(regex);
      if (brokenReferences) {
        for (const brokenReference of brokenReferences) {
          result.add(brokenReference);
        }
      }
    }
    return result;
  }

  /**
   * Parse citations from aliases which stores descriptions in external references
   * Add missing references to object if found in global external reference list
   * @param aliases list of alias names
   * @param restApiConnector to connect to the REST API
   */
  public parseCitationsFromAliases(
    aliases: string[],
    restApiConnector: RestApiConnectorService
  ): Observable<CitationParseResult> {
    // Parse citations from the alias descriptions stored in external references
    const api_calls = [];
    const result = new CitationParseResult();
    for (const alias of aliases) {
      if (this._externalReferences.get(alias)) {
        result.usedCitations.add(alias);
        api_calls.push(
          this.parseCitations(
            this._externalReferences.get(alias).description,
            restApiConnector
          )
        );
      }
    }
    if (api_calls.length == 0) return of(result);
    else
      return forkJoin(api_calls).pipe(
        // get citation errors for each alias
        map(api_results => {
          const citation_results = api_results as any;
          for (const citation_result of citation_results) {
            //merge into master list
            result.merge(citation_result);
          }
          return result; //return master list
        })
      );
  }

  /**
   * Parse citations from related assets which stores descriptions in the related asset object
   * Add missing references to object if found in global external reference list
   * @param relatedAssets list of related asset objects
   * @param restApiConnector to connect to the REST API
   */
  public parseCitationsFromRelatedAssets(
    relatedAssets: RelatedAsset[],
    restApiConnector: RestApiConnectorService
  ): Observable<CitationParseResult> {
    // Parse citations from the related asset descriptions
    const api_calls = [];
    const result = new CitationParseResult();
    for (const relatedAsset of relatedAssets) {
      if ('description' in relatedAsset && relatedAsset.description) {
        api_calls.push(
          this.parseCitations(relatedAsset.description, restApiConnector)
        );
      }
    }
    if (api_calls.length == 0) return of(result);
    else
      return forkJoin(api_calls).pipe(
        // get citation errors
        map(api_results => {
          const citation_results = api_results as any;
          for (const citation_result of citation_results) {
            // merge into master list
            result.merge(citation_result);
          }
          return result; // return master list
        })
      );
  }

  /**
   * Update external references map with given reference list
   * @param references list of references
   */
  public set externalReferences(references: any) {
    this._externalReferences = new Map();
    this._externalReferencesIndex = new Map();
    if (references) {
      // Create externalReferences list
      for (const reference of references) {
        if ('source_name' in reference && !('external_id' in reference)) {
          let description = '',
            url = '';
          if (reference.description) description = reference.description;
          if (reference.url) url = reference.url;

          const externalRef: ExternalReference = {
            url: url,
            description: description,
          };

          this._externalReferences.set(reference['source_name'], externalRef);
        }
      }

      // Sort references by description and update index map
      this.sortReferences();
    }
  }

  /**
   * Construct an external references object
   * optional @param references external references list from collection
   */
  constructor(references?) {
    super();
    if (references) this.deserialize(references);
  }

  /**
   *  Transform the current object into a raw object for sending to the back-end, stripping any unnecessary fields
   * @abstract
   * @returns {*} the raw object to send
   */
  public serialize(): ExternalReference[] {
    const rep: {}[] = [];

    for (const [key, value] of this._externalReferences) {
      const temp = {};

      temp['source_name'] = key; // do not trim source_name to prevent discrepancy between the Reference source_name and list of external references
      if (value['url']) temp['url'] = value['url'].trim();
      if (value['description']) temp['description'] = value['description'];

      rep.push(temp);
    }

    return rep;
  }
  /**
   * Parse the object from the record returned from the back-end
   * @abstract
   * @param {*} raw the raw object to parse
   */
  public deserialize(raw: any) {
    if (typeof raw === 'object') this.externalReferences = raw;
    else
      logger.error(
        'TypeError: external_references field is not an object:',
        raw,
        '(',
        typeof raw,
        ')'
      );
  }

  /**
   * Remove references which do not have the source name
   *
   * @param {string[]} usedSourceNames the source names that are used on the object; all other source names will be removed
   * @memberof ExternalReferences
   */
  public removeUnusedReferences(usedSourceNames: string[]) {
    // Create temp external references map from used references
    // Resulting map will remove unused references
    const temp_externalReferences = new Map<string, ExternalReference>();
    for (const usedSourceName of usedSourceNames) {
      if (this._externalReferences.get(usedSourceName))
        temp_externalReferences.set(
          usedSourceName,
          this._externalReferences.get(usedSourceName)
        );
    }

    const pre_delete_keys = Array.from(this._externalReferences.keys());
    // Update external references with used references
    this._externalReferences = temp_externalReferences;
    const post_delete_keys = Array.from(this._externalReferences.keys());
    logger.log(
      'removed unused references',
      pre_delete_keys.filter(x => !post_delete_keys.includes(x))
    );
    // Sort references by description and update index map
    this.sortReferences();
  }

  /*
   * Validate the current object state and return information on the result of the validation
   * Also removes unused external references.
   * @returns {Observable<ValidationData>} the validation warnings and errors once validation is complete.
   */
  public validate(
    restAPIService: RestApiConnectorService,
    options: { fields: string[]; object: StixObject }
  ): Observable<ValidationData> {
    const result = new ValidationData();
    const parse_apis = [];
    for (const field of options.fields) {
      if (!Object.keys(options.object)) continue; //object does not implement the field
      if (field == 'aliases')
        parse_apis.push(
          this.parseCitationsFromAliases(options.object[field], restAPIService)
        );
      else if (field == 'relatedAssets')
        parse_apis.push(
          this.parseCitationsFromRelatedAssets(
            options.object[field],
            restAPIService
          )
        );
      else
        parse_apis.push(
          this.parseCitations(options.object[field], restAPIService)
        );
    }
    return forkJoin(parse_apis).pipe(
      map(api_results => {
        const parse_results = api_results as CitationParseResult[];
        const citationResult = new CitationParseResult();
        for (const parse_result of parse_results) {
          citationResult.merge(parse_result); //merge all results into a single object
        }
        // use merged object to remove unused citations
        this.removeUnusedReferences(Array.from(citationResult.usedCitations));

        // add to validation result

        // broken citations
        const brokenCitations = Array.from(citationResult.brokenCitations);
        if (brokenCitations.length == 1)
          result.errors.push({
            result: 'error',
            field: 'external_references', //TODO set this to the actual field to improve warnings
            message: `Citation ${brokenCitations[0]} does not match format (Citation: source name)`,
          });
        else if (brokenCitations.length > 1)
          result.errors.push({
            result: 'error',
            field: 'external_references', //TODO set this to the actual field to improve warnings
            message: `Citations ${brokenCitations.join(', ')} do not match format (Citation: source name)`,
          });
        // invalid citations
        const invalidCitations = Array.from(citationResult.invalidCitations);
        if (invalidCitations.length == 1)
          result.errors.push({
            result: 'error',
            field: 'external_references', //TODO set this to the actual field to improve warnings
            message: `Citation does not match format (Citation: source name) or (Citation: source name)(Citation: source name)`,
          });
        else if (invalidCitations.length > 1)
          result.errors.push({
            result: 'error',
            field: 'external_references', //TODO set this to the actual field to improve warnings
            message: `Citations ${invalidCitations.join(', ')} do not match format (Citation: source name) or (Citation: source name)(Citation: source name)`,
          });

        //missing citations
        const missingCitations = Array.from(citationResult.missingCitations);
        if (missingCitations.length == 1)
          result.errors.push({
            result: 'error',
            field: 'external_references', //TODO set this to the actual field to improve warnings
            message: `Cannot find reference: ${missingCitations[0]} `,
          });
        else if (missingCitations.length > 1)
          result.errors.push({
            result: 'error',
            field: 'external_references', //TODO set this to the actual field to improve warnings
            message: `Cannot find references: ${missingCitations.join(', ')}`,
          });
        //return the result
        return result;
      })
    );
  }
}

export interface ExternalReference {
  /** source name of the reference */
  source_name?: string;
  /** url; url of reference */
  url?: string;
  /** description; description of reference */
  description?: string;
}

/**
 * The results of parsing citations in a single field
 */
export class CitationParseResult {
  //list of reference source names which have been used in this field
  public usedCitations = new Set<string>();
  //citations that could not be found
  public missingCitations = new Set<string>();
  // list of broken references detected in the field
  public brokenCitations = new Set<string>();
  // list of invalid references detected in the field
  public invalidCitations = new Set<string>();

  constructor(initData?: {
    usedCitations?: Set<string>;
    missingCitations?: Set<string>;
    brokenCitations: Set<string>;
    invalidCitations?: Set<string>;
  }) {
    if (initData && initData.usedCitations)
      this.usedCitations = initData.usedCitations;
    if (initData && initData.missingCitations)
      this.missingCitations = initData.missingCitations;
    if (initData && initData.brokenCitations)
      this.brokenCitations = initData.brokenCitations;
    if (initData && initData.invalidCitations)
      this.invalidCitations = initData.invalidCitations;
  }

  /**
   * Merge results from another CitationParseResult into this object
   * @param {CitationParseResult} that results from other object
   */
  public merge(that: CitationParseResult) {
    this.usedCitations = new Set([
      ...this.usedCitations,
      ...that.usedCitations,
    ]);
    this.missingCitations = new Set([
      ...this.missingCitations,
      ...that.missingCitations,
    ]);
    this.brokenCitations = new Set([
      ...this.brokenCitations,
      ...that.brokenCitations,
    ]);
    this.invalidCitations = new Set([
      ...this.invalidCitations,
      ...that.invalidCitations,
    ]);
  }
}
