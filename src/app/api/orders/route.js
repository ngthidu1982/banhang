import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET: Lấy danh sách lịch sử hóa đơn
export async function GET() {
  try {
    const [orders] = await db.query('SELECT * FROM hoa_don ORDER BY ngay_tao DESC');
    const [items] = await db.query('SELECT * FROM hoa_don_chi_tiet');

    const result = orders.map((order) => ({
      ...order,
      items: items.filter((item) => item.hoa_don_id === order.id),
    }));

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Thực hiện thanh toán và trừ tồn kho
export async function POST(request) {
  try {
    const { items, tong_tien, giam_gia } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Giỏ hàng đang trống!' }, { status: 400 });
    }

    // 1. Kiểm tra tồn kho trước
    for (const item of items) {
      const [variants] = await db.query(
        'SELECT ton_kho FROM sp_variant WHERE ma_san_pham = ? AND size = ?',
        [item.ma_san_pham, item.size]
      );

      if (variants.length === 0) {
        return NextResponse.json(
          { error: `Sản phẩm "${item.ma_san_pham}" - Size ${item.size} không tồn tại!` },
          { status: 400 }
        );
      }

      const tonKhoHienTai = Number(variants[0].ton_kho);
      if (tonKhoHienTai < item.so_luong) {
        return NextResponse.json(
          {
            error: `Sản phẩm "${item.ma_san_pham}" - Size ${item.size} chỉ còn tồn kho ${tonKhoHienTai} cái!`,
          },
          { status: 400 }
        );
      }
    }

    const ma_hoa_don = `HD${Date.now()}`;

    // 2. Thêm Hóa đơn chính (có lưu số tiền giảm giá)
    const [orderResult] = await db.query(
      'INSERT INTO hoa_don (ma_hoa_don, tong_tien, giam_gia) VALUES (?, ?, ?)',
      [ma_hoa_don, Number(tong_tien), Number(giam_gia) || 0]
    );
    const hoaDonId = orderResult.insertId;

    // 3. Thêm Chi tiết hóa đơn + Trừ tồn kho
    for (const item of items) {
      const thanhTien = Number(item.don_gia) * Number(item.so_luong);

      await db.query(
        `INSERT INTO hoa_don_chi_tiet 
        (hoa_don_id, ma_san_pham, ten_san_pham, size, so_luong, don_gia, thanh_tien) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          hoaDonId,
          item.ma_san_pham,
          item.ten_san_pham,
          item.size,
          Number(item.so_luong),
          Number(item.don_gia),
          thanhTien,
        ]
      );

      await db.query(
        'UPDATE sp_variant SET ton_kho = ton_kho - ? WHERE ma_san_pham = ? AND size = ?',
        [Number(item.so_luong), item.ma_san_pham, item.size]
      );
    }

    return NextResponse.json({ message: 'Thanh toán thành công!', ma_hoa_don }, { status: 201 });
  } catch (error) {
    console.error('Lỗi thanh toán:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('id');

    if (!orderId) {
      return NextResponse.json({ error: 'Thiếu ID hóa đơn!' }, { status: 400 });
    }

    // 1. Lấy danh sách chi tiết các mặt hàng trong hóa đơn
    const [items] = await db.query(
      'SELECT ma_san_pham, size, so_luong FROM hoa_don_chi_tiet WHERE hoa_don_id = ?',
      [orderId]
    );

    // 2. Hoàn trả số lượng tồn kho cho từng sản phẩm theo mã và size
    for (const item of items) {
      await db.query(
        'UPDATE sp_variant SET ton_kho = ton_kho + ? WHERE ma_san_pham = ? AND size = ?',
        [Number(item.so_luong), item.ma_san_pham, item.size]
      );
    }

    // 3. Xóa chi tiết hóa đơn
    await db.query('DELETE FROM hoa_don_chi_tiet WHERE hoa_don_id = ?', [orderId]);

    // 4. Xóa hóa đơn chính
    await db.query('DELETE FROM hoa_don WHERE id = ?', [orderId]);

    return NextResponse.json({ message: 'Xóa đơn hàng và hoàn tồn kho thành công!' });
  } catch (error) {
    console.error('Lỗi khi xóa đơn hàng:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}