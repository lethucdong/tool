import { NextResponse } from 'next/server';
import { getGameHeaders } from '@/lib/farmBot';

export async function GET() {
  try {
    const baseUrl = process.env.GAME_API_BASE || 'https://at-sp.ssvhue.work/api';
    const res = await fetch(`${baseUrl}/farm`, {
      method: 'GET',
      headers: await getGameHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Lỗi ${res.status} khi tải dữ liệu Catalog (kiểm tra lại Cookie)` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      catalog: data?.catalog || {},
      priceMul: data?.me?.priceMul || {},
      market: data?.me?.market || {},
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Lỗi kết nối API catalog';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}