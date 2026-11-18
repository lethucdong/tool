import { NextResponse } from 'next/server';
import { readConfig, writeConfig } from '@/lib/configStore';
import { syncBotWorker } from '@/lib/farmBot';

export async function GET() {
  const config = await readConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const saved = await writeConfig(body);
    await syncBotWorker();
    return NextResponse.json({ success: true, config: saved });
  } catch {
    return NextResponse.json({ success: false, error: 'Lỗi lưu config' }, { status: 500 });
  }
}