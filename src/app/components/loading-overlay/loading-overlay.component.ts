import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';

export interface PhaseProgress {
  phase: string;
  label: string;
  progress: number;
  active: boolean;
}

@Component({
  selector: 'app-loading-overlay',
  templateUrl: './loading-overlay.component.html',
  styleUrls: ['./loading-overlay.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class LoadingOverlayComponent implements OnInit {
  @Input() message = '';
  @Input() showProgress = false;
  @Input() progress = 0; // 0-100 (single progress bar)
  @Input() phaseProgress: PhaseProgress[] = []; // Multiple progress bars

  constructor() {
    // intentionally left blank
  }

  ngOnInit() {
    // intentionally left blank
  }
}
