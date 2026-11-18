import { NextResponse } from 'next/server';
import { getLogs, runSingleCycle } from '@/lib/farmBot';
import { readConfig } from '@/lib/configStore';

export async function GET() {
  return NextResponse.json({ logs: getLogs() });
}

export async function POST() {
  const config = await readConfig();
  await runSingleCycle(config);
  return NextResponse.json({ success: true, logs: getLogs() });
}