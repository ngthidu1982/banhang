import { NextResponse } from 'next/server';
import pool from '@/lib/db'; 

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