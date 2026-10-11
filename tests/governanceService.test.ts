import test from 'node:test';
import assert from 'node:assert/strict';

import {
  authorizeAction,
  createAuditEvent,
  redactPhoneNumber,
  type UserContext
} from '../src/lib/services/governanceService.ts';

test('authorizeAction permits public map access for any user including unauthenticated', () => {
  const anonUser: UserContext = {
    userId: 'anon',
    role: 'general_public',
    isAuthenticated: false
  };
  const result = authorizeAction(anonUser, 'read_public_map');
  assert.equal(result.isAuthorized, true);
});

test('authorizeAction denies operational indicator access to unauthenticated sessions', () => {
  const anonUser: UserContext = {
    userId: 'anon',
    role: 'general_public',
    isAuthenticated: false
  };
  const result = authorizeAction(anonUser, 'read_operational_indicators');
  assert.equal(result.isAuthorized, false);
  assert.match(result.reason || '', /Authentication required/i);
});

test('authorizeAction enforces district jurisdiction boundaries for District Collector', () => {
  const collectorTikamgarh: UserContext = {
    userId: 'usr_dc_01',
    role: 'district_collector',
    jurisdictionDistrict: 'Tikamgarh',
    isAuthenticated: true
  };

  // Same district allowed
  const allowTikamgarh = authorizeAction(collectorTikamgarh, 'approve_intervention_proposal', 'Tikamgarh');
  assert.equal(allowTikamgarh.isAuthorized, true);

  // Cross-district access to Chhatarpur denied!
  const denyChhatarpur = authorizeAction(collectorTikamgarh, 'approve_intervention_proposal', 'Chhatarpur');
  assert.equal(denyChhatarpur.isAuthorized, false);
  assert.match(denyChhatarpur.reason || '', /Cross-district access denied/i);
});

test('authorizeAction prevents BDO and Analyst from sanctioning financial proposals', () => {
  const bdo: UserContext = {
    userId: 'usr_bdo_01',
    role: 'bdo',
    jurisdictionDistrict: 'Tikamgarh',
    isAuthenticated: true
  };
  const sanctionResult = authorizeAction(bdo, 'approve_intervention_proposal', 'Tikamgarh');
  assert.equal(sanctionResult.isAuthorized, false);
  assert.match(sanctionResult.reason || '', /sanction requires District Collector/i);

  const analyst: UserContext = {
    userId: 'usr_ana_01',
    role: 'environmental_analyst',
    isAuthenticated: true
  };
  const analystSanction = authorizeAction(analyst, 'approve_intervention_proposal');
  assert.equal(analystSanction.isAuthorized, false);
  assert.match(analystSanction.reason || '', /analysts cannot approve/i);
});

test('createAuditEvent generates immutable audit records with mandatory fields', () => {
  const event = createAuditEvent(
    { userId: 'usr_admin_01', role: 'admin' },
    'risk_override_applied',
    'blk_tikamgarh_main',
    'success',
    { previousSeverity: 'watch', newSeverity: 'severe' }
  );

  assert.ok(event.eventId.startsWith('evt_'));
  assert.equal(event.actorId, 'usr_admin_01');
  assert.equal(event.actorRole, 'admin');
  assert.equal(event.action, 'risk_override_applied');
  assert.equal(event.resourceTarget, 'blk_tikamgarh_main');
  assert.equal(event.outcome, 'success');
  assert.ok(new Date(event.timestamp).getTime() > 0);

  // Check immutability (frozen object)
  assert.throws(() => {
    // @ts-expect-error mutating frozen object
    event.action = 'tampered_action';
  });
});

test('redactPhoneNumber correctly masks private phone numbers', () => {
  assert.equal(redactPhoneNumber('+91 94251 12345'), '+91 9425 *****');
  assert.equal(redactPhoneNumber('+91 98263 99999'), '+91 9826 *****');
  assert.equal(redactPhoneNumber(null), '*****');
  assert.equal(redactPhoneNumber(''), '*****');
});

test('INTERVENTION_SCHEMES catalogue contains official source, effective date, caveats and owner (JD-043)', async () => {
  const { INTERVENTION_SCHEMES } = await import('../src/lib/data/schemes.ts');
  assert.equal(INTERVENTION_SCHEMES.length, 4);

  for (const s of INTERVENTION_SCHEMES) {
    assert.ok(s.officialSource.length > 0, `Scheme ${s.id} missing officialSource`);
    assert.match(s.effectiveDate, /^\d{4}-\d{2}-\d{2}$/, `Scheme ${s.id} invalid effectiveDate`);
    assert.ok(s.applicability.length > 0, `Scheme ${s.id} missing applicability`);
    assert.ok(s.eligibilityCaveat.length > 0, `Scheme ${s.id} missing eligibilityCaveat`);
    assert.ok(s.reviewOwnerRole.length > 0, `Scheme ${s.id} missing reviewOwnerRole`);
    assert.ok(s.maxSanctionUnitAmountInr > 0, `Scheme ${s.id} missing maxSanctionUnitAmountInr`);
  }
});

test('Alert lifecycle requires approval before dispatch, prevents deduplicates, and respects kill-switch (JD-044)', async () => {
  const {
    processAlertLifecycleAction,
    setGlobalAlertKillSwitch
  } = await import('../src/lib/services/governanceService.ts');
  type AlertCandidate = import('../src/lib/services/governanceService.ts').AlertCandidate;

  const candidate: AlertCandidate = {
    candidateId: 'cand_test_01',
    blockId: 'blk_tikamgarh_main',
    blockName: 'Tikamgarh',
    districtName: 'Tikamgarh',
    severity: 'severe',
    stressScore: 78,
    evidenceSummary: 'Deficit monsoon (-235mm) & 14.8m well depth',
    generatedAt: new Date().toISOString(),
    stage: 'candidate_generated',
    idempotencyKey: 'idemp_cand_test_01_20261011'
  };

  const collector: UserContext = {
    userId: 'usr_dc_01',
    role: 'district_collector',
    jurisdictionDistrict: 'Tikamgarh',
    isAuthenticated: true
  };

  const wrongCollector: UserContext = {
    userId: 'usr_dc_02',
    role: 'district_collector',
    jurisdictionDistrict: 'Chhatarpur',
    isAuthenticated: true
  };

  // 1. Cross-district approval denied
  const crossDeny = processAlertLifecycleAction(candidate, wrongCollector, 'approve');
  assert.equal(crossDeny.success, false);
  assert.match(crossDeny.reason || '', /Cross-district authorization failure/i);

  // 2. Cannot dispatch directly from candidate_generated
  const prematurelyDispatched = processAlertLifecycleAction(candidate, collector, 'dispatch_sandbox');
  assert.equal(prematurelyDispatched.success, false);
  assert.match(prematurelyDispatched.reason || '', /Cannot dispatch unapproved candidate/i);

  // 3. Legitimate approval by assigned collector
  const approved = processAlertLifecycleAction(candidate, collector, 'approve', 'Ground truth verified by hydrogeologist');
  assert.equal(approved.success, true);
  assert.equal(approved.stage, 'approved');
  assert.equal(candidate.stage, 'approved');

  // 4. Dispatch to sandbox
  const dispatched = processAlertLifecycleAction(candidate, collector, 'dispatch_sandbox');
  assert.equal(dispatched.success, true);
  assert.equal(dispatched.stage, 'dispatched_simulated');
  assert.ok(dispatched.auditRecord);
  assert.equal(dispatched.auditRecord?.action, 'alert_dispatched_sandbox');

  // 5. Deduplication check: second dispatch with same candidate/key is rejected
  const duplicate = processAlertLifecycleAction(candidate, collector, 'dispatch_sandbox');
  assert.equal(duplicate.success, false);
  assert.match(duplicate.reason || '', /Duplicate dispatch blocked/i);

  // 6. Global Kill Switch test
  setGlobalAlertKillSwitch(true);
  const killSwitched = processAlertLifecycleAction(candidate, collector, 'dispatch_sandbox');
  assert.equal(killSwitched.success, false);
  assert.equal(killSwitched.stage, 'kill_switched');
  assert.match(killSwitched.reason || '', /Emergency Alert Kill Switch is ACTIVE/i);

  // Reset kill switch
  setGlobalAlertKillSwitch(false);
});
