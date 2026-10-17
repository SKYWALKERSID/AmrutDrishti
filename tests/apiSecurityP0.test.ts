/**
 * JAL DRISHTI — P0 Security, Authorization & Persistence Remediation Test Suite
 * 
 * Verifies:
 * 1. Unauthenticated request rejection (HTTP 401).
 * 2. Unauthorized role rejection (HTTP 403).
 * 3. Cross-jurisdiction access denial (HTTP 403).
 * 4. Content-Type and malformed request validation (HTTP 415 / 400).
 * 5. Database write failure guarantees (fail closed, no false success in operational mode).
 * 6. Explicit isolation and labeling of demonstration sandbox mode.
 * 7. Prevention of caller role spoofing in audit trail.
 * 8. Emergency alert kill switch enforcement.
 * 9. Safe service-role configuration diagnostics without credential exposure.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as getInterventions, POST as postInterventions } from '../src/app/api/interventions/route.ts';
import { GET as getAudit, POST as postAudit } from '../src/app/api/audit/route.ts';
import { POST as postAlertsDispatch } from '../src/app/api/alerts/dispatch/route.ts';
import {
  setGlobalAlertKillSwitch,
  isGlobalAlertKillSwitchActive,
} from '../src/lib/services/governanceService.ts';
import {
  getServiceRoleConfigStatus,
  getServiceRoleClient,
} from '../src/lib/supabase/serviceClient.ts';

function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Request {
  const method = options.method || 'GET';
  const headers = new Headers(options.headers || {});

  let reqInit: RequestInit = {
    method,
    headers,
  };

  if (options.body !== undefined) {
    reqInit.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  return new Request(url, reqInit);
}

// ---------------------------------------------------------------------------
// 1. INTERVENTIONS API AUTHORIZATION & INTEGRITY
// ---------------------------------------------------------------------------

test('P0-AUTH-001: GET /api/interventions rejects unauthenticated caller with 401', async () => {
  const origDemo = process.env.JALDRISHTI_DEMO_MODE;
  try {
    delete process.env.JALDRISHTI_DEMO_MODE;
    const req = createMockRequest('http://localhost:3000/api/interventions');
    const res = await getInterventions(req);

    assert.equal(res.status, 401, 'Unauthenticated GET /api/interventions must return 401');
    const data = await res.json();
    assert.match(data.error, /Authentication required/i);
  } finally {
    if (origDemo) process.env.JALDRISHTI_DEMO_MODE = origDemo;
  }
});

test('P0-AUTH-002: GET /api/interventions rejects general_public role with 403', async () => {
  process.env.JALDRISHTI_DEMO_MODE = 'true';
  const req = createMockRequest('http://localhost:3000/api/interventions', {
    headers: { 'x-jaldrishti-role': 'general_public' },
  });
  const res = await getInterventions(req);

  assert.equal(res.status, 403, 'general_public must receive 403 Forbidden for operational interventions');
  const data = await res.json();
  assert.match(data.error, /cannot access operational intervention proposals/i);
});

test('P0-AUTH-003: POST /api/interventions rejects invalid Content-Type with 415', async () => {
  const req = createMockRequest('http://localhost:3000/api/interventions', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'plain text payload',
  });
  const res = await postInterventions(req);

  assert.equal(res.status, 415, 'Non-JSON POST must be rejected with 415');
});

test('P0-AUTH-004: POST /api/interventions rejects malformed or missing proposal fields with 400', async () => {
  process.env.JALDRISHTI_DEMO_MODE = 'true';
  const req = createMockRequest('http://localhost:3000/api/interventions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-jaldrishti-role': 'district_collector',
      'x-jaldrishti-district': 'Tikamgarh',
    },
    body: { proposal: { title: '' } }, // missing blockId & districtName
  });
  const res = await postInterventions(req);

  assert.equal(res.status, 400, 'Missing required fields must return 400');
  const data = await res.json();
  assert.match(data.error, /Missing required proposal fields/i);
});

test('P0-AUTH-005: POST /api/interventions denies cross-district sanction to District Collector with 403', async () => {
  process.env.JALDRISHTI_DEMO_MODE = 'true';
  const req = createMockRequest('http://localhost:3000/api/interventions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-jaldrishti-role': 'district_collector',
      'x-jaldrishti-district': 'Tikamgarh', // Tikamgarh DC
    },
    body: {
      proposal: {
        id: 'prop_test_chh_01',
        title: 'Unauthorized Cross-District Dam Sanction',
        blockId: 'blk_chhatarpur_01',
        districtName: 'Chhatarpur', // Target is Chhatarpur
        status: 'approved', // Sanction attempt
      },
    },
  });
  const res = await postInterventions(req);

  assert.equal(res.status, 403, 'Cross-district approval must be rejected with 403');
  const data = await res.json();
  assert.match(data.error, /Cross-district access denied/i);
});

test('P0-AUTH-006: POST /api/interventions denies proposal approval to BDO with 403', async () => {
  process.env.JALDRISHTI_DEMO_MODE = 'true';
  const req = createMockRequest('http://localhost:3000/api/interventions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-jaldrishti-role': 'bdo',
      'x-jaldrishti-district': 'Tikamgarh',
    },
    body: {
      proposal: {
        id: 'prop_test_bdo_01',
        title: 'BDO Self-Approval Attempt',
        blockId: 'blk_tikamgarh_01',
        districtName: 'Tikamgarh',
        status: 'approved', // BDO cannot sanction
      },
    },
  });
  const res = await postInterventions(req);

  assert.equal(res.status, 403, 'BDO must be denied approval authority with 403');
  const data = await res.json();
  assert.match(data.error, /final sanction requires District Collector or Admin/i);
});

test('P0-PERSIST-001: POST /api/interventions in operational mode fails closed on DB write failure (NO false success)', async () => {
  const origDemo = process.env.JALDRISHTI_DEMO_MODE;
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const origFetch = globalThis.fetch;

  try {
    delete process.env.JALDRISHTI_DEMO_MODE; // Operational mode
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';

    // Mock fetch so auth succeeds for District Collector, but database write fails
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes('/auth/v1/user')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'mock-dc-user',
            app_metadata: { role: 'district_collector', jurisdiction_district: 'Tikamgarh' },
          }),
        } as unknown as Response;
      }
      // Any database attempt fails
      return {
        ok: false,
        status: 500,
        text: async () => 'DB connection down',
      } as unknown as Response;
    };

    const req = createMockRequest('http://localhost:3000/api/interventions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer mock-valid-session-jwt',
      },
      body: {
        proposal: {
          id: 'prop_fail_test_01',
          title: 'Operational Write Without DB',
          blockId: 'blk_tikamgarh_01',
          districtName: 'Tikamgarh',
          status: 'under_review',
        },
      },
    });

    const res = await postInterventions(req);
    // In operational mode, DB write failure MUST return 503 and never false success
    assert.equal(res.status, 503, 'Operational write with DB failure must return 503');
    const data = await res.json();
    assert.equal(data.success, false, 'Must not claim success when write failed');
    assert.match(data.error, /Database persistence failed/i);
  } finally {
    if (origDemo) process.env.JALDRISHTI_DEMO_MODE = origDemo;
    if (origUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl; else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (origKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey; else delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    globalThis.fetch = origFetch;
  }
});

test('P0-PERSIST-002: POST /api/interventions in demo mode clearly labels in-memory fallback as demo sandbox', async () => {
  process.env.JALDRISHTI_DEMO_MODE = 'true';
  const req = createMockRequest('http://localhost:3000/api/interventions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-jaldrishti-role': 'district_collector',
      'x-jaldrishti-district': 'Tikamgarh',
    },
    body: {
      proposal: {
        id: `prop_demo_${Date.now()}`,
        title: 'Demo Proposal',
        blockId: 'blk_tikamgarh_01',
        districtName: 'Tikamgarh',
        status: 'under_review',
      },
    },
  });

  const res = await postInterventions(req);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.isDemoSandbox, true, 'Demo sandbox must be explicitly flagged');
  if (data.persistedTo !== 'postgresql_database') {
    assert.equal(data.operationalPersistence, false);
    assert.equal(data.persistedTo, 'demo_sandbox_memory_only');
    assert.ok(data.warning?.includes('demonstration sandbox'), 'Warning must disclose non-durable demo storage');
  }
});

// ---------------------------------------------------------------------------
// 2. AUDIT API AUTHORIZATION & SPOOFING PROTECTION
// ---------------------------------------------------------------------------

test('P0-AUTH-010: GET /api/audit rejects unauthenticated caller with 401', async () => {
  const origDemo = process.env.JALDRISHTI_DEMO_MODE;
  try {
    delete process.env.JALDRISHTI_DEMO_MODE;
    const req = createMockRequest('http://localhost:3000/api/audit');
    const res = await getAudit(req);

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /Authentication required/i);
  } finally {
    if (origDemo) process.env.JALDRISHTI_DEMO_MODE = origDemo;
  }
});

test('P0-AUTH-011: GET /api/audit rejects environmental_analyst and BDO with 403', async () => {
  process.env.JALDRISHTI_DEMO_MODE = 'true';

  for (const role of ['environmental_analyst', 'bdo', 'general_public'] as const) {
    const req = createMockRequest('http://localhost:3000/api/audit', {
      headers: { 'x-jaldrishti-role': role },
    });
    const res = await getAudit(req);

    assert.ok(res.status === 403 || res.status === 401, `Role ${role} must not read raw audit trail`);
  }
});

test('P0-AUTH-012: GET /api/audit allows Admin and District Collector', async () => {
  process.env.JALDRISHTI_DEMO_MODE = 'true';

  for (const role of ['admin', 'district_collector'] as const) {
    const req = createMockRequest('http://localhost:3000/api/audit?limit=5', {
      headers: {
        'x-jaldrishti-role': role,
        'x-jaldrishti-district': 'Tikamgarh',
      },
    });
    const res = await getAudit(req);

    assert.equal(res.status, 200, `Role ${role} must be authorized to inspect audit log`);
    const data = await res.json();
    assert.ok(Array.isArray(data.events));
  }
});

test('P0-AUTH-013: POST /api/audit prevents caller role spoofing', async () => {
  process.env.JALDRISHTI_DEMO_MODE = 'true';

  // Caller is authenticated as BDO, but tries to pass actorRole: 'admin' in body
  const req = createMockRequest('http://localhost:3000/api/audit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-jaldrishti-role': 'bdo',
      'x-jaldrishti-district': 'Tikamgarh',
    },
    body: {
      actorRole: 'admin', // Spoofed!
      action: 'unauthorized_action',
      resourceTarget: 'system_settings',
    },
  });

  const res = await postAudit(req);
  assert.equal(res.status, 200);
  const data = await res.json();

  // Enforced role must be 'bdo', NOT 'admin'
  assert.equal(data.event.actor_role, 'bdo', 'Audit event must bind to caller context role, rejecting spoofed actorRole');
});

// ---------------------------------------------------------------------------
// 3. ALERTS DISPATCH AUTHORIZATION, KILL SWITCH & INPUT VALIDATION
// ---------------------------------------------------------------------------

test('P0-AUTH-020: POST /api/alerts/dispatch rejects unauthenticated request with 401', async () => {
  const origDemo = process.env.JALDRISHTI_DEMO_MODE;
  try {
    delete process.env.JALDRISHTI_DEMO_MODE;
    const req = createMockRequest('http://localhost:3000/api/alerts/dispatch', {
      method: 'POST',
      body: {
        recipientPhone: '+919425111111',
        recipientName: 'Test Recipient',
        messageText: 'Alert Test',
        districtName: 'Tikamgarh',
        blockName: 'Tikamgarh',
      },
    });
    const res = await postAlertsDispatch(req);
    assert.equal(res.status, 401, 'Unauthenticated alert dispatch must reject with 401');
  } finally {
    if (origDemo) process.env.JALDRISHTI_DEMO_MODE = origDemo;
  }
});

test('P0-AUTH-021: POST /api/alerts/dispatch rejects unauthorized roles with 403', async () => {
  process.env.JALDRISHTI_DEMO_MODE = 'true';

  const deniedRoles = ['bdo', 'environmental_analyst', 'gram_pradhan', 'jal_samiti', 'general_public'] as const;

  for (const role of deniedRoles) {
    const req = createMockRequest('http://localhost:3000/api/alerts/dispatch', {
      method: 'POST',
      headers: {
        'x-jaldrishti-role': role,
        'x-jaldrishti-district': 'Tikamgarh',
      },
      body: {
        recipientPhone: '+919425111111',
        recipientName: 'Test Recipient',
        messageText: 'Alert Test',
        districtName: 'Tikamgarh',
        blockName: 'Tikamgarh',
      },
    });
    const res = await postAlertsDispatch(req);
    assert.ok(
      res.status === 403 || res.status === 401,
      `Role ${role} must be denied alert dispatch (got ${res.status})`
    );
  }
});

test('P0-AUTH-022: POST /api/alerts/dispatch denies cross-district dispatch to District Collector with 403', async () => {
  process.env.JALDRISHTI_DEMO_MODE = 'true';

  const req = createMockRequest('http://localhost:3000/api/alerts/dispatch', {
    method: 'POST',
    headers: {
      'x-jaldrishti-role': 'district_collector',
      'x-jaldrishti-district': 'Tikamgarh', // Collector of Tikamgarh
    },
    body: {
      recipientPhone: '+919425111111',
      recipientName: 'Test Recipient',
      messageText: 'Alert Test',
      districtName: 'Chhatarpur', // Target is Chhatarpur
      blockName: 'Nowgong',
    },
  });

  const res = await postAlertsDispatch(req);
  assert.equal(res.status, 403, 'Cross-district dispatch must be denied with 403');
  const data = await res.json();
  assert.match(data.error, /Cross-district access denied/i);
});

test('P0-AUTH-023: POST /api/alerts/dispatch rejects invalid phone number (< 10 digits) with 400', async () => {
  process.env.JALDRISHTI_DEMO_MODE = 'true';

  const req = createMockRequest('http://localhost:3000/api/alerts/dispatch', {
    method: 'POST',
    headers: {
      'x-jaldrishti-role': 'admin',
    },
    body: {
      recipientPhone: '12345', // Invalid short phone number
      recipientName: 'Test',
      messageText: 'Alert Text',
      districtName: 'Tikamgarh',
      blockName: 'Tikamgarh',
    },
  });

  const res = await postAlertsDispatch(req);
  assert.equal(res.status, 400, 'Invalid phone number must return 400');
  const data = await res.json();
  assert.match(data.error, /Minimum 10 digits required/i);
});

test('P0-KILLSWITCH-001: Emergency kill switch freezes all alert dispatch', async () => {
  process.env.JALDRISHTI_DEMO_MODE = 'true';

  try {
    setGlobalAlertKillSwitch(true);
    assert.equal(isGlobalAlertKillSwitchActive(), true);

    const req = createMockRequest('http://localhost:3000/api/alerts/dispatch', {
      method: 'POST',
      headers: {
        'x-jaldrishti-role': 'admin',
      },
      body: {
        recipientPhone: '+919425111111',
        recipientName: 'Test Admin',
        messageText: 'Emergency test',
        districtName: 'Tikamgarh',
        blockName: 'Tikamgarh',
      },
    });

    const res = await postAlertsDispatch(req);
    assert.equal(res.status, 423, 'Active kill switch must return 423 Locked');
    const data = await res.json();
    assert.match(data.error, /Emergency Alert Kill Switch is ACTIVE/i);
  } finally {
    setGlobalAlertKillSwitch(false);
  }
});

// ---------------------------------------------------------------------------
// 4. SUPABASE SERVICE ROLE CONFIGURATION & DIAGNOSTICS
// ---------------------------------------------------------------------------

test('P0-CONFIG-001: getServiceRoleConfigStatus detects malformed keys without exposing secret', () => {
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    // Test with malformed key starting with dot
    process.env.SUPABASE_SERVICE_ROLE_KEY = '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QifQ.sig';
    const status = getServiceRoleConfigStatus();

    assert.equal(status.configured, true);
    assert.equal(status.validFormat, false, 'Key with missing header must be flagged invalid');
    assert.ok(status.diagnosticReason?.includes('leading dot') || status.diagnosticReason?.includes('JWT'));

    // Verify client returns null and avoids making network requests with bad key
    const client = getServiceRoleClient();
    assert.equal(client, null, 'Service client must be null when key format is invalid');
  } finally {
    if (origKey !== undefined) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
    } else {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
    if (origUrl !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
  }
});

test('P0-CONFIG-002: getServiceRoleConfigStatus detects placeholder values safely', () => {
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'your-supabase-service-role-key-here-NEVER-EXPOSE-TO-BROWSER';
    const status = getServiceRoleConfigStatus();

    assert.equal(status.isPlaceholder, true);
    assert.equal(status.validFormat, false);
    assert.ok(status.diagnosticReason?.includes('placeholder'));
  } finally {
    if (origKey !== undefined) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
    } else {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  }
});
