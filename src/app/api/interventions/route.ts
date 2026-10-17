import { INITIAL_INTERVENTIONS } from '../../../lib/data/interventions.ts';
import type { InterventionProposal } from '../../../lib/types.ts';
import {
  getServerUserContext,
  validateJsonContentType,
  checkRateLimit,
  isOperationalMode,
} from '../../../lib/auth/serverAuth.ts';
import { authorizeAction } from '../../../lib/services/governanceService.ts';
import { getServiceRoleClient } from '../../../lib/supabase/serviceClient.ts';

export const dynamic = 'force-dynamic';

// In-memory fallback ledger (for demonstration mode only)
let memoryProposals: InterventionProposal[] = [...INITIAL_INTERVENTIONS];

export async function GET(request: Request) {
  try {
    const user = await getServerUserContext(request);

    // Enforce authentication: intervention proposals are operational data
    if (!user.isAuthenticated) {
      if (user.role === 'general_public' && user.userId === 'demo-public-user') {
        return Response.json(
          { error: 'General public role cannot access operational intervention proposals' },
          { status: 403 }
        );
      }
      return Response.json(
        { error: 'Authentication required to view intervention proposals' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const blockId = searchParams.get('block');

    const serviceClient = getServiceRoleClient();
    if (serviceClient) {
      try {
        let query = serviceClient
          .from('intervention_proposals')
          .select('*')
          .order('created_at', { ascending: false });

        if (blockId) {
          query = query.eq('block_id', blockId);
        }

        const { data: rows, error } = await query;
        if (!error && Array.isArray(rows) && rows.length > 0) {
          const mapped: InterventionProposal[] = rows.map((r: any) => ({
            id: r.proposal_id,
            title: r.title,
            blockId: r.block_id,
            blockName: r.block_name,
            districtName: r.district_name,
            schemeId: r.scheme_id,
            schemeName: r.scheme_name,
            proposedByRole: r.proposed_by_role,
            proposedByName: r.proposed_by_name,
            targetVillage: r.target_village,
            estimatedCostInr: Number(r.estimated_cost_inr),
            beneficiariesCount: Number(r.beneficiaries_count),
            evidenceRationale: r.evidence_rationale,
            missingEvidenceNotes: r.missing_evidence_notes || '',
            reviewOwnerRole: r.review_owner_role,
            reviewOwnerName: r.review_owner_name,
            status: r.status,
            createdDate: r.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            lastUpdatedDate: r.updated_at ? r.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
            comments: Array.isArray(r.comments) ? r.comments : [],
          }));
          return Response.json({ proposals: mapped, source: 'database' });
        }
      } catch (err) {
        console.warn('Interventions API DB fetch error:', err);
      }
    }

    // In operational mode, failure to query database must fail closed
    if (isOperationalMode()) {
      return Response.json(
        { error: 'Intervention proposals database unavailable' },
        { status: 503 }
      );
    }

    // Demo sandbox fallback: explicitly marked as non-durable demo data
    const filtered = blockId
      ? memoryProposals.filter((p) => p.blockId === blockId)
      : memoryProposals;

    return Response.json({
      proposals: filtered,
      source: 'demo_sandbox_memory_ledger',
      isDemoSandbox: true,
      operationalPersistence: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 1. Validate Content-Type
    const ctCheck = validateJsonContentType(request);
    if (!ctCheck.valid) {
      return Response.json({ error: ctCheck.error }, { status: 415 });
    }

    // 2. Parse & validate request payload
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const proposal: InterventionProposal = body?.proposal;
    if (
      !proposal ||
      typeof proposal !== 'object' ||
      !proposal.title ||
      !proposal.blockId ||
      !proposal.districtName
    ) {
      return Response.json(
        { error: 'Missing required proposal fields (title, blockId, districtName)' },
        { status: 400 }
      );
    }

    // 3. Authenticate caller
    const user = await getServerUserContext(request);
    if (!user.isAuthenticated) {
      if (user.role === 'general_public' && user.userId === 'demo-public-user') {
        return Response.json(
          { error: 'General public role cannot mutate intervention proposals' },
          { status: 403 }
        );
      }
      return Response.json(
        { error: 'Authentication required to submit or update intervention proposals' },
        { status: 401 }
      );
    }

    // 4. Rate limiting per caller
    const rateLimitKey = `interventions_${user.userId || 'req'}`;
    const rateStatus = checkRateLimit(rateLimitKey, 30, 60_000);
    if (!rateStatus.allowed) {
      return Response.json(
        { error: 'Rate limit exceeded for intervention proposals. Please wait.' },
        { status: 429 }
      );
    }

    // 5. Authorize action and district jurisdiction
    const isApproval = proposal.status === 'approved';
    const action = isApproval ? 'approve_intervention_proposal' : 'create_intervention_proposal';
    const authResult = authorizeAction(user, action, proposal.districtName);

    if (!authResult.isAuthorized) {
      return Response.json(
        { error: authResult.reason || 'Unauthorized operation on intervention proposal' },
        { status: 403 }
      );
    }

    // 6. Attempt PostgreSQL persistence via service role client
    let savedToDb = false;
    const serviceClient = getServiceRoleClient();

    if (serviceClient) {
      try {
        const dbRow = {
          proposal_id: proposal.id,
          block_id: proposal.blockId,
          block_name: proposal.blockName,
          district_name: proposal.districtName,
          scheme_id: proposal.schemeId,
          scheme_name: proposal.schemeName,
          title: proposal.title,
          target_village: proposal.targetVillage,
          estimated_cost_inr: proposal.estimatedCostInr,
          beneficiaries_count: proposal.beneficiariesCount,
          evidence_rationale: proposal.evidenceRationale,
          missing_evidence_notes: proposal.missingEvidenceNotes || '',
          status: proposal.status,
          proposed_by_role: proposal.proposedByRole,
          proposed_by_name: proposal.proposedByName,
          review_owner_role: proposal.reviewOwnerRole,
          review_owner_name: proposal.reviewOwnerName,
          comments: proposal.comments,
          updated_at: new Date().toISOString(),
        };

        const { error: dbError } = await serviceClient
          .from('intervention_proposals')
          .upsert(dbRow, { onConflict: 'proposal_id' });

        if (!dbError) {
          savedToDb = true;
        } else {
          console.warn('Interventions API DB write failed:', dbError.message);
        }
      } catch (err) {
        console.warn('Interventions API DB write exception:', err);
      }
    }

    // 7. Enforce persistence guarantees: NO FALSE SUCCESS IN OPERATIONAL MODE
    if (isOperationalMode()) {
      if (!savedToDb) {
        return Response.json(
          {
            success: false,
            error:
              'Database persistence failed: operational mode requires durable PostgreSQL storage. In-memory fallback is disabled.',
          },
          { status: 503 }
        );
      }

      return Response.json({
        success: true,
        proposal,
        persistedTo: 'postgresql_database',
        isDemoSandbox: false,
        operationalPersistence: true,
      });
    }

    // 8. Demo Sandbox mode: isolate non-durable in-memory ledger
    const existingIdx = memoryProposals.findIndex((p) => p.id === proposal.id);
    if (existingIdx >= 0) {
      memoryProposals[existingIdx] = proposal;
    } else {
      memoryProposals = [proposal, ...memoryProposals];
    }

    return Response.json({
      success: true,
      proposal,
      persistedTo: savedToDb ? 'postgresql_database' : 'demo_sandbox_memory_only',
      isDemoSandbox: true,
      operationalPersistence: savedToDb,
      warning: savedToDb
        ? undefined
        : 'Non-durable: intervention recorded in in-memory demonstration sandbox only.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
