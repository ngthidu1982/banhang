import { NextResponse } from 'next/server';
import { db } from '@/lib/db'; 

export async function GET() {
  try {
    await db.query('SELECT 1');
    return NextResponse.json({ status: 'ok', message: 'Database active' });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error.message },
      { status: 500 }
    );
  }
}