import { ViewEncapsulation } from '@angular/core';
import isEqual from 'lodash/isEqual';
import { ExternalReferences } from 'src/app/classes/external-references';
import { VersionNumber } from 'src/app/classes/version-number';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  OnDestroy,
  TemplateRef,
} from '@angular/core';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { RestApiConnectorService } from 'src/app/services/connectors/rest-api/rest-api-connector.service';
import { StixViewConfig } from 'src/app/views/stix/stix-view-page';

interface CustomTab {
  label: string;
  template: TemplateRef<any>;
  /** Object fields compared in this tab, available before its lazy content loads. */
  diffFields?: string[];
  /** Match the relationship table inside the tab without loading its lazy content. */
  relationshipQuery?: Parameters<RestApiConnectorService['getRelatedTo']>[0];
}

@Component({
  selector: 'app-stix-page-tabs',
  templateUrl: './stix-page-tabs.component.html',
  styleUrls: ['./stix-page-tabs.component.scss'],
  standalone: false,
  encapsulation: ViewEncapsulation.None,
})
export class StixPageTabsComponent implements OnChanges, OnDestroy {
  @Input() config!: StixViewConfig;
  @Input() detailsTemplate!: TemplateRef<any>;
  /** Label of the details tab; pages whose first tab is not a plain details view override it. */
  @Input() detailsLabel = 'Details';
  /** Only fields displayed inside Details belong here, excluding page metadata. */
  @Input() detailsFields: string[] = [];
  @Input() customTabs: CustomTab[] = [];
  @Input() showHistory = true;
  @Input() showNotes = true;
  @Input() showMembership = true;
  @Output() selectedIndexChange = new EventEmitter<number>();

  private relationshipChanges = new Set<string>();
  private relationshipRequest?: Subscription;
  private relationshipQueryKey = '';

  constructor(private restApi: RestApiConnectorService) {}

  ngOnChanges(): void {
    const baseline = this.config?.relationshipAddedAfter;
    const cutoff = this.config?.relationshipCreatedBefore;
    const tabs = this.customTabs.filter(tab => {
      const query = tab.relationshipQuery;
      return (
        query && (query.sourceRef || query.targetRef || query.sourceOrTargetRef)
      );
    });
    const key = JSON.stringify([
      this.config?.mode,
      baseline,
      cutoff,
      tabs.map(tab => [tab.label, tab.relationshipQuery]),
    ]);
    // Pages recreate config/tab objects during change detection. Fetch only when
    // the comparison or relationship filters actually change.
    if (key === this.relationshipQueryKey) return;
    this.relationshipQueryKey = key;
    this.relationshipRequest?.unsubscribe();
    this.relationshipChanges = new Set();
    const after = baseline ? new Date(baseline).getTime() : NaN;
    const before = cutoff ? new Date(cutoff).getTime() : Infinity;
    if (
      this.config?.mode !== 'diff' ||
      !Number.isFinite(after) ||
      Number.isNaN(before) ||
      !tabs.length
    )
      return;

    this.relationshipRequest = forkJoin(
      tabs.map(tab =>
        this.restApi
          .getRelatedTo({
            ...tab.relationshipQuery,
            versions: 'latest',
            limit: 0,
            offset: 0,
          })
          .pipe(
            map(result =>
              result.data.some(relationship => {
                const created = new Date(relationship.created).getTime();
                const modified = new Date(relationship.modified).getTime();
                // Use the same date boundaries as the relationship table's row markers.
                return (
                  Number.isFinite(created) &&
                  created <= before &&
                  (created > after ||
                    (created <= after &&
                      Number.isFinite(modified) &&
                      modified > after))
                );
              })
                ? tab.label
                : null
            ),
            catchError(() => of(null))
          )
      )
    ).subscribe(labels => {
      this.relationshipChanges = new Set(
        labels.filter((label): label is string => label !== null)
      );
    });
  }

  ngOnDestroy(): void {
    this.relationshipRequest?.unsubscribe();
  }

  public tabHasChanges(tab: CustomTab): boolean {
    return (
      this.hasChanges(tab.diffFields) || this.relationshipChanges.has(tab.label)
    );
  }

  public hasChanges(fields: string[] = []): boolean {
    if (this.config?.mode !== 'diff' || !Array.isArray(this.config.object)) {
      return false;
    }
    const [current, previous] = this.config.object;
    return fields.some(
      field =>
        !isEqual(
          this.comparisonValue(current?.[field], field),
          this.comparisonValue(previous?.[field], field)
        )
    );
  }

  private comparisonValue(value: unknown, field: string): unknown {
    // Alias diff components omit the primary name, which appears above the tabs.
    if (field === 'aliases' && Array.isArray(value)) value = value.slice(1);
    // Reference numbering and citation-validation state are presentation details.
    if (value instanceof ExternalReferences) {
      value = value
        .serialize()
        .sort((a, b) => a.source_name.localeCompare(b.source_name));
    }
    if (value instanceof VersionNumber) return value.toString();
    // Property diffs render missing strings and lists as empty values.
    if (value == null || (Array.isArray(value) && value.length === 0))
      return '';
    return value;
  }
}
