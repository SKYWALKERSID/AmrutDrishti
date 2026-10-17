import {
  getServerUserContext,
  validateJsonContentType,
  checkRateLimit,
  isOperationalMode,
} from '../../../lib/auth/serverAuth.ts';
import { authorizeAction } from '../../../lib/services/governanceService.ts';
import { getServiceRoleClient } from '../../../lib/supabase/serviceClient.ts';

export const dynamic = 'force-dynamic';

interface AuditEventPayload {
  eventId?: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  resourceTarget: string;
  outcome?: 'success' | 'failure';
  details?: Record<string, unknown>;
  timestamp?: string;
}

// In-memory audit event log buffer for runtime access in demonstration mode only
const memoryAuditLog: any[] = [];

export async function GET(request: Request) {
  try {
    const user = await getServerUserContext(request);

    // 1. Enforce authentication & role
    if (!user.isAuthenticated) {
      if (user.role === 'general_public' && user.userId === 'demo-public-user') {
        return Response.json(
          { error: 'General public role cannot inspect audit logs' },
          { status: 403 }
        );
      }
      return Response.json(
        { error: 'Authentication required to inspect audit logs' },
        { status: 401 }
      );
    }

    // 2. Enforce authorization: only Admin and District Collector can read raw audit trail
    const authResult = authorizeAction(user, 'read_raw_audit_trail');
    if (!authResult.isAuthorized) {
      return Response.json(
        { error: authResult.reason || 'Forbidden: insufficient privileges to access raw audit trail' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);

    const serviceClient = getServiceRoleClient();
    if (serviceClient) {
      try {
        const { data: rows, error } = await serviceClient
          .from('audit_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && Array.isArray(rows) && rows.length > 0) {
          return Response.json({ events: rows, source: 'database' });
        }
      } catch (err) {
        console.warn('Audit API DB fetch error:', err);
      }
    }

    // In operational mode, missing or failing audit database must fail closed
    if (isOperationalMode()) {
      return Response.json(
        { error: 'Audit log database unavailable' },
        { status: 503 }
      );
    }

    // Demo mode buffer fallback
    return Response.json({
      events: memoryAuditLog.slice(0, limit),
      source: 'demo_sandbox_memory',
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
    // 1. Content-Type check
    const ctCheck = validateJsonContentType(request);
    if (!ctCheck.valid) {
      return Response.json({ error: ctCheck.error }, { status: 415 });
    }

    // 2. Parse & validate body
    let body: AuditEventPayload;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || !body.action || !body.resourceTarget) {
      return Response.json(
        { error: 'action and resourceTarget are required fields' },
        { status: 400 }
      );
    }

    // 3. Authenticate caller
    const user = await getServerUserContext(request);
    if (!user.isAuthenticated) {
      if (user.role === 'general_public' && user.userId === 'demo-public-user') {
        return Response.json(
          { error: 'General public role cannot record audit events' },
          { status: 403 }
        );
      }
      return Response.json(
        { error: 'Authentication required to record audit events' },
        { status: 401 }
      );
    }

    // 4. Rate limiting
    const rateLimitKey = `audit_post_${user.userId || 'req'}`;
    const rateStatus = checkRateLimit(rateLimitKey, 60, 60_000);
    if (!rateStatus.allowed) {
      return Response.json(
        { error: 'Rate limit exceeded for audit events.' },
        { status: 429 }
      );
    }

    // 5. Build immutable audit record with verified actor role (preventing caller spoofing)
    const eventRecord = {
      event_id: body.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      actor_id: user.userId,
      actor_role: user.role, // Enforce authenticated role, ignoring spoofed client actorRole
      action: body.action,
      resource_target: body.resourceTarget,
      details: {
        ...(body.details || {}),
        outcome: body.outcome || 'success',
        clientTimestamp: body.timestamp || new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    };

    // 6. Attempt PostgreSQL persistence via service role client
    let savedToDb = false;
    const serviceClient = getServiceRoleClient();

    if (serviceClient) {
      try {
        const payload = {
          actor_role: eventRecord.actor_role,
          action: eventRecord.action,
          resource_target: eventRecord.resource_target,
          details: eventRecord.details,
          created_at: eventRecord.created_at,
        };

        const { error: dbError } = await serviceClient
          .from('audit_events')
          .insert(payload);

        if (!dbError) {
          savedToDb = true;
        } else {
          console.warn('Audit API DB write failed:', dbError.message);
        }
      } catch (err) {
        console.warn('Audit API DB write exception:', err);
      }
    }

    // 7. Enforce persistence guarantees: NO FALSE SUCCESS IN OPERATIONAL MODE
    if (isOperationalMode()) {
      if (!savedToDb) {
        return Response.json(
          {
            success: false,
            error:
              'Audit event persistence failed: operational mode requires durable storage. In-memory fallback is disabled.',
          },
          { status: 503 }
        );
      }

      return Response.json({
        success: true,
        persisted: true,
        isDemoSandbox: false,
        operationalPersistence: true,
        event: eventRecord,
      });
    }

    // 8. Demo Sandbox mode: isolate non-durable in-memory audit log
    memoryAuditLog.unshift(eventRecord);
    if (memoryAuditLog.length > 200) {
      memoryAuditLog.pop();
    }

    return Response.json({
      success: true,
      persisted: savedToDb,
      isDemoSandbox: true,
      operationalPersistence: savedToDb,
      event: eventRecord,
      warning: savedToDb
        ? undefined
        : 'Demo sandbox: audit event recorded in memory buffer only.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
