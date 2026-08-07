import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  ViewEncapsulation,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ReleaseTracksConnectorService } from 'src/app/services/connectors/rest-api/release-tracks.service';
import { ReleaseTrackType } from 'src/app/classes/release-tracks';
import { MatDialog } from '@angular/material/dialog';
import { NewTrackDialogComponent } from 'src/app/components/new-track-dialog/new-track-dialog.component';
import { MultipleChoiceDialogComponent } from 'src/app/components/multiple-choice-dialog/multiple-choice-dialog.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-release-tracks-list',
  templateUrl: './release-management.component.html',
  styleUrls: ['./release-management.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class ReleaseManagementComponent implements OnInit, OnDestroy {
  @Output() viewTrack = new EventEmitter<string>();

  public filter: 'all' | 'Standard' | 'Virtual' = 'all';
  public allTracks: any[] = [];

  private subscription: Subscription | null = null;

  public get standardTracks(): any[] {
    return this.allTracks.filter(
      t => t.type === ReleaseTrackType.Standard || t.type === 'standard'
    );
  }

  public get virtualTracks(): any[] {
    return this.allTracks.filter(
      t => t.type === ReleaseTrackType.Virtual || t.type === 'virtual'
    );
  }

  constructor(
    private connector: ReleaseTracksConnectorService,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadTracks();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private loadTracks(): void {
    this.subscription = this.connector.listReleaseTracks().subscribe(result => {
      this.allTracks = this.tracksWithComputedData(result?.data ?? []);
    });
  }

  public setFilter(value: 'all' | 'Standard' | 'Virtual'): void {
    this.filter = value;
  }

  public onViewTrack(id: string): void {
    this.router.navigate([`/dashboard/release-management/${id}`]);
  }

  private tracksWithComputedData(data: any[]): any[] {
    return data.map((track: any) => {
      const summary = track.summary ?? {};

      return {
        ...track,
        latestVersion: track.latest_tagged_version ?? 'No tagged releases',
        latestModified: track.latest_snapshot_modified,
        stats: {
          candidates: summary.candidates_count ?? 0,
          staged: summary.staged_count ?? 0,
          members: summary.members_count ?? 0,
          quarantined: 0,
        },
      };
    });
  }

  public openNewTrackDialog(): void {
    const choiceRef = this.dialog.open(MultipleChoiceDialogComponent, {
      width: '30em',
      autoFocus: false,
      data: {
        title: 'Create a new track',
        choices: [
          {
            label: 'Standard',
            description:
              'Recommended for most cases. Traditional release track that directly manages objects through the candidate, staged, and released workflow.',
          },
          {
            label: 'Virtual',
            description:
              'Composite release track made up of standard tracks, used to build releases from multiple source tracks.',
          },
        ],
      },
    });

    choiceRef.afterClosed().subscribe(choice => {
      if (!choice) return;
      const selectedType =
        String(choice).toLowerCase() === 'virtual'
          ? ReleaseTrackType.Virtual
          : ReleaseTrackType.Standard;

      const dialogRef = this.dialog.open(NewTrackDialogComponent, {
        width: '50em',
        autoFocus: false,
        data: {
          type: selectedType,
        },
      });

      dialogRef.afterClosed().subscribe(result => {
        if (!result) return;
        const createdId = result?.id || result?.track_id || null;
        if (createdId) this.viewTrack.emit(createdId);
        this.loadTracks();
      });
    });
  }
}
