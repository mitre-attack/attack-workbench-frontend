export type RetirementStatus = 'revoked' | 'deprecated';
interface RuleIdentity {
  _id?: string;
  id?: string;
  autoCreated?: boolean;
  autoCreatedReason?: string | null;
  triggerEvent?: string | null;
  __v?: number;
}
export interface ErrorBypassRule extends RuleIdentity {
  kind?: 'error-bypass';
  fieldPath: string[];
  errorCode: string;
  stixType: string;
  suppressError: boolean;
  warningMessage?: string | null;
  name?: never;
  enabled?: never;
  retirementStatus?: never;
  stixTypes?: never;
}
export interface ObjectExemptionRule extends RuleIdentity {
  kind: 'object-exemption';
  name: string;
  enabled: boolean;
  retirementStatus: RetirementStatus;
  stixTypes: 'all' | string[];
  fieldPath?: never;
  errorCode?: never;
  stixType?: never;
  suppressError?: never;
  warningMessage?: never;
}
export type ValidationBypassRule = ErrorBypassRule | ObjectExemptionRule;
export interface ExemptionApplication {
  object_ref: string;
  object_modified: string | null;
  ruleId: string;
  ruleName: string;
  retirementStatus: RetirementStatus;
  phase: 'preflight' | 'evaluation';
}
export interface ExemptionReport {
  policyRevision?: number;
  state?: 'completed' | 'partial';
  evaluatedScope?: {
    revisions: number;
    byOutcome: Partial<
      Record<
        'valid' | 'invalid' | 'exempt' | 'disabled' | 'unsupported',
        number
      >
    >;
    preflightOnlyRevisions: number;
  };
  filters?: { statuses: RetirementStatus[]; ruleIds: string[] };
  reportedExemptRevisions?: number;
  ruleApplications?: number;
  byRule?: {
    ruleId: string;
    ruleName: string;
    retirementStatus: RetirementStatus;
    count: number;
  }[];
  byStatus?: { revoked: number; deprecated: number };
  availability?: 'retained' | 'unavailable';
  availabilityMessage?: string;
  reportId?: string | null;
  expiresAt?: string | null;
  details?: ExemptionApplication[];
  nextCursor?: string | null;
  hasMore?: boolean;
  truncated?: boolean;
}
export interface ExemptionReportQuery {
  statuses?: RetirementStatus[];
  ruleIds?: string[];
  limit?: number;
  cursor?: string;
}
export interface ReconciliationStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'superseded';
  policy_revision: number;
  generation: number;
  counts: Record<
    'scanned' | 'valid' | 'invalid' | 'exempt' | 'disabled' | 'unsupported',
    number
  >;
  progress: { processed: number; total: number | null };
  checkpoint: { collection: number; after: string | null } | null;
  last_error: string | { message?: string } | null;
  engine_context: {
    adm_version: string;
    attack_spec_version: string;
    evaluator_version: string;
  };
}

export interface ValidationIssue {
  path: (string | number)[];
  message: string;
  code?: string;
}
export interface ValidationPreviewResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  exemptionReport?: ExemptionReport;
}
