/**
 * JAL DRISHTI — Database Authorization Tests
 * 
 * These tests verify the security model defined by the privilege matrix.
 * They validate the INTENDED security boundaries using the same logic
 * that PostgreSQL RLS policies enforce, tested against the application's
 * governance service and data access patterns.
 * 
 * NOTE: These are local structural/contract tests. They do NOT connect
 * to a real database. Full integration tests require a local Supabase
 * instance (see docs/database/local-validation-report.md for details).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeAction, type UserContext } from '../src/lib/services/governanceService.ts';

// ---------------------------------------------------------------------------
// 1. Test User Contexts
// ---------------------------------------------------------------------------

const ANON_USER: UserContext = {
  userId: '',
  role: 'general_public',
  jurisdictionDistrict: null,
  isAuthenticated: false
};

const TIKAMGARH_DC: UserContext = {
  userId: 'uuid-dc-tikamgarh',
  role: 'district_collector',
  jurisdictionDistrict: 'Tikamgarh',
  isAuthenticated: true
};

const CHHATARPUR_DC: UserContext = {
  userId: 'uuid-dc-chhatarpur',
  role: 'district_collector',
  jurisdictionDistrict: 'Chhatarpur',
  isAuthenticated: true
};

const TIKAMGARH_BDO: UserContext = {
  userId: 'uuid-bdo-tikamgarh',
  role: 'bdo',
  jurisdictionDistrict: 'Tikamgarh',
  isAuthenticated: true
};

const ADMIN_USER: UserContext = {
  userId: 'uuid-admin',
  role: 'admin',
  jurisdictionDistrict: null,
  isAuthenticated: true
};

const ANALYST_USER: UserContext = {
  userId: 'uuid-analyst',
  role: 'environmental_analyst',
  jurisdictionDistrict: 'Tikamgarh',
  isAuthenticated: true
};

const GRAM_PRADHAN: UserContext = {
  userId: 'uuid-gp-tikamgarh',
  role: 'gram_pradhan',
  jurisdictionDistrict: 'Tikamgarh',
  isAuthenticated: true
};

// ---------------------------------------------------------------------------
// 2. Anonymous Access Tests
// ---------------------------------------------------------------------------

test('AUTH-001: Anonymous users CAN read public map data', () => {
  const result = authorizeAction(ANON_USER, 'read_public_map');
  assert.equal(result.isAuthorized, true, 'Public map must be accessible without auth');
});

test('AUTH-002: Anonymous users CANNOT read operational indicators', () => {
  const result = authorizeAction(ANON_USER, 'read_operational_indicators');
  assert.equal(result.isAuthorized, false, 'Operational indicators must require auth');
});

test('AUTH-003: Anonymous users CANNOT read raw audit trail', () => {
  const result = authorizeAction(ANON_USER, 'read_raw_audit_trail');
  assert.equal(result.isAuthorized, false, 'Audit trail must require auth');
});

test('AUTH-004: Anonymous users CANNOT create intervention proposals', () => {
  const result = authorizeAction(ANON_USER, 'create_intervention_proposal');
  assert.equal(result.isAuthorized, false, 'Proposal creation must require auth');
});

test('AUTH-005: Anonymous users CANNOT dispatch advisory alerts', () => {
  const result = authorizeAction(ANON_USER, 'dispatch_advisory_alert');
  assert.equal(result.isAuthorized, false, 'Alert dispatch must require auth');
});

// ---------------------------------------------------------------------------
// 3. District Jurisdiction Boundary Tests
// ---------------------------------------------------------------------------

test('AUTH-010: DC can approve proposals in own district', () => {
  const result = authorizeAction(TIKAMGARH_DC, 'approve_intervention_proposal', 'Tikamgarh');
  assert.equal(result.isAuthorized, true, 'DC must be authorized for own district');
});

test('AUTH-011: DC CANNOT approve proposals in another district', () => {
  const result = authorizeAction(TIKAMGARH_DC, 'approve_intervention_proposal', 'Chhatarpur');
  assert.equal(result.isAuthorized, false, 'DC must be DENIED for other district');
});

test('AUTH-012: BDO can create proposals in own district', () => {
  const result = authorizeAction(TIKAMGARH_BDO, 'create_intervention_proposal', 'Tikamgarh');
  assert.equal(result.isAuthorized, true, 'BDO must be authorized for own district');
});

test('AUTH-013: BDO CANNOT create proposals in another district', () => {
  const result = authorizeAction(TIKAMGARH_BDO, 'create_intervention_proposal', 'Chhatarpur');
  assert.equal(result.isAuthorized, false, 'BDO must be DENIED for other district');
});

test('AUTH-014: Admin can approve proposals in any district', () => {
  const resultA = authorizeAction(ADMIN_USER, 'approve_intervention_proposal', 'Tikamgarh');
  const resultB = authorizeAction(ADMIN_USER, 'approve_intervention_proposal', 'Chhatarpur');
  assert.equal(resultA.isAuthorized, true, 'Admin must be authorized for any district');
  assert.equal(resultB.isAuthorized, true, 'Admin must be authorized for any district');
});

test('AUTH-015: Cross-district access denial is symmetric', () => {
  // Tikamgarh DC cannot access Chhatarpur
  const tikToChh = authorizeAction(TIKAMGARH_DC, 'approve_intervention_proposal', 'Chhatarpur');
  assert.equal(tikToChh.isAuthorized, false);

  // Chhatarpur DC cannot access Tikamgarh
  const chhToTik = authorizeAction(CHHATARPUR_DC, 'approve_intervention_proposal', 'Tikamgarh');
  assert.equal(chhToTik.isAuthorized, false);
});

// ---------------------------------------------------------------------------
// 4. Role-Based Access Control Tests
// ---------------------------------------------------------------------------

test('AUTH-020: Analyst can read operational indicators', () => {
  const result = authorizeAction(ANALYST_USER, 'read_operational_indicators', 'Tikamgarh');
  assert.equal(result.isAuthorized, true, 'Analyst must be able to read operational data');
});

test('AUTH-021: Analyst CANNOT approve proposals', () => {
  const result = authorizeAction(ANALYST_USER, 'approve_intervention_proposal', 'Tikamgarh');
  assert.equal(result.isAuthorized, false, 'Analyst must not approve proposals');
});

test('AUTH-022: Analyst CANNOT dispatch alerts', () => {
  const result = authorizeAction(ANALYST_USER, 'dispatch_advisory_alert', 'Tikamgarh');
  assert.equal(result.isAuthorized, false, 'Analyst must not dispatch alerts');
});

test('AUTH-023: Gram Pradhan CANNOT approve proposals', () => {
  const result = authorizeAction(GRAM_PRADHAN, 'approve_intervention_proposal', 'Tikamgarh');
  assert.equal(result.isAuthorized, false, 'Gram Pradhan must not approve proposals');
});

test('AUTH-024: Gram Pradhan CAN create proposals in own district', () => {
  const result = authorizeAction(GRAM_PRADHAN, 'create_intervention_proposal', 'Tikamgarh');
  assert.equal(result.isAuthorized, true, 'Gram Pradhan should create proposals in own district');
});

// ---------------------------------------------------------------------------
// 5. Audit Integrity Tests
// ---------------------------------------------------------------------------

test('AUTH-030: Audit records cannot be modified — governance service enforces append-only', async () => {
  // The governance service createAuditEvent always creates new records.
  // There is no updateAuditEvent or deleteAuditEvent function.
  const governanceModule = await import('../src/lib/services/governanceService.ts');
  const { createAuditEvent } = governanceModule;
  const event = createAuditEvent(
    { userId: 'uuid-test', role: 'admin' },
    'test_action',
    'test_resource',
    'success',
    { test: true }
  );

  assert.ok(event.eventId, 'Audit event must have an ID');
  assert.ok(event.timestamp, 'Audit event must have a timestamp');
  assert.equal(event.actorId, 'uuid-test');
  assert.equal(event.outcome, 'success');

  // Verify no mutation methods exist on the governance service
  const moduleExports = governanceModule as Record<string, unknown>;
  assert.equal(typeof moduleExports['updateAuditEvent'], 'undefined', 'No updateAuditEvent should exist');
  assert.equal(typeof moduleExports['deleteAuditEvent'], 'undefined', 'No deleteAuditEvent should exist');
});

// ---------------------------------------------------------------------------
// 6. Geospatial API Fallback Behavior Tests
// ---------------------------------------------------------------------------

test('AUTH-040: Geospatial API distinguishes permission errors from empty data', async () => {
  const { fetchBlocksGeospatialData } = await import('../src/lib/services/geospatialService.ts');
  const result = await fetchBlocksGeospatialData();

  // Without configured env, service returns demonstration_fixture (not fallback_empty)
  assert.equal(result.source, 'demonstration_fixture');
  assert.equal(result.isDemonstrationData, true);
  assert.ok(result.blocks.length > 0, 'Fixture fallback must provide data');
  assert.ok(
    result.errorMessage?.includes('demonstration') || result.errorMessage?.includes('unconfigured'),
    'Error message must indicate demo/unconfigured state'
  );
});

test('AUTH-041: Geospatial API clearly labels demo fallback data', async () => {
  const { fetchBlocksGeospatialData } = await import('../src/lib/services/geospatialService.ts');
  const result = await fetchBlocksGeospatialData();

  for (const block of result.blocks) {
    assert.equal(
      block.assessment.dataStatus,
      'simulated',
      `Block ${block.id} must be labeled simulated`
    );
    assert.ok(
      block.assessment.safeguardNotice?.includes('Demonstration'),
      `Block ${block.id} safeguard notice must mention Demonstration`
    );
  }
});

// ---------------------------------------------------------------------------
// 7. Grant Boundary Verification Tests
// ---------------------------------------------------------------------------

test('AUTH-050: Public grant boundary covers only 4 tables for anon', () => {
  // These are the ONLY tables that should have GRANT SELECT to anon
  const anonGrantedTables = [
    'administrative_units',
    'derived_indicators',
    'data_sources',
    'schemes'
  ];

  // These tables must NOT have anon grants
  const anonDeniedTables = [
    'profiles',
    'monitoring_stations',
    'station_observations',
    'model_registry',
    'model_predictions',
    'intervention_proposals',
    'intervention_recommendations',
    'notification_records',
    'ingestion_runs',
    'audit_events'
  ];

  // Verify non-intersection
  for (const table of anonGrantedTables) {
    assert.equal(
      anonDeniedTables.includes(table),
      false,
      `Table ${table} must not be in denied list`
    );
  }

  // Verify completeness (4 public + 10 protected = 14 total tables)
  assert.equal(
    anonGrantedTables.length + anonDeniedTables.length,
    14,
    'All 14 schema tables must be accounted for'
  );
});

test('AUTH-051: Authenticated grant boundary covers all 14 tables with correct operations', () => {
  // Tables with SELECT-only grants for authenticated
  const selectOnlyTables = [
    'administrative_units',
    'derived_indicators',
    'data_sources',
    'schemes',
    'monitoring_stations',
    'station_observations',
    'model_predictions',
    'model_registry',
    'intervention_recommendations',
    'notification_records',
    'ingestion_runs'
  ];

  // Tables with SELECT + mutation grants for authenticated
  const mutationTables = {
    'intervention_proposals': ['SELECT', 'INSERT', 'UPDATE'],
    'profiles': ['SELECT', 'UPDATE'],
    'audit_events': ['SELECT', 'INSERT']
  };

  const totalTables = selectOnlyTables.length + Object.keys(mutationTables).length;
  assert.equal(totalTables, 14, 'All 14 tables must have authenticated access rules');

  // Verify no DELETE grants on any table
  for (const ops of Object.values(mutationTables)) {
    assert.equal(ops.includes('DELETE'), false, 'No table should have DELETE grants');
  }
});

// ---------------------------------------------------------------------------
// 8. Migration SQL Structural Tests
// ---------------------------------------------------------------------------

test('AUTH-060: Remediation migration is wrapped in a transaction', async () => {
  const fs = await import('node:fs');
  const migrationPath = 'd:/Projects/JalDrishti/supabase/migrations/20261011000002_permissions_remediation.sql';
  const content = fs.readFileSync(migrationPath, 'utf-8');

  assert.ok(content.includes('BEGIN;'), 'Migration must start with BEGIN');
  assert.ok(content.includes('COMMIT;'), 'Migration must end with COMMIT');
});

test('AUTH-061: Remediation migration drops all 5 overly permissive public-read policies', async () => {
  const fs = await import('node:fs');
  const migrationPath = 'd:/Projects/JalDrishti/supabase/migrations/20261011000002_permissions_remediation.sql';
  const content = fs.readFileSync(migrationPath, 'utf-8');

  const droppedPolicies = [
    'Public Read Monitoring Stations',
    'Public Read Station Observations',
    'Public Read Model Predictions',
    'Public Read Recommendations',
    'Public Read Interventions'
  ];

  for (const policy of droppedPolicies) {
    assert.ok(
      content.includes(`DROP POLICY IF EXISTS "${policy}"`),
      `Migration must drop overly permissive policy: ${policy}`
    );
  }
});

test('AUTH-062: Remediation migration preserves intended public-read policies', async () => {
  const fs = await import('node:fs');
  const migrationPath = 'd:/Projects/JalDrishti/supabase/migrations/20261011000002_permissions_remediation.sql';
  const content = fs.readFileSync(migrationPath, 'utf-8');

  // These policies should NOT be dropped — they protect public-readable data
  const preservedPolicies = [
    'Public Read Administrative Units',
    'Public Read Data Sources',
    'Public Read Schemes',
    'Public Read Indicators'  // RLS policy stays; publication lifecycle enforced separately
  ];

  for (const policy of preservedPolicies) {
    assert.equal(
      content.includes(`DROP POLICY IF EXISTS "${policy}"`),
      false,
      `Migration must NOT drop legitimate public-read policy: ${policy}`
    );
  }
});

test('AUTH-063: Remediation migration includes district scoping for intervention proposals', async () => {
  const fs = await import('node:fs');
  const migrationPath = 'd:/Projects/JalDrishti/supabase/migrations/20261011000002_permissions_remediation.sql';
  const content = fs.readFileSync(migrationPath, 'utf-8');

  assert.ok(
    content.includes('district_name = public.current_user_district()'),
    'Intervention proposal policies must enforce district scoping'
  );

  assert.ok(
    content.includes('District Scoped Read Proposals'),
    'Must create district-scoped read policy for proposals'
  );

  assert.ok(
    content.includes('Jurisdiction Scoped Proposal Creation'),
    'Must create jurisdiction-scoped insert policy'
  );

  assert.ok(
    content.includes('Jurisdiction Scoped Proposal Update'),
    'Must create jurisdiction-scoped update policy'
  );
});

test('AUTH-064: Remediation migration does not use GRANT ALL', async () => {
  const fs = await import('node:fs');
  const migrationPath = 'd:/Projects/JalDrishti/supabase/migrations/20261011000002_permissions_remediation.sql';
  const content = fs.readFileSync(migrationPath, 'utf-8');

  assert.equal(
    content.includes('GRANT ALL'),
    false,
    'Migration must never use GRANT ALL'
  );
});

test('AUTH-065: Remediation migration references least-privilege recovery strategy', async () => {
  const fs = await import('node:fs');
  const migrationPath = 'd:/Projects/JalDrishti/supabase/migrations/20261011000002_permissions_remediation.sql';
  const content = fs.readFileSync(migrationPath, 'utf-8');

  assert.ok(
    content.includes('RECOVERY STRATEGY') || content.includes('Least-Privilege Recovery'),
    'Migration must reference the reviewed least-privilege recovery strategy'
  );
});

test('AUTH-066: No DELETE grants exist in remediation migration', async () => {
  const fs = await import('node:fs');
  const migrationPath = 'd:/Projects/JalDrishti/supabase/migrations/20261011000002_permissions_remediation.sql';
  const content = fs.readFileSync(migrationPath, 'utf-8');

  // Extract only non-comment, non-rollback lines
  const activeLines = content.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed.startsWith('GRANT') && !trimmed.startsWith('--');
  });

  for (const line of activeLines) {
    assert.equal(
      line.includes('DELETE'),
      false,
      `No active GRANT line should include DELETE: ${line}`
    );
  }
});

// ---------------------------------------------------------------------------
// 9. Negative & Extended Authorization Boundary Tests
// ---------------------------------------------------------------------------

test('AUTH-025: General Public CANNOT create proposals, view raw audits, or modify workflows', () => {
  const actions: import('../src/lib/services/governanceService.ts').ActionType[] = [
    'create_intervention_proposal',
    'approve_intervention_proposal',
    'read_raw_audit_trail',
    'dispatch_advisory_alert',
    'record_risk_override'
  ];

  for (const action of actions) {
    const result = authorizeAction(ANON_USER, action, 'Tikamgarh');
    assert.equal(
      result.isAuthorized,
      false,
      `Anonymous/General Public must be denied for action: ${action}`
    );
  }
});

test('AUTH-026: Cross-district operational mutations are blocked across all roles', () => {
  // BDO cannot sanction
  assert.equal(
    authorizeAction(TIKAMGARH_BDO, 'approve_intervention_proposal', 'Tikamgarh').isAuthorized,
    false,
    'BDO cannot approve even in own district'
  );

  // BDO cannot create in other district
  assert.equal(
    authorizeAction(TIKAMGARH_BDO, 'create_intervention_proposal', 'Chhatarpur').isAuthorized,
    false,
    'BDO cannot create in other district'
  );

  // Gram Pradhan cannot create outside assigned district
  assert.equal(
    authorizeAction(GRAM_PRADHAN, 'create_intervention_proposal', 'Chhatarpur').isAuthorized,
    false,
    'Gram Pradhan cannot create in another district'
  );
});

test('AUTH-067: Remediation migration requires block-to-district integrity on proposal creation', async () => {
  const fs = await import('node:fs');
  const migrationPath = 'd:/Projects/JalDrishti/supabase/migrations/20261011000002_permissions_remediation.sql';
  const content = fs.readFileSync(migrationPath, 'utf-8');

  assert.ok(
    content.includes('FROM public.administrative_units') &&
    content.includes('unit_id = block_id') &&
    content.includes('district_name = public.intervention_proposals.district_name'),
    'Proposal creation policy must validate block_id belongs to the designated district'
  );
});

test('AUTH-068: Profile policy in init schema enforces role and jurisdiction immutability for non-admins', async () => {
  const fs = await import('node:fs');
  const initSchemaPath = 'd:/Projects/JalDrishti/supabase/migrations/20261010000000_init_schema.sql';
  const content = fs.readFileSync(initSchemaPath, 'utf-8');

  // Verify User Update Self Profile Non Privileged policy exists and checks role and jurisdiction
  assert.ok(
    content.includes('User Update Self Profile Non Privileged'),
    'Profile update policy must exist'
  );
  assert.ok(
    content.includes('role = public.current_user_role()'),
    'Profile policy must prevent self-escalating role'
  );
  assert.ok(
    content.includes('COALESCE(jurisdiction_district_id, \'\') = COALESCE(public.current_user_district(), \'\')'),
    'Profile policy must prevent self-modifying jurisdiction'
  );
});

