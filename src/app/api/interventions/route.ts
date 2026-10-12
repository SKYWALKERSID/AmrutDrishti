import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_INTERVENTIONS } from '@/lib/data/interventions';
import { InterventionProposal } from '@/lib/types';

export const dynamic = 'force-dynamic';

// In-memory fallback ledger (persisting between API requests across process lifecycle)
let memoryProposals: InterventionProposal[] = [...INITIAL_INTERVENTIONS];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const blockId = searchParams.get('block');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
    try {
      let queryUrl = `${supabaseUrl}/rest/v1/intervention_proposals?select=*&order=created_at.desc`;
      if (blockId) {
        queryUrl += `&block_id=eq.${encodeURIComponent(blockId)}`;
      }

      const res = await fetch(queryUrl, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
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
          return NextResponse.json({ proposals: mapped, source: 'database' });
        }
      }
    } catch (err) {
      console.warn('Interventions API DB fetch fallback:', err);
    }
  }

  // Memory/fixture fallback
  const filtered = blockId
    ? memoryProposals.filter((p) => p.blockId === blockId)
    : memoryProposals;

  return NextResponse.json({ proposals: filtered, source: 'memory_ledger' });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const proposal: InterventionProposal = body.proposal;

    if (!proposal || !proposal.title || !proposal.blockId) {
      return NextResponse.json({ error: 'Missing required proposal fields' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let savedToDb = false;

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
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
          missing_evidence_notes: proposal.missingEvidenceNotes,
          status: proposal.status,
          proposed_by_role: proposal.proposedByRole,
          proposed_by_name: proposal.proposedByName,
          review_owner_role: proposal.reviewOwnerRole,
          review_owner_name: proposal.reviewOwnerName,
          comments: proposal.comments,
          updated_at: new Date().toISOString(),
        };

        const res = await fetch(`${supabaseUrl}/rest/v1/intervention_proposals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify(dbRow),
        });

        if (res.ok) {
          savedToDb = true;
        }
      } catch (err) {
        console.warn('Interventions API DB write fallback:', err);
      }
    }

    // Always update in-memory ledger
    const existingIdx = memoryProposals.findIndex((p) => p.id === proposal.id);
    if (existingIdx >= 0) {
      memoryProposals[existingIdx] = proposal;
    } else {
      memoryProposals = [proposal, ...memoryProposals];
    }

    return NextResponse.json({
      success: true,
      proposal,
      persistedTo: savedToDb ? 'postgresql_database' : 'memory_ledger',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
