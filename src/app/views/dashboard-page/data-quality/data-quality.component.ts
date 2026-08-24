import { Component, OnInit, ViewEncapsulation, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { StixListConfig } from 'src/app/components/stix/stix-list/stix-list.component';
import { StixTypeToAttackType } from 'src/app/utils/type-mappings';
import { StixListComponent } from 'src/app/components/stix/stix-list/stix-list.component';
import { SelectionModel } from '@angular/cdk/collections';
import { forkJoin } from 'rxjs';
import { Relationship } from 'src/app/classes/stix/relationship';
import { ConfirmationDialogComponent } from 'src/app/components/confirmation-dialog/confirmation-dialog.component';

interface ParallelRelationshipGroup {
  key: string;
  sourceRef: string;
  targetRef: string;
  relationshipType: string;
  count: number;
  relationships: any[];
  stixObjects?: StixObject[];
  selectedRelationship: string;
  toDeprecate: string[];
  selection?: SelectionModel<string>;
}

@Component({
  selector: 'app-data-quality',
  templateUrl: './data-quality.component.html',
  styleUrls: ['./data-quality.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class DataQualityComponent implements OnInit {
  constructor(
    private reportService: RestApiConnectorService,
    private dialog: MatDialog
  ) {}

  missingLinks: any[] = [];
  missingLinkRows: { id: string; name: string }[] = [];
  loadingMissingLinks = false;
  error?: string;

  parallelRelationships: ParallelRelationshipGroup[] = [];
  loadingParallel = false;
  parallelError?: string;

  stixRelationshipConfig: StixListConfig = {
    type: 'relationship',
    stixObjects: [],
    clickBehavior: 'none',
    showFilters: false,
    showDeprecatedFilter: true,
    compactRelationshipColumns: true,
  };

  @ViewChild('relationshipList') relationshipList: StixListComponent;

  ngOnInit(): void {
    this.loadParallelRelationships();
    this.loadMissingLinks();
  }

  private transformParallelRelationships(
    raw: Record<string, any[]>
  ): ParallelRelationshipGroup[] {
    return Object.entries(raw).map(([key, relationships]) => {
      const byNewest = [...relationships].sort((a, b) => {
        const ac = a.stix?.created;
        const bc = b.stix?.created;
        return bc - ac;
      });
      const selectedRelationship =
        byNewest[0].stix.id ?? relationships[0].stix.id;
      const toDeprecate = relationships
        .map(r => r.stix.id)
        .filter(id => id !== selectedRelationship);
      const selection = new SelectionModel<string>(false);
      if (selectedRelationship) selection.toggle(selectedRelationship);

      const first = relationships[0].stix;
      return {
        key,
        sourceRef: first?.source_ref,
        targetRef: first?.target_ref,
        relationshipType: first?.relationship_type,
        count: relationships.length,
        relationships,
        selectedRelationship,
        toDeprecate,
        selection,
      };
    });
  }

  // Build a link to the workbench object page using STIX->ATT&CK mapping
  objectLink(item: any): any[] {
    const id = item.stix.id;
    const stixType = item.stix.type as keyof typeof StixTypeToAttackType;
    const attackType = StixTypeToAttackType[stixType];
    return ['/', attackType, id];
  }

  loadMissingLinks(): void {
    this.loadingMissingLinks = true;
    this.reportService.getMissingLinkById().subscribe({
      next: data => {
        // update later to also display relationship missing link by ids
        this.missingLinks = Array.isArray(data)
          ? data.filter(item => {
              const type = item.stix.type;
              return type !== 'relationship';
            })
          : [];
        this.missingLinkRows = this.buildMissingLinkRows();
        this.loadingMissingLinks = false;
      },
      error: err => {
        this.error = 'Failed to load report';
        this.loadingMissingLinks = false;
        console.error(err);
      },
    });
  }

  loadParallelRelationships(): void {
    this.loadingParallel = true;

    this.reportService.getParallelRelationships().subscribe({
      next: rawData => {
        this.parallelRelationships =
          this.transformParallelRelationships(rawData);

        this.parallelRelationships.forEach(group => {
          group.stixObjects = this.buildStixObjectsForGroup(group);
        });
        this.loadingParallel = false;
        this.parallelError = undefined;
      },
      error: err => {
        this.parallelError = 'Failed to load parallel relationships report';
        this.loadingParallel = false;
        console.error(err);
      },
    });
  }

  // Build a StixList-compatible array for a given group
  buildStixObjectsForGroup(group: ParallelRelationshipGroup): StixObject[] {
    if (!group || !Array.isArray(group.relationships)) return [] as any;
    return group.relationships.map(r => this.mapRelationshipToRow(r)) as any;
  }

  // Use existing config and override only the stixObjects and hide controls in panels
  stixConfigForGroup(group: ParallelRelationshipGroup): StixListConfig {
    return {
      ...this.stixRelationshipConfig,
      stixObjects: group.stixObjects || this.buildStixObjectsForGroup(group),
      showControls: false,
      select: 'one',
      selectionModel: group.selection,
    };
  }

  // Build stix objects for missing links
  buildMissingLinkObjects(): StixObject[] {
    return (this.missingLinks || []).map(item => {
      const s = item?.stix || item;
      return {
        stixID: s.id,
        attackType: StixTypeToAttackType[s.type],
        type: s.type,
        attackID: s.external_references?.[0]?.external_id || '',
        name: s.name || s.external_references?.[0]?.external_id || s.id,
      } as any;
    });
  }

  // Use stix-list for missing links with a 2 columns - id and name
  stixConfigForMissingLinks(): StixListConfig {
    return {
      type: 'relationship', // use relationship so stix-list table styling matches
      stixObjects: this.buildMissingLinkObjects(),
      columnsPreset: 'id-name',
      showControls: false,
      showFilters: false,
      showDeprecatedFilter: false,
      clickBehavior: 'linkToObjectPage',
    };
  }

  private mapRelationshipToRow(r: any): StixObject {
    const stix = r.stix;
    return {
      stixID: stix.id,
      type: 'relationship',
      source_ref: stix.source_ref || '',
      target_ref: stix.target_ref || '',
      source_name: r.source_object.stix.name || '',
      target_name: r.target_object.stix.name || '',
      source_ID: r.source_object.stix.external_references[0].external_id || '',
      target_ID: r.target_object.stix.external_references[0].external_id || '',
      relationship_type: stix.relationship_type,
      description: stix.description || '',
      created: stix.created || undefined,
      modified: stix.modified || undefined,
      revoked: r?.revoked,
      deprecated: r?.x_mitre_deprecated,
    } as any;
  }
  // Build rows for missing links table and display id and name
  buildMissingLinkRows(): { id: string; name: string }[] {
    return (this.missingLinks || []).map(item => {
      const id =
        item?.stix.external_references?.[0]?.external_id || item?.stix.id || '';
      const name = item?.stix.name || '';
      return { id, name };
    });
  }

  // Handle selection change from stix-list radios
  onGroupSelect(element: StixObject, group: ParallelRelationshipGroup): void {
    if (!group || !group.selection) return;
    const stixId = element.stixID;
    if (!stixId) return;
    group.selection.clear();
    group.selection.select(stixId);
    group.selectedRelationship = stixId;
    group.toDeprecate = group.relationships
      .map(r => r.stix.id)
      .filter(id => id && id !== group.selectedRelationship);
    group.stixObjects = this.buildStixObjectsForGroup(group);
  }

  // Deprecate non-selected relationships for a group
  deprecateOthers(group: ParallelRelationshipGroup): void {
    if (!group || !group.toDeprecate?.length) return;

    const confirmationPrompt = this.dialog.open(ConfirmationDialogComponent, {
      maxWidth: '35em',
      data: {
        message:
          'All selected relationships in this group will be deprecated. Do you want to continue?',
      },
      autoFocus: false, // prevents auto focus on toolbar buttons
    });

    const confirmationSub = confirmationPrompt.afterClosed().subscribe({
      next: result => {
        if (!result) return; // user cancelled

        const tasks = group.relationships
          .filter(
            r =>
              r.stix.id !== group.selectedRelationship &&
              !r?.x_mitre_deprecated &&
              !['subtechnique-of', 'revoked-by'].includes(
                r.stix?.relationship_type
              )
          )
          .map(r => {
            const rel = new Relationship(r);
            rel.deprecated = true;
            return this.reportService.putRelationship(rel);
          });

        const sub = forkJoin(tasks).subscribe({
          next: () => {
            group.relationships = group.relationships.filter(
              r => r.stix?.id === group.selectedRelationship
            );
            group.toDeprecate = [];
            group.stixObjects = this.buildStixObjectsForGroup(group);
            window.location.reload();
          },
          error: err => {
            console.error(err);
          },
          complete: () => sub.unsubscribe(),
        });
      },
      complete: () => confirmationSub.unsubscribe(),
    });
  }
}
