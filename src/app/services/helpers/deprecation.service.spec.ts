import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Technique } from 'src/app/classes/stix/technique';
import { Relationship } from 'src/app/classes/stix/relationship';
import { MarkdownViewDialogComponent } from 'src/app/components/markdown-view-dialog/markdown-view-dialog.component';
import {
  DeprecationCheck,
  RestApiConnectorService,
} from '../connectors/rest-api/rest-api-connector.service';
import { DeprecationService } from './deprecation.service';

describe('DeprecationService', () => {
  let service: DeprecationService;
  let object: Technique;
  const api = {
    getDeprecationCheck: vi.fn(),
    getRelationship: vi.fn(),
    postRelationship: vi.fn(),
  };
  const dialog = { open: vi.fn() };

  function check(): DeprecationCheck {
    return {
      stix_id: object.stixID,
      can_deprecate: true,
      blockers: { sros: [], embedded: [] },
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        DeprecationService,
        { provide: RestApiConnectorService, useValue: api },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    service = TestBed.inject(DeprecationService);
    object = new Technique();
    vi.spyOn(object, 'save').mockReturnValue(of(object));
    api.getDeprecationCheck.mockImplementation(() => of(check()));
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
  });

  it('blocks embedded references before confirmation or any write', () => {
    const blocked = check();
    blocked.can_deprecate = false;
    blocked.blockers.embedded.push({
      source_ref: 'x-mitre-analytic--source',
      target_ref: object.stixID,
      path: 'x_mitre_log_source_references[0].x_mitre_data_component_ref',
      direction: 'inbound',
    });
    blocked.blockers.sros = ['subtechnique-of', 'revoked-by'].map(type => ({
      stix_id: `relationship--${type}`,
      modified: '2026-01-01T00:00:00.000Z',
      relationship_type: type,
      direction: 'outbound',
    }));
    api.getDeprecationCheck.mockReturnValue(of(blocked));
    const results: boolean[] = [];
    service.deprecate(object).subscribe(result => results.push(result));
    expect(results).toEqual([false]);
    expect(object.save).not.toHaveBeenCalled();
    expect(api.getRelationship).not.toHaveBeenCalled();
    expect(dialog.open).toHaveBeenCalledWith(
      MarkdownViewDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          markdown: expect.stringContaining('x_mitre_log_source_references[0]'),
        }),
      })
    );
    expect(object.deprecated).toBe(false);
  });

  it('waits for ordinary SRO retirements in order and preserves hierarchy and replacement SROs', () => {
    const first = new Relationship();
    first.modified = new Date('2026-01-01T00:00:00.000Z');
    first.relationship_type = 'uses';
    const second = new Relationship();
    second.modified = first.modified;
    second.relationship_type = 'mitigates';
    const pending = new Subject<Relationship>();
    api.postRelationship.mockImplementation((relationship: Relationship) =>
      relationship === first ? pending : of(second)
    );
    const initial = check();
    initial.can_deprecate = false;
    initial.blockers.sros = [first, second].map(rel => ({
      stix_id: rel.stixID,
      modified: rel.modified.toISOString(),
      relationship_type: rel.relationship_type,
      direction: 'inbound',
    }));
    const preserved = check();
    // Older APIs incorrectly report these as blockers at every check.
    preserved.can_deprecate = false;
    preserved.blockers.sros = ['subtechnique-of', 'revoked-by'].map(type => ({
      stix_id: `relationship--${type}`,
      modified: first.modified.toISOString(),
      relationship_type: type,
      direction: 'outbound',
    }));
    initial.blockers.sros.push(...preserved.blockers.sros);
    // Duplicate inbound/outbound entries must still retire an SRO only once.
    initial.blockers.sros.push(initial.blockers.sros[0]);
    api.getDeprecationCheck
      .mockReturnValueOnce(of(initial))
      .mockReturnValueOnce(of(initial))
      .mockReturnValueOnce(of(preserved));
    api.getRelationship.mockImplementation((id: string) =>
      of([id === first.stixID ? first : second])
    );
    const results: boolean[] = [];
    service.deprecate(object).subscribe(result => results.push(result));
    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          message: expect.stringContaining('Retire 2 active relationship(s)'),
        }),
      })
    );
    pending.next(first);
    expect(object.save).not.toHaveBeenCalled();
    expect(api.postRelationship).toHaveBeenCalledTimes(1);
    pending.complete();
    expect(api.postRelationship).toHaveBeenCalledTimes(2);
    expect(api.postRelationship).toHaveBeenNthCalledWith(1, first);
    expect(api.postRelationship).toHaveBeenNthCalledWith(2, second);
    expect(first.deprecated).toBe(true);
    expect(second.deprecated).toBe(true);
    expect(api.getRelationship).toHaveBeenCalledTimes(2);
    expect(object.save).toHaveBeenCalledTimes(1);
    expect(results).toEqual([true]);
  });

  for (const relationshipType of ['subtechnique-of', 'revoked-by']) {
    for (const direction of ['inbound', 'outbound'] as const) {
      it(`preserves ${direction} ${relationshipType} reported by an older API`, () => {
        const initial = check();
        initial.can_deprecate = false;
        initial.blockers.sros.push({
          stix_id: 'relationship--preserved',
          modified: '2026-01-01T00:00:00.000Z',
          relationship_type: relationshipType,
          direction,
        });
        api.getDeprecationCheck.mockReturnValue(of(initial));
        const results: boolean[] = [];
        service.deprecate(object).subscribe(result => results.push(result));
        expect(results).toEqual([true]);
        expect(api.getRelationship).not.toHaveBeenCalled();
        expect(api.postRelationship).not.toHaveBeenCalled();
        expect(object.save).toHaveBeenCalledTimes(1);
        expect(api.getDeprecationCheck).toHaveBeenCalledTimes(3);
        expect(dialog.open).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({
              message: 'Deprecate this object?',
            }),
          })
        );
      });
    }
  }

  it('does not save the object after an SRO retirement failure', () => {
    const relationship = new Relationship();
    relationship.modified = new Date('2026-01-01T00:00:00.000Z');
    api.postRelationship.mockReturnValue(
      throwError(() => new Error('Retirement failed'))
    );
    const initial = check();
    initial.can_deprecate = false;
    initial.blockers.sros.push({
      stix_id: relationship.stixID,
      modified: relationship.modified.toISOString(),
      relationship_type: 'uses',
      direction: 'outbound',
    });
    api.getDeprecationCheck.mockReturnValue(of(initial));
    api.getRelationship.mockReturnValue(of([relationship]));
    service.deprecate(object).subscribe();
    expect(object.save).not.toHaveBeenCalled();
    expect(object.deprecated).toBe(false);
    expect(dialog.open).toHaveBeenLastCalledWith(
      MarkdownViewDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          markdown: expect.stringContaining('Retirement failed'),
        }),
      })
    );
  });

  it('stops when embedded references appear during confirmation', () => {
    const changed = check();
    changed.can_deprecate = false;
    changed.blockers.embedded.push({
      source_ref: object.stixID,
      target_ref: 'x-mitre-analytic--target',
      path: 'x_mitre_analytic_refs[0]',
      direction: 'outbound',
    });
    api.getDeprecationCheck
      .mockReturnValueOnce(of(check()))
      .mockReturnValueOnce(of(changed));
    service.deprecate(object).subscribe();
    expect(object.save).not.toHaveBeenCalled();
    expect(api.getRelationship).not.toHaveBeenCalled();
  });

  it('stops when the final authoritative check finds a new SRO', () => {
    const changed = check();
    changed.can_deprecate = false;
    changed.blockers.sros.push({
      stix_id: 'relationship--new',
      modified: '2026-01-01T00:00:00.000Z',
      relationship_type: 'uses',
      direction: 'outbound',
    });
    changed.blockers.sros.push({
      stix_id: 'relationship--preserved',
      modified: '2026-01-01T00:00:00.000Z',
      relationship_type: 'subtechnique-of',
      direction: 'inbound',
    });
    api.getDeprecationCheck
      .mockReturnValueOnce(of(check()))
      .mockReturnValueOnce(of(check()))
      .mockReturnValueOnce(of(changed));
    service.deprecate(object).subscribe();
    expect(object.save).not.toHaveBeenCalled();
    expect(object.deprecated).toBe(false);
  });

  it('still blocks new embedded references at the final check alongside preserved SROs', () => {
    const initial = check();
    initial.can_deprecate = false;
    initial.blockers.sros.push({
      stix_id: 'relationship--preserved',
      modified: '2026-01-01T00:00:00.000Z',
      relationship_type: 'revoked-by',
      direction: 'inbound',
    });
    const changed: DeprecationCheck = {
      ...initial,
      blockers: {
        sros: initial.blockers.sros,
        embedded: [
          {
            source_ref: 'x-mitre-matrix--source',
            target_ref: object.stixID,
            path: 'tactic_refs[0]',
            direction: 'inbound',
          },
        ],
      },
    };
    api.getDeprecationCheck
      .mockReturnValueOnce(of(initial))
      .mockReturnValueOnce(of(initial))
      .mockReturnValueOnce(of(changed));
    const results: boolean[] = [];
    service.deprecate(object).subscribe(result => results.push(result));
    expect(results).toEqual([false]);
    expect(object.save).not.toHaveBeenCalled();
    expect(api.getRelationship).not.toHaveBeenCalled();
    expect(api.postRelationship).not.toHaveBeenCalled();
    expect(object.deprecated).toBe(false);
  });

  it('surfaces final-write 409 blockers and restores the local status', () => {
    vi.mocked(object.save).mockReturnValue(
      throwError(() => ({
        status: 409,
        error: {
          message: 'New references block deprecation',
          code: 'deprecation_blocked',
          blockers: {
            sros: [],
            embedded: [
              {
                source_ref: 'x-mitre-matrix--source',
                target_ref: object.stixID,
                path: 'tactic_refs[0]',
                direction: 'inbound',
              },
            ],
          },
        },
      }))
    );
    const results: boolean[] = [];
    service.deprecate(object).subscribe(result => results.push(result));
    expect(results).toEqual([false]);
    expect(object.deprecated).toBe(false);
    expect(dialog.open).toHaveBeenLastCalledWith(
      MarkdownViewDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          markdown: expect.stringContaining('tactic_refs[0]'),
        }),
      })
    );
  });

  it('does not write when confirmation is cancelled', () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });
    service.deprecate(object).subscribe();
    expect(object.save).not.toHaveBeenCalled();
    expect(api.getDeprecationCheck).toHaveBeenCalledTimes(1);
  });

  for (const relationshipType of ['uses', 'subtechnique-of', 'revoked-by']) {
    it(`explicitly retires a ${relationshipType} SRO without frontend endpoint metadata edits`, () => {
      const relationship = new Relationship();
      relationship.relationship_type = relationshipType;
      relationship.source_ref = 'attack-pattern--inactive-source';
      relationship.target_ref = 'attack-pattern--inactive-target';
      const modelSave = vi.spyOn(relationship, 'save');
      api.postRelationship.mockReturnValue(of(relationship));
      const results: boolean[] = [];
      service.deprecate(relationship).subscribe(result => results.push(result));
      expect(api.postRelationship).toHaveBeenCalledWith(relationship);
      expect(modelSave).not.toHaveBeenCalled();
      expect(relationship.deprecated).toBe(true);
      expect(results).toEqual([true]);
    });
  }
});
