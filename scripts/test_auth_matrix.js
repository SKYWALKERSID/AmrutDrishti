/**
 * Test Authentication, Role Restrictions, District Scoping & Production Guard Matrix
 */
import { getServerUserContext, isOperationalMode } from '../src/lib/auth/serverAuth.ts';
import { authorizeAction } from '../src/lib/services/governanceService.ts';
import { POST as postInterventions } from '../src/app/api/interventions/route.ts';
import { POST as postAlertsDispatch } from '../src/app/api/alerts/dispatch/route.ts';
import assert from 'node:assert/strict';

async function runAuthMatrix() {
  console.log('--- 1. Testing Production Guard against Demo Mode ---');
  // Scenario A: NODE_ENV = 'production', JALDRISHTI_DEMO_MODE = 'true'
  const oldEnv = process.env.NODE_ENV;
  const oldDemo = process.env.JALDRISHTI_DEMO_MODE;
  try {
    process.env.NODE_ENV = 'production';
    process.env.JALDRISHTI_DEMO_MODE = 'true';

    assert.equal(isOperationalMode(), true, 'Production must force isOperationalMode() to true');

    const fakeReq = new Request('http://localhost:3000/api/interventions', {
      headers: {
        'x-jaldrishti-role': 'admin',
        'x-jaldrishti-district': 'Tikamgarh'
      }
    });
    const ctx = await getServerUserContext(fakeReq);
    assert.equal(ctx.isAuthenticated, false, 'Production must ignore simulation headers');
    assert.equal(ctx.role, 'general_public', 'Role must remain general_public in production');
    console.log('✔ Production successfully ignored client identity headers (unauthenticated anonymous default)');
  } finally {
    process.env.NODE_ENV = oldEnv;
    process.env.JALDRISHTI_DEMO_MODE = oldDemo;
  }

  console.log('--- 2. Testing Unauthenticated Access Rejection ---');
  {
    delete process.env.JALDRISHTI_DEMO_MODE;
    const req = new Request('http://localhost:3000/api/interventions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposal: {
          id: 'test-prop',
          title: 'Test Check Dam',
          blockId: 'blk_baldeogarh',
          districtName: 'Tikamgarh'
        }
      })
    });
    const res = await postInterventions(req);
    assert.equal(res.status, 401, 'Unauthenticated POST /api/interventions must return 401');
    const data = await res.json();
    console.log('✔ Unauthenticated POST /api/interventions returned 401:', data.error);
  }

  console.log('--- 3. Testing Unauthorized Role (general_public in demo mode) ---');
  {
    process.env.JALDRISHTI_DEMO_MODE = 'true';
    const req = new Request('http://localhost:3000/api/interventions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jaldrishti-role': 'general_public',
        'x-jaldrishti-user-id': 'demo-public-user'
      },
      body: JSON.stringify({
        proposal: {
          id: 'test-prop',
          title: 'Test Check Dam',
          blockId: 'blk_baldeogarh',
          districtName: 'Tikamgarh'
        }
      })
    });
    const res = await postInterventions(req);
    assert.equal(res.status, 403, 'general_public must receive 403');
    const data = await res.json();
    console.log('✔ general_public received 403:', data.error);
  }

  console.log('--- 4. Testing District Jurisdiction Isolation (Wrong District) ---');
  {
    process.env.JALDRISHTI_DEMO_MODE = 'true';
    // Caller is District Collector of Chhatarpur attempting to approve/mutate Tikamgarh
    const req = new Request('http://localhost:3000/api/interventions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jaldrishti-role': 'district_collector',
        'x-jaldrishti-district': 'Chhatarpur'
      },
      body: JSON.stringify({
        proposal: {
          id: 'test-prop',
          title: 'Check Dam Repair',
          blockId: 'blk_baldeogarh',
          districtName: 'Tikamgarh',
          status: 'approved'
        }
      })
    });
    const res = await postInterventions(req);
    assert.equal(res.status, 403, 'Cross-district mutation must return 403');
    const data = await res.json();
    console.log('✔ Cross-district mutation returned 403:', data.error);
  }

  console.log('--- 5. Testing Authorized District Mutation (Matching District) ---');
  {
    process.env.JALDRISHTI_DEMO_MODE = 'true';
    // Caller is District Collector of Tikamgarh mutating Tikamgarh proposal
    const req = new Request('http://localhost:3000/api/interventions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jaldrishti-role': 'district_collector',
        'x-jaldrishti-district': 'Tikamgarh'
      },
      body: JSON.stringify({
        proposal: {
          id: 'test-prop-matching',
          title: 'Check Dam Repair in Tikamgarh',
          blockId: 'blk_baldeogarh',
          districtName: 'Tikamgarh',
          status: 'submitted'
        }
      })
    });
    const res = await postInterventions(req);
    // In demo mode, this succeeds with demo_sandbox_memory_ledger or db save
    const data = await res.json();
    console.log('✔ Matching district mutation processed:', res.status, data.source || data.success);
    assert.ok(res.status === 200 || res.status === 201, 'Matching district mutation should succeed in demo mode');
  }

  console.log('--- 6. Testing Alerts Dispatch (Simulation Sandbox Guarantee) ---');
  {
    process.env.JALDRISHTI_DEMO_MODE = 'true';
    const req = new Request('http://localhost:3000/api/alerts/dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jaldrishti-role': 'district_collector',
        'x-jaldrishti-district': 'Tikamgarh'
      },
      body: JSON.stringify({
        recipientPhone: '+919876543210',
        messageText: 'Groundwater Advisory for Baldeogarh',
        districtName: 'Tikamgarh',
        blockName: 'Baldeogarh'
      })
    });
    const res = await postAlertsDispatch(req);
    const data = await res.json();
    console.log('✔ Alerts dispatch result:', res.status, data.deliveryStatus, data.simulationMode);
    assert.equal(data.deliveryStatus, 'simulated');
    assert.equal(data.dltRegistered, false);
    assert.ok(data.details.includes('Simulation mode active'));
  }

  console.log('\nALL AUTHENTICATION, RBAC, DISTRICT JURISDICTION & SIMULATION CHECKS PASSED.');
}

runAuthMatrix().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
