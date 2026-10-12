import { NextRequest, NextResponse } from 'next/server';
import { dispatchDltSms } from '@/lib/services/smsService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await dispatchDltSms(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Dispatch failed' },
      { status: 500 }
    );
  }
}
