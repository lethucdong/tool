import { NextResponse } from 'next/server';
import { getGameHeaders } from '@/lib/farmBot';

export async function GET() {
  try {
    const baseUrl = process.env.GAME_API_BASE || 'https://at-sp.ssvhue.work/api';
    const res = await fetch(`${baseUrl}/farm/neighbors`, {
      method: 'GET',
      headers: await getGameHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Lỗi ${res.status} khi lấy danh sách neighbors (kiểm tra lại Cookie)` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Lỗi kết nối API neighbors';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}