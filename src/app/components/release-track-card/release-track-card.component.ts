import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkbenchChipComponent } from '../workbench-chip/workbench-chip.component';

@Component({
  selector: 'app-release-track-card',
  standalone: true,
  imports: [
    CommonModule,
    MatDividerModule,
    MatIconModule,
    MatTooltipModule,
    WorkbenchChipComponent,
  ],
  templateUrl: './release-track-card.component.html',
  styleUrls: ['./release-track-card.component.scss'],
})
export class ReleaseTrackCardComponent {
  @Input() track: any = {};
  @Input() type: 'standard' | 'virtual' | null = null;
  @Output() viewTrack = new EventEmitter<string>();

  public get chipVariant(): 'standard' | 'virtual' {
    return this.type === 'virtual' ? 'virtual' : 'standard';
  }

  public onViewTrack(): void {
    const id = this.track?.id || this.track?.track_id || null;
    if (id) this.viewTrack.emit(id);
  }
}
