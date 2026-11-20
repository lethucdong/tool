import { NextResponse } from 'next/server';
import { getGameHeaders } from '@/lib/farmBot';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const baseUrl = process.env.GAME_API_BASE || 'https://at-sp.ssvhue.work/api';
    const headers = await getGameHeaders();

    // Thử gọi endpoint visit để lấy toàn bộ cấu trúc farm hàng xóm
    let res = await fetch(`${baseUrl}/farm/visit/${id}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok || res.status === 404 || res.status === 405) {
      return NextResponse.json(
        { error: `Lỗi ${res.status} khi tải thông tin chi tiết Farm #${id}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Lỗi kết nối API chi tiết hàng xóm';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}