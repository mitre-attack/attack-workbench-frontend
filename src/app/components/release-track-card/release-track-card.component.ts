import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-release-track-card',
  standalone: true,
  imports: [
    CommonModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './release-track-card.component.html',
  styleUrls: ['./release-track-card.component.scss'],
})
export class ReleaseTrackCardComponent {
  @Input() track: any = {};
  @Input() type: 'standard' | 'virtual' | null = null;
  @Output() viewTrack = new EventEmitter<string>();

  public onViewTrack(): void {
    const id = this.track?.id || this.track?.track_id || null;
    if (id) this.viewTrack.emit(id);
  }
}
