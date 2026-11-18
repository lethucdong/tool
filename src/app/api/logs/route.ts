import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SUCCESS_LOG_PATH = path.join(process.cwd(), 'action_success.log');

export async function GET() {
  try {
    const content = await fs.readFile(SUCCESS_LOG_PATH, 'utf-8');
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="action_success_${new Date()
          .toISOString()
          .slice(0, 10)}.log"`,
      },
    });
  } catch {
    return new NextResponse('Chưa có dữ liệu log thành công nào.', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="action_success.log"',
      },
    });
  }
}

export async function DELETE() {
  try {
    await fs.writeFile(SUCCESS_LOG_PATH, '', 'utf-8');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Không thể xóa file log' }, { status: 500 });
  }
}