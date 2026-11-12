import { Component, Input } from '@angular/core';

const USER_AVATAR_BACKGROUNDS = [
  '#3f5f7f',
  '#4a7078',
  '#55735f',
  '#6d704d',
  '#85634b',
  '#8a5264',
  '#765a83',
  '#5b638c',
  '#4f746f',
  '#6f5f78',
];

const IGNORED = new Set(['ii', 'iii', 'iv', 'v', 'jr', 'sr', 'dr', 'phd']);

@Component({
  selector: 'app-user-avatar',
  templateUrl: './user-avatar.component.html',
  styleUrls: ['./user-avatar.component.scss'],
  standalone: true,
})
export class UserAvatarComponent {
  @Input() public name = 'Unknown User';

  private defaultSize = 24;
  private _size = this.defaultSize;

  @Input()
  public set size(value: number | string) {
    const parsed = Number(value);
    this._size =
      Number.isFinite(parsed) && parsed > 0 ? parsed : this.defaultSize;
  }

  public get size(): number {
    return this._size;
  }

  public get initials(): string {
    const value = `${this.name || 'Unknown User'}`.trim();
    if (!value) return '?';

    const words = this.initialWords(value);
    if (words.length > 1) {
      return `${this.firstCharacters(words[0], 1)}${this.firstCharacters(
        words[words.length - 1],
        1
      )}`.toLocaleUpperCase();
    }

    return this.firstCharacters(words[0], 2).toLocaleUpperCase();
  }

  public get background(): string {
    const key = `${this.name || this.initials}`.trim().toLocaleLowerCase();
    return USER_AVATAR_BACKGROUNDS[
      this.hash(key) % USER_AVATAR_BACKGROUNDS.length
    ];
  }

  public get fontSize(): number {
    return Math.max(10, Math.round(this.size * 0.5));
  }

  public get ariaLabel(): string {
    return this.name ? `${this.name} avatar` : 'User avatar';
  }

  private firstCharacters(value: string, count: number): string {
    return (value.match(/[\p{L}\p{N}]/gu) || []).slice(0, count).join('');
  }

  private initialWords(value: string): string[] {
    const words = value.split(/\s+/).filter(Boolean);
    const filteredWords = words.filter(
      word => !IGNORED.has(this.normalizeNamePart(word))
    );

    return filteredWords.length ? filteredWords : words;
  }

  private normalizeNamePart(value: string): string {
    return (value.match(/[\p{L}\p{N}]/gu) || []).join('').toLocaleLowerCase();
  }

  private hash(value: string): number {
    return Array.from(value).reduce((hash, character) => {
      return (hash * 31 + (character.codePointAt(0) || 0)) >>> 0;
    }, 0);
  }
}
