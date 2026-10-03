import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    let productsQuery = 'SELECT * FROM sanpham';
    let queryParams = [];

    if (search.trim() !== '') {
      productsQuery += ' WHERE ma_san_pham LIKE ?';
      queryParams.push(`%${search.trim()}%`);
    }

    const [products] = await db.query(productsQuery, queryParams);
    const [variants] = await db.query('SELECT * FROM sp_variant');

    const totalProducts = products.length;

    let totalStock = 0;
    let totalValue = 0; // Tổng tiền hàng tính theo GIÁ GỐC
    let totalDiscountProfit = 0; // Tổng tiền chiết khấu (tiền lời)
    const stockBySize = {};

    const result = products.map((prod) => {
      const prodVariants = variants.filter((v) => v.ma_san_pham === prod.ma_san_pham);
      const giaGoc = Number(prod.gia) || 0;
      const chietKhau = Number(prod.chiet_khau) || 0;

      // Tiền lời (chiết khấu) trên 1 sản phẩm
      const tienLoiPerUnit = (giaGoc * chietKhau) / 100;
      // Giá bán cho khách vẫn là Giá gốc
      const giaBanThucTe = giaGoc; 

      prodVariants.forEach((v) => {
        const tonKho = Number(v.ton_kho) || 0;

        totalStock += tonKho;
        totalValue += tonKho * giaGoc;
        totalDiscountProfit += tonKho * tienLoiPerUnit;

        if (v.size) {
          stockBySize[v.size] = (stockBySize[v.size] || 0) + tonKho;
        }
      });

      return {
        ...prod,
        chiet_khau: chietKhau,
        tien_loi: tienLoiPerUnit,
        gia_ban: giaBanThucTe, // Khách mua đúng giá gốc
        variants: prodVariants,
      };
    });

    return NextResponse.json({
      products: result,
      stats: {
        totalProducts,
        totalStock,
        totalValue, // Tổng tiền hàng nguyên giá gốc
        totalDiscountProfit, // Tổng tiền chiết khấu/lợi nhuận
        totalValueAfterDiscount: totalValue - totalDiscountProfit, // Tổng tiền hàng sau chiết khấu
        stockBySize,
      },
    });
  } catch (error) {
    console.error('Lỗi GET products:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { ma_san_pham, ten_san_pham, gia, chiet_khau, variants } = await request.json();

    if (!ma_san_pham || !ten_san_pham || !gia) {
      return NextResponse.json(
        { error: 'Vui lòng điền đầy đủ Mã SP, Tên SP và Giá' },
        { status: 400 }
      );
    }

    const [existing] = await db.query(
      'SELECT id FROM sanpham WHERE ma_san_pham = ?',
      [ma_san_pham]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Mã sản phẩm "${ma_san_pham}" đã tồn tại trong hệ thống!` },
        { status: 400 }
      );
    }

    await db.query(
      'INSERT INTO sanpham (ma_san_pham, ten_san_pham, gia, chiet_khau) VALUES (?, ?, ?, ?)',
      [ma_san_pham, ten_san_pham, Number(gia), Number(chiet_khau) || 0]
    );

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

    return NextResponse.json({ message: 'Thêm sản phẩm thành công' }, { status: 201 });
  } catch (error) {
    console.error('Lỗi khi POST sản phẩm:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}