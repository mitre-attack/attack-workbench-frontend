import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { defer, from, Observable, of } from 'rxjs';
import {
  catchError,
  concatMap,
  last,
  map,
  switchMap,
  toArray,
} from 'rxjs/operators';
import { StixObject } from 'src/app/classes/stix/stix-object';
import { Relationship } from 'src/app/classes/stix/relationship';
import { ConfirmationDialogComponent } from 'src/app/components/confirmation-dialog/confirmation-dialog.component';
import { MarkdownViewDialogComponent } from 'src/app/components/markdown-view-dialog/markdown-view-dialog.component';
import {
  DeprecationBlockers,
  DeprecationCheck,
  RestApiConnectorService,
} from '../connectors/rest-api/rest-api-connector.service';

interface LifecycleFailure {
  message?: string;
  blockers?: DeprecationBlockers;
  details?: { blockers?: DeprecationBlockers };
}

@Injectable({ providedIn: 'root' })
export class DeprecationService {
  constructor(
    private restApi: RestApiConnectorService,
    private dialog: MatDialog
  ) {}

  /** All entry points share the same orphan-first write ordering. */
  public deprecate(
    object: StixObject,
    alreadyConfirmed = false
  ): Observable<boolean> {
    return defer(() => {
      const wasDeprecated = object.deprecated;
      let retirementStarted = false;
      return this.restApi.getDeprecationCheck(object.stixID).pipe(
        switchMap(check => {
          this.requireNoEmbedded(check);
          const relationships = this.uniqueRelationships(check);
          const confirmation = alreadyConfirmed
            ? of(true)
            : this.dialog
                .open(ConfirmationDialogComponent, {
                  maxWidth: '35em',
                  autoFocus: false,
                  data: {
                    title: 'Deprecate object',
                    message: relationships.length
                      ? `Retire ${relationships.length} active relationship(s) before deprecating this object? Existing subtechnique-of and revoked-by relationships are preserved. Embedded references must be removed separately.`
                      : 'Deprecate this object?',
                    yes_label: 'Deprecate',
                    no_label: 'Cancel',
                  },
                })
                .afterClosed();
          return confirmation.pipe(
            switchMap(confirmed => {
              if (!confirmed) return of(false);
              // References can change while the confirmation dialog is open.
              return this.restApi.getDeprecationCheck(object.stixID).pipe(
                switchMap(fresh => {
                  this.requireNoEmbedded(fresh);
                  const current = this.uniqueRelationships(fresh);
                  if (
                    current.some(
                      rel =>
                        !relationships.some(
                          approved =>
                            approved.stix_id === rel.stix_id &&
                            approved.modified === rel.modified
                        )
                    )
                  ) {
                    throw this.blocked(
                      fresh,
                      'Relationships changed. Review the current blockers and try again.'
                    );
                  }
                  return from(current).pipe(
                    concatMap(blocker =>
                      this.restApi.getRelationship(blocker.stix_id).pipe(
                        switchMap(versions => {
                          const relationship = versions[0];
                          if (!relationship)
                            throw new Error(
                              `Could not load relationship ${blocker.stix_id}.`
                            );
                          if (relationship.deprecated || relationship.revoked)
                            return of(null);
                          if (
                            relationship.modified?.toISOString() !==
                            blocker.modified
                          ) {
                            throw new Error(
                              `Relationship ${blocker.stix_id} changed. Refresh and try again.`
                            );
                          }
                          retirementStarted = true;
                          relationship.deprecated = true;
                          // Retirement metadata and endpoint pins are owned by the API.
                          return this.restApi.postRelationship(relationship);
                        })
                      )
                    ),
                    toArray(),
                    switchMap(() =>
                      this.restApi.getDeprecationCheck(object.stixID)
                    ),
                    switchMap(finalCheck => {
                      // Older APIs may count preserved SROs in can_deprecate.
                      // Apply the same blocker policy used for confirmation and retirement.
                      if (
                        finalCheck.blockers.embedded.length ||
                        this.uniqueRelationships(finalCheck).length
                      ) {
                        throw this.blocked(
                          finalCheck,
                          'References changed before the final save.'
                        );
                      }
                      object.deprecated = true;
                      // Wait for every part of the save, not just its first emission.
                      const save: Observable<StixObject> =
                        object instanceof Relationship
                          ? this.restApi.postRelationship(object)
                          : object.save(this.restApi);
                      return save.pipe(
                        last(),
                        map(saved => {
                          object.modified = saved.modified;
                          return true;
                        })
                      );
                    })
                  );
                })
              );
            })
          );
        }),
        catchError(error => {
          object.deprecated = wasDeprecated;
          this.showError(error, retirementStarted);
          return of(false);
        })
      );
    });
  }

  public showError(
    error: LifecycleFailure & { error?: LifecycleFailure },
    retirementStarted = false
  ): void {
    const body = error?.error || error;
    const blockers: DeprecationBlockers =
      body?.blockers || body?.details?.blockers;
    const lines = [
      body?.message ||
        'The lifecycle change could not be completed. Refresh and try again.',
    ];
    if (blockers?.embedded?.length) {
      lines.push(
        'Remove or replace these embedded references on their **source objects**, save those changes, then try again. No dependent objects are automatically edited.'
      );
      for (const ref of blockers.embedded) {
        lines.push(
          `- **${ref.direction}**: \`${ref.source_ref}\` → \`${ref.target_ref}\`, field \`${ref.path}\``
        );
      }
    }
    const relationships = (blockers?.sros || []).filter(
      rel =>
        rel.relationship_type !== 'subtechnique-of' &&
        rel.relationship_type !== 'revoked-by'
    );
    if (relationships.length) {
      lines.push('Active relationships still block deprecation:');
      for (const rel of relationships) {
        lines.push(
          `- **${rel.direction} ${rel.relationship_type}**: \`${rel.stix_id}\``
        );
      }
    }
    if (retirementStarted) {
      lines.push(
        'Some relationships may already have been retired. Refresh before trying again; the object deprecation was not confirmed.'
      );
    }
    this.dialog.open(MarkdownViewDialogComponent, {
      maxWidth: '60em',
      maxHeight: '80vh',
      autoFocus: false,
      data: { title: 'Lifecycle change blocked', markdown: lines.join('\n\n') },
    });
  }

  private uniqueRelationships(check: DeprecationCheck) {
    return [
      ...new Map(
        check.blockers.sros
          .filter(
            rel =>
              rel.relationship_type !== 'subtechnique-of' &&
              rel.relationship_type !== 'revoked-by'
          )
          .map(rel => [rel.stix_id, rel])
      ).values(),
    ];
  }

  private requireNoEmbedded(check: DeprecationCheck): void {
    if (check.blockers.embedded.length) {
      throw this.blocked(
        check,
        'Embedded references must be removed before deprecation. No relationships were retired by this attempt.'
      );
    }
  }

  private blocked(check: DeprecationCheck, message: string) {
    return { ...check, message };
  }
}
