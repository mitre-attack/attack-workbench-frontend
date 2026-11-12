import { AbstractControl, ValidatorFn } from '@angular/forms';
import { logger } from '../utils/logger';

export class VersionNumber {
  private _version = [];
  public get version(): string {
    return this.toString();
  }
  public set version(v: string) {
    this._version = v.split('.');
  }

  /**
   * Construct a new version number object
   * @param version version number as string, e.g "6.0.1". Must be a set of numbers separated by .s
   */
  constructor(version: string) {
    this.version = version;
  }

  /**
   * Get the version number as a string
   */
  public toString(): string {
    return this._version.join('.');
  }

  /**
   * Return a new VersionNumber which has the next major version
   * @returns {VersionNumber} the next major version
   */
  public nextMajorVersion(): VersionNumber {
    const clone = JSON.parse(JSON.stringify(this._version));
    clone[0] = parseInt(clone[0]) + 1;
    clone[0] = clone[0].toString();
    for (let i = 1; i < clone.length; i++) clone[i] = 0; //zero out subsequent indexes
    return new VersionNumber(clone.join('.'));
  }

  /**
   * Return a new VersionNumber which has the next major version
   * @returns {VersionNumber} the next major version
   */
  public nextMinorVersion(): VersionNumber {
    if (this.granularity < 2) {
      logger.error(`cannot increment minor version of ${this.toString()}`);
      return this; //cannot increment
    }
    const clone = JSON.parse(JSON.stringify(this._version));
    clone[1] = parseInt(clone[1]) + 1;
    clone[1] = clone[1].toString();
    for (let i = 2; i < clone.length; i++) clone[i] = 0; //zero out subsequent indexes
    return new VersionNumber(clone.join('.'));
  }

  /**
   * Get the level of granularity of the version.
   * E.g 10.12.4 would have a granularity of 3,
   * and 6.2 would have a granularity of 2
   * @returns {number} the level of granularity
   */
  public get granularity(): number {
    return this._version.length;
  }

  /**
   * Get the sub-version of the version number
   * @param index the index to get. E.g index of 2 with version 1.2.3.4 would return "3"
   */
  public getSubVersion(index: number) {
    if (index > this.granularity || index < 0)
      throw 'cannot fetch sub-version, index out of bounds';
    return this._version[index];
  }

  /**
   * Compare this version number to another version number.
   * Note: higher granularity versions are considered by this implementation to be greater versions,
   * so 1.0.0.0 is greater than 1.0.
   * @param {VersionNumber} that the version to compare to
   * @returns {number} 0 if the same, + if this is greater, - if that is greater
   */
  public compareTo(that: VersionNumber): number {
    for (let i = 0; i < Math.max(this.granularity, that.granularity); i++) {
      if (this.granularity == that.granularity && this.granularity < i)
        return 0; //same version
      if (this.granularity < i) return -1;
      if (that.granularity < i) return 1;
      if (this.getSubVersion(i) == that.getSubVersion(i)) continue;
      return this.getSubVersion(i) - that.getSubVersion(i);
    }
    return 0; //same version
  }

  /**
   * Check if this version number is more than one increment above the other version number
   * e.g v1.0 -> v3.0 is true, v1.1 -> v1.6 is true, v1.0 -> v1.2 is true, v1.0 -> 2.1 is true, v1.0 -> v2.0 is false
   * @param {VersionNumber} that version number to check against
   * @returns {boolean} true if the version number has incremented at least twice
   */
  public isDoubleIncrement(that: VersionNumber): boolean {
    // sum up increments of each index
    let timesIncremented = 0; //track the number of times it has been incremented
    for (let i = 0; i < Math.max(this.granularity, that.granularity); i++) {
      const thisVersionIndex =
        this.granularity >= i ? this.getSubVersion(i) : 0;
      const thatVersionIndex =
        timesIncremented > 0
          ? 0
          : that.granularity >= i
            ? that.getSubVersion(i)
            : 0; //if it has been incremented at a higher index, expect later indexes to be 0
      timesIncremented += Math.max(thisVersionIndex - thatVersionIndex, 0);
      if (timesIncremented > 1) return true;
    }
    return timesIncremented > 1;
  }
}

/**
 * form field validator checking if the version number is formatted correctly
 */
export function versionNumberFormatValidator(): ValidatorFn {
  const pattern = /^(\d+\.)*\d+$/;
  return (control: AbstractControl): Record<string, any> | null => {
    const valid = pattern.test(control.value);
    return !valid ? { invalidVersionFormat: { value: control.value } } : null;
  };
}
/**
 * form field validator checking if the version has been incremented
 * @param previousVersion the version the object was previously, for comparison
 */
export function versionNumberIncrementValidator(
  previousVersion: VersionNumber
): ValidatorFn {
  return (control: AbstractControl): Record<string, any> | null => {
    const valid =
      new VersionNumber(control.value).compareTo(previousVersion) > 0;
    return !valid ? { versionNotIncremented: { value: control.value } } : null;
  };
}
