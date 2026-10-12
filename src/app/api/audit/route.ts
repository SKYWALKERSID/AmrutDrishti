import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface AuditEventPayload {
  eventId?: string;
  actorId?: string;
  actorRole: string;
  action: string;
  resourceTarget: string;
  outcome?: 'success' | 'failure';
  details?: Record<string, unknown>;
  timestamp?: string;
}

// In-memory audit event log buffer for runtime access & graceful persistence fallback
const memoryAuditLog: any[] = [];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/audit_events?select=*&order=created_at.desc&limit=${limit}`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return NextResponse.json({ events: rows, source: 'database' });
        }
      }
    } catch {
      // Fall through to memory log
    }
  }

  return NextResponse.json({ events: memoryAuditLog.slice(0, limit), source: 'memory' });
}

export async function POST(request: NextRequest) {
  try {
    const body: AuditEventPayload = await request.json();

    if (!body.action || !body.resourceTarget) {
      return NextResponse.json(
        { error: 'action and resourceTarget are required fields' },
        { status: 400 }
      );
    }

    const eventRecord = {
      event_id: body.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      actor_role: body.actorRole || 'admin',
      action: body.action,
      resource_target: body.resourceTarget,
      details: {
        ...(body.details || {}),
        outcome: body.outcome || 'success',
        clientTimestamp: body.timestamp || new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    };

    // 1. Record in memory buffer
    memoryAuditLog.unshift(eventRecord);
    if (memoryAuditLog.length > 200) {
      memoryAuditLog.pop();
    }

    // 2. Persist to PostgreSQL if configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
      try {
        const payload: Record<string, unknown> = {
          actor_role: eventRecord.actor_role,
          action: eventRecord.action,
          resource_target: eventRecord.resource_target,
          details: eventRecord.details,
          created_at: eventRecord.created_at,
        };

        const res = await fetch(`${supabaseUrl}/rest/v1/audit_events`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          return NextResponse.json({ success: true, persisted: true, event: eventRecord });
        }
      } catch {
        // Fallback recorded in memory
      }
    }

    return NextResponse.json({ success: true, persisted: false, event: eventRecord });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Audit event processing failed' }, { status: 500 });
  }
}
