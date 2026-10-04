import { NextResponse } from 'next/server';
import pool from '@/lib/db'; // Đảm bảo đúng đường dẫn tới file kết nối MySQL của bạn

export async function GET() {
  try {
    // Thực hiện 1 truy vấn nhẹ tới MySQL để giữ kết nối
    await pool.query('SELECT 1');
    return NextResponse.json({ status: 'ok', message: 'Database active' });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error.message },
      { status: 500 }
    );
  }
}