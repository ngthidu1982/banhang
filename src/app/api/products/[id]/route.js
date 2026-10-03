import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// PUT: Cập nhật sản phẩm & chiết khấu
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { ma_san_pham, ten_san_pham, gia, chiet_khau, variants } = await request.json();

    // 1. Cập nhật bảng sanpham (bao gồm cả chiết khấu)
    await db.query(
      'UPDATE sanpham SET ma_san_pham = ?, ten_san_pham = ?, gia = ?, chiet_khau = ? WHERE id = ?',
      [ma_san_pham, ten_san_pham, Number(gia), Number(chiet_khau) || 0, id]
    );

    // 2. Xóa biến thể cũ và chèn biến thể mới
    await db.query('DELETE FROM sp_variant WHERE ma_san_pham = ?', [ma_san_pham]);

    if (variants && Array.isArray(variants) && variants.length > 0) {
      for (const v of variants) {
        if (v.size && v.ton_kho !== '') {
          await db.query(
            'INSERT INTO sp_variant (ma_san_pham, size, ton_kho) VALUES (?, ?, ?)',
            [ma_san_pham, v.size, Number(v.ton_kho)]
          );
        }
      }
    }

    return NextResponse.json({ message: 'Cập nhật sản phẩm thành công' });
  } catch (error) {
    console.error('Lỗi khi PUT sản phẩm:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Xóa sản phẩm
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    const [products] = await db.query('SELECT ma_san_pham FROM sanpham WHERE id = ?', [id]);
    if (products.length > 0) {
      const ma_san_pham = products[0].ma_san_pham;
      await db.query('DELETE FROM sp_variant WHERE ma_san_pham = ?', [ma_san_pham]);
    }

    await db.query('DELETE FROM sanpham WHERE id = ?', [id]);

    return NextResponse.json({ message: 'Xóa sản phẩm thành công' });
  } catch (error) {
    console.error('Lỗi khi DELETE sản phẩm:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}