'use client';

import { useState, useEffect, useMemo } from 'react';

const ITEMS_PER_PAGE = 10;

export default function Home() {
  const [mounted, setMounted] = useState(false);
  // Navigation State
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'checkout'

  // Products State
  const [products, setProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    totalValue: 0,
    totalDiscountProfit: 0,
    totalValueAfterDiscount: 0,
    stockBySize: {},
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [searchName, setSearchName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    ma_san_pham: '',
    ten_san_pham: '',
    gia: '',
    chiet_khau: 0,
    variants: [{ size: '', ton_kho: '' }],
  });

  // Cart & Checkout State
  const [cart, setCart] = useState([]);
  const [checkoutProductSearch, setCheckoutProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [orderDiscount, setOrderDiscount] = useState(0);

  // Orders History & Print State
  const [ordersHistory, setOrdersHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [orderToPrint, setOrderToPrint] = useState(null);

  const fetchProducts = async (code = searchCode, name = searchName) => {
    try {
      const res = await fetch(
        `/api/products?searchCode=${encodeURIComponent(code)}&searchName=${encodeURIComponent(name)}`
      );
      const data = await res.json();

      if (data && data.products) {
        setProducts(data.products);
        setStats(data.stats || {});
      } else if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Lỗi fetch:', error);
      setProducts([]);
    }
  };

  const fetchOrdersHistory = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrdersHistory(data);
      }
    } catch (error) {
      console.error('Lỗi fetch hóa đơn:', error);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchProducts();
    fetchOrdersHistory();
  }, []);

  // Tính toán dữ liệu phân trang
  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentProducts = products.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Lọc sản phẩm ở Tab Thanh Toán
  const filteredCheckoutProducts = useMemo(() => {
    if (!checkoutProductSearch.trim()) return products;
    const term = checkoutProductSearch.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.ma_san_pham.toLowerCase().includes(term) ||
        p.ten_san_pham.toLowerCase().includes(term)
    );
  }, [products, checkoutProductSearch]);

  // Thống kê lịch sử giao dịch
  const historyStats = useMemo(() => {
    const todayStr = selectedDate;
    const selectedDateObj = new Date(selectedDate);
    const filterYear = selectedDateObj.getFullYear();
    const filterMonth = selectedDateObj.getMonth();

    let totalBySelectedDate = 0;
    let totalBySelectedMonth = 0;
    let grandTotal = 0;

    const filteredOrders = [];

    ordersHistory.forEach((order) => {
      const orderAmount = Number(order.tong_tien) || 0;
      grandTotal += orderAmount;

      const orderDateObj = new Date(order.ngay_tao);
      const orderDateStr = orderDateObj.toISOString().split('T')[0];

      if (orderDateStr === todayStr) {
        totalBySelectedDate += orderAmount;
        filteredOrders.push(order);
      }

      if (orderDateObj.getFullYear() === filterYear && orderDateObj.getMonth() === filterMonth) {
        totalBySelectedMonth += orderAmount;
      }
    });

    return {
      totalBySelectedDate,
      totalBySelectedMonth,
      grandTotal,
      filteredOrders,
      filterMonthDisplay: `${filterMonth + 1}/${filterYear}`,
    };
  }, [ordersHistory, selectedDate]);

  // HÀM IN HÓA ĐƠN
  const handlePrintOrder = (order) => {
    setOrderToPrint(order);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // CART HANDLERS
  const handleAddToCart = () => {
    if (!selectedProduct) return alert('Vui lòng chọn sản phẩm!');
    if (!selectedSize) return alert('Vui lòng chọn Size!');
    if (!buyQuantity || buyQuantity <= 0) return alert('Số lượng phải lớn hơn 0!');

    const prod = products.find((p) => p.ma_san_pham === selectedProduct);
    if (!prod) return;

    const variant = prod.variants?.find((v) => String(v.size) === String(selectedSize));
    if (!variant) return alert('Size không hợp lệ!');

    if (Number(buyQuantity) > Number(variant.ton_kho)) {
      return alert(`Tồn kho chỉ còn ${variant.ton_kho} cái!`);
    }

    const donGiaThucTe = Number(prod.gia);

    const existingIndex = cart.findIndex(
      (item) => item.ma_san_pham === prod.ma_san_pham && String(item.size) === String(selectedSize)
    );

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      const newQty = Number(updatedCart[existingIndex].so_luong) + Number(buyQuantity);
      if (newQty > Number(variant.ton_kho)) {
        return alert(`Số lượng trong giỏ vượt quá tồn kho (${variant.ton_kho} cái)!`);
      }
      updatedCart[existingIndex].so_luong = newQty;
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          ma_san_pham: prod.ma_san_pham,
          ten_san_pham: prod.ten_san_pham,
          size: selectedSize,
          don_gia: donGiaThucTe,
          so_luong: Number(buyQuantity),
          itemDiscountType: 'percent',
          itemDiscountValue: 0,
        },
      ]);
    }

    setBuyQuantity(1);
  };

  const handleRemoveFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleItemDiscountChange = (index, field, value) => {
    const updatedCart = [...cart];
    updatedCart[index][field] = value;
    setCart(updatedCart);
  };

  const calculateItemDiscountAmount = (item) => {
    const totalLine = Number(item.don_gia) * Number(item.so_luong);
    const val = Number(item.itemDiscountValue) || 0;
    if (item.itemDiscountType === 'percent') {
      return (totalLine * Math.min(100, Math.max(0, val))) / 100;
    } else {
      return Math.min(totalLine, Math.max(0, val));
    }
  };

  const subTotal = cart.reduce((sum, item) => {
    const lineTotal = Number(item.don_gia) * Number(item.so_luong);
    const discount = calculateItemDiscountAmount(item);
    return sum + (lineTotal - discount);
  }, 0);

  const finalTotal = Math.max(0, subTotal - Number(orderDiscount || 0));

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Giỏ hàng trống!');

    const itemsForPayload = cart.map((item) => {
      const lineTotal = Number(item.don_gia) * Number(item.so_luong);
      const discountAmount = calculateItemDiscountAmount(item);
      
      const percentVal = item.itemDiscountType === 'percent' 
        ? Number(item.itemDiscountValue) || 0 
        : lineTotal > 0 ? (discountAmount / lineTotal) * 100 : 0;

      return {
        ...item,
        giam_gia_item: discountAmount,
        giam_gia_percent: percentVal,
        thanh_tien: lineTotal - discountAmount,
      };
    });

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsForPayload,
          tong_tien: finalTotal,
          giam_gia: Number(orderDiscount) || 0,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert('Thanh toán thành công! Mã đơn: ' + data.ma_hoa_don);

        const createdOrder = {
          ma_hoa_don: data.ma_hoa_don,
          ngay_tao: new Date().toISOString(),
          items: itemsForPayload,
          giam_gia: Number(orderDiscount) || 0,
          tong_tien: finalTotal,
        };

        setCart([]);
        setOrderDiscount(0);
        fetchProducts(searchQuery);
        fetchOrdersHistory();

        handlePrintOrder(createdOrder);
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (error) {
      alert('Có lỗi xảy ra khi thanh toán!');
    }
  };

  const handleDeleteOrder = async (orderId, maHoaDon) => {
    if (confirm(`Bạn có chắc chắn muốn xóa đơn hàng ${maHoaDon}? Tồn kho của các sản phẩm trong đơn sẽ được HOÀN TRẢ LẠI!`)) {
      try {
        const res = await fetch(`/api/orders?id=${orderId}`, {
          method: 'DELETE',
        });

        const data = await res.json();

        if (res.ok) {
          alert('Đã xóa đơn hàng và hoàn lại số lượng sản phẩm vào kho!');
          fetchOrdersHistory();
          fetchProducts(searchQuery);
        } else {
          alert('Lỗi: ' + data.error);
        }
      } catch (error) {
        alert('Có lỗi xảy ra khi xóa đơn hàng!');
      }
    }
  };

  const handleVariantChange = (index, field, value) => {
    const updatedVariants = [...formData.variants];
    updatedVariants[index][field] = value;
    setFormData({ ...formData, variants: updatedVariants });
  };

  const addVariantRow = () => {
    setFormData({
      ...formData,
      variants: [...formData.variants, { size: '', ton_kho: '' }],
    });
  };

  const removeVariantRow = (index) => {
    const updatedVariants = formData.variants.filter((_, i) => i !== index);
    setFormData({ ...formData, variants: updatedVariants });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/products/${editingId}` : '/api/products';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    setEditingId(null);
    setFormData({ ma_san_pham: '', ten_san_pham: '', gia: '', chiet_khau: 0, variants: [{ size: '', ton_kho: '' }] });
    fetchProducts(searchQuery);
  };

  const handleEdit = (prod) => {
    setEditingId(prod.id);
    setFormData({
      ma_san_pham: prod.ma_san_pham,
      ten_san_pham: prod.ten_san_pham,
      gia: prod.gia,
      chiet_khau: prod.chiet_khau || 0,
      variants: prod.variants && prod.variants.length > 0 ? prod.variants : [{ size: '', ton_kho: '' }],
    });
  };

  const handleDelete = async (id) => {
    if (confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      fetchProducts(searchQuery);
    }
  };

  const selectedProdObj = products.find((p) => p.ma_san_pham === selectedProduct);

  if (!mounted) {
    return null;
  }

  const printSummary = orderToPrint ? (() => {
    let tongTienHang = 0;
    let tongGiamMon = 0;

    orderToPrint.items?.forEach((item) => {
      const donGiaGoc = Number(item.don_gia) || 0;
      const soLuong = Number(item.so_luong) || 0;
      const lineGiamGia = Number(item.giam_gia_item ?? item.giam_gia ?? 0);

      tongTienHang += donGiaGoc * soLuong;
      tongGiamMon += lineGiamGia;
    });

    const giamGiaThem = Number(orderToPrint.giam_gia) || 0;
    const tongCong = Number(orderToPrint.tong_tien) || 0;

    return {
      tongTienHang,
      tongGiamMon,
      giamGiaThem,
      tongCong,
    };
  })() : null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-50 text-zinc-900 font-sans pb-16 md:pb-0">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-receipt-area, #print-receipt-area * {
            visibility: visible;
          }
          #print-receipt-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 76mm;
            padding: 2mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            color: #000;
            background: #fff;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* SIDEBAR NAVIGATION (Desktop) & BOTTOM NAV (Mobile) */}
      <aside className="w-full md:w-64 bg-zinc-900 text-white flex md:flex-col justify-between p-3 md:p-4 shadow-lg shrink-0 border-r border-zinc-800 no-print fixed bottom-0 left-0 right-0 z-50 md:relative">
        <div className="hidden md:block text-base font-bold uppercase tracking-wider mb-8 px-2 border-b border-zinc-800 pb-4 text-zinc-100">
          BÁN HÀNG & KHO
        </div>
        <nav className="flex md:flex-col w-full gap-2 justify-around md:justify-start">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-2 px-3 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
              activeTab === 'products'
                ? 'bg-white text-zinc-900 font-semibold shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            Quản lý sản phẩm
          </button>
          <button
            onClick={() => setActiveTab('checkout')}
            className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-2 px-3 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
              activeTab === 'checkout'
                ? 'bg-white text-zinc-900 font-semibold shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            Thanh toán & Lịch sử
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto no-print">
        {/* TAB 1: QUẢN LÝ SẢN PHẨM */}
        {activeTab === 'products' && (
          <div>
            <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-zinc-900">Quản Lý Sản Phẩm & Tồn Kho</h1>

            {/* DASHBOARD TỔNG QUAN */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
              <div className="bg-white border border-zinc-200 p-4 md:p-5 rounded-xl shadow-sm">
                <p className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tổng Số SP</p>
                <p className="text-lg md:text-2xl font-bold text-zinc-900 mt-1">{stats.totalProducts || 0} Mã</p>
              </div>
              <div className="bg-white border border-zinc-200 p-4 md:p-5 rounded-xl shadow-sm">
                <p className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tổng Tồn Kho</p>
                <p className="text-lg md:text-2xl font-bold text-zinc-900 mt-1">{stats.totalStock || 0} Cái</p>
              </div>
              <div className="bg-white border border-zinc-200 p-4 md:p-5 rounded-xl shadow-sm">
                <p className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tiền Hàng (Gốc)</p>
                <p className="text-base md:text-2xl font-bold text-zinc-900 mt-1">
                  {Number(stats.totalValue || 0).toLocaleString('vi-VN')} đ
                </p>
              </div>
              <div className="bg-white border border-zinc-200 p-4 md:p-5 rounded-xl shadow-sm">
                <p className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sau Chiết Khấu</p>
                <p className="text-base md:text-2xl font-bold text-zinc-900 mt-1">
                  {Number(stats.totalValueAfterDiscount || 0).toLocaleString('vi-VN')} đ
                </p>
                <span className="inline-block text-[10px] md:text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mt-1">
                  Lời: +{Number(stats.totalDiscountProfit || 0).toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>

            {/* THỐNG KÊ THEO SIZE */}
            <div className="bg-white border border-zinc-200 p-4 md:p-5 rounded-xl shadow-sm mb-6 md:mb-8">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Tồn Kho Theo Size:</h3>
              {stats.stockBySize && Object.keys(stats.stockBySize).length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 md:gap-3">
                  {Object.entries(stats.stockBySize)
                    .sort(([a], [b]) => {
                      const numA = Number(a);
                      const numB = Number(b);
                      const isNumA = Number.isInteger(numA) && a.trim() !== '';
                      const isNumB = Number.isInteger(numB) && b.trim() !== '';

                      if (isNumA && isNumB) {
                        return numA - numB;
                      }
                      return a.localeCompare(b, undefined, { numeric: true });
                    })
                    .map(([size, count]) => (
                      <div key={size} className="bg-zinc-50 border border-zinc-200 rounded-lg p-2 md:p-3 text-center">
                        <span className="block text-[10px] text-zinc-500 uppercase font-bold">Size</span>
                        <span className="block text-lg md:text-xl font-black text-zinc-900 my-0.5">{size}</span>
                        <span className="block text-xs font-medium text-zinc-600">{count} cái</span>
                      </div>
                    ))}
                </div>
              ) : (
                <span className="text-zinc-400 text-sm">Chưa có dữ liệu tồn kho theo size</span>
              )}
            </div>

            {/* FORM THÊM / SỬA SẢN PHẨM */}
            <form onSubmit={handleSubmit} className="bg-white p-4 md:p-6 rounded-xl border border-zinc-200 shadow-sm mb-6 md:mb-8 space-y-4">
              <h2 className="text-base md:text-lg font-bold text-zinc-900">{editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <input
                  type="text"
                  placeholder="Mã sản phẩm"
                  value={formData.ma_san_pham}
                  onChange={(e) => setFormData({ ...formData, ma_san_pham: e.target.value })}
                  className="border border-zinc-300 p-2.5 rounded-lg bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                  required
                />
                <input
                  type="text"
                  placeholder="Tên sản phẩm"
                  value={formData.ten_san_pham}
                  onChange={(e) => setFormData({ ...formData, ten_san_pham: e.target.value })}
                  className="border border-zinc-300 p-2.5 rounded-lg bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                  required
                />
                <input
                  type="number"
                  placeholder="Giá gốc"
                  value={formData.gia}
                  onChange={(e) => setFormData({ ...formData, gia: e.target.value })}
                  className="border border-zinc-300 p-2.5 rounded-lg bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                  required
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Chiết khấu (%)"
                  value={formData.chiet_khau}
                  onChange={(e) => setFormData({ ...formData, chiet_khau: e.target.value })}
                  className="border border-zinc-300 p-2.5 rounded-lg bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-2 pt-2">
                <label className="font-medium text-xs md:text-sm block text-zinc-700">Biến thể (Size & Tồn kho):</label>
                {formData.variants.map((v, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Size (VD: 41)"
                      value={v.size}
                      onChange={(e) => handleVariantChange(index, 'size', e.target.value)}
                      className="border border-zinc-300 p-2 rounded-lg w-1/2 md:w-1/3 bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Tồn kho"
                      value={v.ton_kho}
                      onChange={(e) => handleVariantChange(index, 'ton_kho', e.target.value)}
                      className="border border-zinc-300 p-2 rounded-lg w-1/2 md:w-1/3 bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                      required
                    />
                    {formData.variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariantRow(index)}
                        className="bg-zinc-100 text-red-600 border border-zinc-200 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-red-50 hover:border-red-200 transition-all shrink-0"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addVariantRow}
                  className="bg-zinc-900 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium mt-2 hover:bg-zinc-800 transition-all"
                >
                  + Thêm size
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-zinc-900 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-all">
                  {editingId ? 'Cập nhật' : 'Thêm mới'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ ma_san_pham: '', ten_san_pham: '', gia: '', chiet_khau: 0, variants: [{ size: '', ton_kho: '' }] });
                    }}
                    className="bg-zinc-100 border border-zinc-300 text-zinc-700 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-all"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>

            {/* BẢNG SẢN PHẨM & TÌM KIẾM */}
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-zinc-200 flex flex-col md:flex-row justify-between items-center gap-3">
                <h2 className="text-base md:text-lg font-bold text-zinc-900 w-full md:w-auto">Danh Sách Sản Phẩm</h2>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                  <input
                    type="text"
                    placeholder="Tìm Mã SP..."
                    value={searchCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchCode(val);
                      setCurrentPage(1);
                      fetchProducts(val, searchName);
                    }}
                    className="w-full sm:w-40 border border-zinc-300 px-3 py-2 rounded-lg bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                  />
                  <input
                    type="text"
                    placeholder="Tìm Tên SP..."
                    value={searchName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchName(val);
                      setCurrentPage(1);
                      fetchProducts(searchCode, val);
                    }}
                    className="w-full sm:w-48 border border-zinc-300 px-3 py-2 rounded-lg bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                  />
                  {(searchCode || searchName) && (
                    <button
                      onClick={() => {
                        setSearchCode('');
                        setSearchName('');
                        setCurrentPage(1);
                        fetchProducts('', '');
                      }}
                      className="bg-zinc-200 text-zinc-800 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-zinc-300 transition-all w-full sm:w-auto"
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-zinc-800">
                  <thead className="bg-zinc-100/80 text-zinc-900 font-semibold border-b border-zinc-200">
                    <tr>
                      <th className="py-3 px-3 md:px-4">Mã SP</th>
                      <th className="py-3 px-3 md:px-4">Tên SP</th>
                      <th className="py-3 px-3 md:px-4 text-center">Tồn kho</th>
                      <th className="py-3 px-3 md:px-4 text-center">Chiết khấu</th>
                      <th className="py-3 px-3 md:px-4">Giá niêm yết</th>
                      <th className="py-3 px-3 md:px-4">Biến thể (Size - Tồn)</th>
                      <th className="py-3 px-3 md:px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {Array.isArray(currentProducts) && currentProducts.length > 0 ? (
                      currentProducts.map((p) => {
                        const chietKhau = Number(p.chiet_khau) || 0;
                        const giaGoc = Number(p.gia) || 0;
                        const tienLoi = (giaGoc * chietKhau) / 100;

                        const totalVariantStock =
                          p.variants?.reduce(
                            (sum, v) => sum + (Number(v.ton_kho) || 0),
                            0
                          ) || 0;

                        return (
                          <tr key={p.id} className="hover:bg-zinc-50/80 transition-colors">
                            <td className="py-3 px-3 md:px-4 font-bold text-zinc-900 whitespace-nowrap">{p.ma_san_pham}</td>
                            <td className="py-3 px-3 md:px-4 font-medium">{p.ten_san_pham}</td>
                            <td className="py-3 px-3 md:px-4 text-center font-bold text-zinc-900 whitespace-nowrap">
                              {totalVariantStock} cái
                            </td>
                            <td className="py-3 px-3 md:px-4 text-center whitespace-nowrap">
                              {chietKhau > 0 ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="bg-emerald-50 text-emerald-700 font-bold text-xs px-2 py-0.5 rounded border border-emerald-200 shadow-sm">
                                    +{chietKhau}%
                                  </span>
                                  <span className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                    (+{tienLoi.toLocaleString('vi-VN')} đ)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-zinc-400 text-xs">0%</span>
                              )}
                            </td>
                            <td className="py-3 px-3 md:px-4 font-bold text-zinc-900 whitespace-nowrap">{giaGoc.toLocaleString('vi-VN')} đ</td>
                            <td className="py-3 px-3 md:px-4 min-w-[160px]">
                              <div className="flex flex-wrap gap-1">
                                {p.variants && p.variants.length > 0 ? (
                                  p.variants.map((v, i) => (
                                    <span
                                      key={i}
                                      className="inline-block bg-zinc-100 text-zinc-700 text-[11px] px-1.5 py-0.5 rounded border border-zinc-200"
                                    >
                                      <b>Size {v.size}</b>: {v.ton_kho}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-zinc-400 text-xs">Chưa có</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 md:px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleEdit(p)}
                                  className="bg-zinc-100 text-zinc-800 border border-zinc-300 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-zinc-200 transition-all"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => handleDelete(p.id)}
                                  className="bg-red-50 text-red-600 border border-red-200 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-100 transition-all"
                                >
                                  Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-zinc-400 text-sm">
                          Không tìm thấy sản phẩm nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* PHÂN TRANG */}
              {products.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between p-3 md:p-4 border-t border-zinc-200 text-xs text-zinc-600 bg-zinc-50/50 gap-2">
                  <div>
                    <b>{startIndex + 1}</b>-<b>{Math.min(startIndex + ITEMS_PER_PAGE, products.length)}</b> / <b>{products.length}</b> SP
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-all"
                    >
                      Trước
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`px-2.5 py-1 rounded-md border font-medium transition-all ${
                          currentPage === page
                            ? 'bg-zinc-900 text-white border-zinc-900 font-bold'
                            : 'bg-white border-zinc-300 hover:bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-all"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: THANH TOÁN & LỊCH SỬ THANH TOÁN */}
        {activeTab === 'checkout' && (
          <div>
            <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-zinc-900">Thanh Toán & Lịch Sử Giao Dịch</h1>

            {/* KHU VỰC TẠO ĐƠN HÀNG */}
            <div className="bg-white border border-zinc-200 p-4 md:p-6 rounded-xl shadow-sm mb-6 md:mb-8">
              <h2 className="text-xs md:text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3 md:mb-4">TẠO ĐƠN HÀNG MỚI</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-4 items-center">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Lọc mã/tên SP..."
                    value={checkoutProductSearch}
                    onChange={(e) => setCheckoutProductSearch(e.target.value)}
                    className="w-full border border-zinc-300 p-2.5 rounded-lg bg-zinc-50 text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                  />
                  {checkoutProductSearch && (
                    <button
                      onClick={() => setCheckoutProductSearch('')}
                      className="absolute right-2.5 top-3 text-xs text-zinc-400 hover:text-zinc-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={selectedProduct}
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    setSelectedSize('');
                  }}
                  className="border border-zinc-300 p-2.5 rounded-lg bg-zinc-50 text-zinc-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all w-full"
                >
                  <option value="">-- Chọn Sản phẩm ({filteredCheckoutProducts.length}) --</option>
                  {filteredCheckoutProducts.slice(0, 20).map((p) => (
                    <option key={p.id} value={p.ma_san_pham}>
                      {p.ma_san_pham} - {p.ten_san_pham} ({Number(p.gia).toLocaleString('vi-VN')} đ)
                    </option>
                  ))}
                </select>

                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  disabled={!selectedProduct}
                  className="border border-zinc-300 p-2.5 rounded-lg bg-zinc-50 text-zinc-900 font-medium text-sm disabled:bg-zinc-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all w-full"
                >
                  <option value="">-- Chọn Size --</option>
                  {selectedProdObj?.variants
                    ?.slice()
                    .sort((a, b) => {
                      const numA = Number(a.size);
                      const numB = Number(b.size);
                      const isNumA = Number.isInteger(numA) && String(a.size).trim() !== '';
                      const isNumB = Number.isInteger(numB) && String(b.size).trim() !== '';

                      if (isNumA && isNumB) {
                        return numA - numB;
                      }
                      return String(a.size).localeCompare(String(b.size), undefined, { numeric: true });
                    })
                    .map((v) => (
                      <option key={v.id || v.size} value={v.size}>
                        Size {v.size} (Tồn: {v.ton_kho})
                      </option>
                    ))}
                </select>

                <input
                  type="number"
                  min="1"
                  placeholder="Số lượng"
                  value={buyQuantity}
                  onChange={(e) => setBuyQuantity(e.target.value)}
                  className="border border-zinc-300 p-2.5 rounded-lg bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all w-full"
                />

                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="bg-zinc-900 text-white font-semibold p-2.5 rounded-lg hover:bg-zinc-800 transition-all text-sm shadow-sm w-full"
                >
                  + Thêm vào giỏ
                </button>
              </div>

              {cart.length > 0 && (
                <div className="bg-zinc-50/50 rounded-xl border border-zinc-200 overflow-hidden shadow-sm mt-4 md:mt-6 p-3 md:p-5">
                  <h3 className="font-bold text-zinc-900 text-sm mb-3">Giỏ hàng hiện tại:</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm text-left border-collapse mb-4 bg-white rounded-lg overflow-hidden border border-zinc-200">
                      <thead>
                        <tr className="bg-zinc-100 text-zinc-900 border-b border-zinc-200">
                          <th className="p-2 md:p-3">Mã SP</th>
                          <th className="p-2 md:p-3">Tên SP</th>
                          <th className="p-2 md:p-3">Size</th>
                          <th className="p-2 md:p-3">Đơn giá</th>
                          <th className="p-2 md:p-3">SL</th>
                          <th className="p-2 md:p-3">Giảm giá món</th>
                          <th className="p-2 md:p-3">Thành tiền</th>
                          <th className="p-2 md:p-3 text-center">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {cart.map((item, index) => {
                          const lineTotal = Number(item.don_gia) * Number(item.so_luong);
                          const itemDiscountAmt = calculateItemDiscountAmount(item);
                          const lineFinal = lineTotal - itemDiscountAmt;

                          return (
                            <tr key={index}>
                              <td className="p-2 md:p-3 font-bold text-zinc-900 whitespace-nowrap">{item.ma_san_pham}</td>
                              <td className="p-2 md:p-3">{item.ten_san_pham}</td>
                              <td className="p-2 md:p-3 font-semibold text-zinc-800 whitespace-nowrap">Size {item.size}</td>
                              <td className="p-2 md:p-3 whitespace-nowrap">{Number(item.don_gia).toLocaleString('vi-VN')} đ</td>
                              <td className="p-2 md:p-3 font-bold">{item.so_luong}</td>
                              
                              <td className="p-2 md:p-3">
                                <div className="flex items-center gap-1">
                                  <select
                                    value={item.itemDiscountType || 'percent'}
                                    onChange={(e) => handleItemDiscountChange(index, 'itemDiscountType', e.target.value)}
                                    className="border border-zinc-300 p-1 rounded text-[11px] bg-zinc-50 focus:outline-none"
                                  >
                                    <option value="percent">%</option>
                                    <option value="vnd">đ</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.itemDiscountValue ?? 0}
                                    onChange={(e) => handleItemDiscountChange(index, 'itemDiscountValue', e.target.value)}
                                    placeholder="0"
                                    className="border border-zinc-300 p-1 rounded text-[11px] w-16 md:w-20 bg-zinc-50 focus:outline-none"
                                  />
                                </div>
                                {itemDiscountAmt > 0 && (
                                  <span className="text-[10px] text-red-600 block mt-0.5 font-medium whitespace-nowrap">
                                    -{itemDiscountAmt.toLocaleString('vi-VN')} đ
                                  </span>
                                )}
                              </td>

                              <td className="p-2 md:p-3 font-bold text-zinc-900 whitespace-nowrap">
                                {lineFinal.toLocaleString('vi-VN')} đ
                              </td>
                              <td className="p-2 md:p-3 text-center">
                                <button
                                  onClick={() => handleRemoveFromCart(index)}
                                  className="text-red-600 font-semibold hover:bg-red-50 px-2 py-1 rounded text-xs transition-all"
                                >
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white p-3 md:p-4 rounded-xl border border-zinc-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                    <div className="flex items-center justify-between md:justify-start gap-2">
                      <label className="text-xs font-semibold text-zinc-600">Giảm đơn (VNĐ):</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0 đ"
                        value={orderDiscount}
                        onChange={(e) => setOrderDiscount(e.target.value)}
                        className="border border-zinc-300 p-2 rounded-lg bg-zinc-50 text-zinc-900 text-sm w-32 md:w-44 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white"
                      />
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-[11px] text-zinc-500">Tạm tính: {subTotal.toLocaleString('vi-VN')} đ</p>
                      {Number(orderDiscount) > 0 && (
                        <p className="text-[11px] text-red-600 font-semibold">
                          Giảm đơn: -{Number(orderDiscount).toLocaleString('vi-VN')} đ
                        </p>
                      )}
                      <span className="text-xs md:text-sm font-semibold text-zinc-700">
                        Thành tiền: <strong className="text-zinc-900 text-lg md:text-xl font-bold ml-1">{finalTotal.toLocaleString('vi-VN')} đ</strong>
                      </span>
                    </div>

                    <button
                      onClick={handleCheckout}
                      className="bg-zinc-900 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-zinc-800 shadow transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      THANH TOÁN & IN
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* THỐNG KÊ DOANH THU & LỊCH SỬ */}
            <div className="bg-white border border-zinc-200 p-4 md:p-6 rounded-xl shadow-sm mb-6 md:mb-8">
              <h2 className="text-xs md:text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3 md:mb-4">THỐNG KÊ DOANH THU & LỊCH SỬ</h2>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <label htmlFor="filter-date" className="font-semibold text-zinc-700 text-xs uppercase tracking-wider">
                    Ngày xem:
                  </label>
                  <input
                    id="filter-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-zinc-300 p-2 rounded-lg bg-zinc-50 text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              {/* CARD TỔNG TIỀN */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
                <div className="bg-white border border-zinc-200 p-4 md:p-5 rounded-xl shadow-sm">
                  <p className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Doanh Thu Ngày ({new Date(selectedDate).toLocaleDateString('vi-VN')})
                  </p>
                  <p className="text-lg md:text-2xl font-bold text-zinc-900 mt-1">
                    {historyStats.totalBySelectedDate.toLocaleString('vi-VN')} đ
                  </p>
                </div>

                <div className="bg-white border border-zinc-200 p-4 md:p-5 rounded-xl shadow-sm">
                  <p className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Doanh Thu Tháng ({historyStats.filterMonthDisplay})
                  </p>
                  <p className="text-lg md:text-2xl font-bold text-zinc-900 mt-1">
                    {historyStats.totalBySelectedMonth.toLocaleString('vi-VN')} đ
                  </p>
                </div>

                <div className="bg-white border border-zinc-200 p-4 md:p-5 rounded-xl shadow-sm">
                  <p className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tổng Doanh Thu Cả Bè</p>
                  <p className="text-lg md:text-2xl font-bold text-zinc-900 mt-1">
                    {historyStats.grandTotal.toLocaleString('vi-VN')} đ
                  </p>
                </div>
              </div>

              {/* DANH SÁCH LỊCH SỬ ĐƠN HÀNG */}
              <div>
                <h3 className="font-bold text-zinc-900 text-xs md:text-sm mb-3">
                  Danh sách hóa đơn ngày {new Date(selectedDate).toLocaleDateString('vi-VN')}:
                </h3>
                {historyStats.filteredOrders.length > 0 ? (
                  <div className="space-y-3">
                    {historyStats.filteredOrders.map((order) => {
                      const giamGiaDon = Number(order.giam_gia) || 0;
                      return (
                        <div key={order.id || order.ma_hoa_don} className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 md:p-4 shadow-sm">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-zinc-200 pb-2 mb-2 gap-2">
                            <div>
                              <span className="font-bold text-zinc-900 text-sm">{order.ma_hoa_don}</span>
                              <span className="text-[11px] text-zinc-500 ml-2">
                                {new Date(order.ngay_tao).toLocaleTimeString('vi-VN')} - {new Date(order.ngay_tao).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-2">
                              <div className="text-left sm:text-right">
                                {giamGiaDon > 0 && (
                                  <span className="block text-[10px] text-red-600 font-semibold">
                                    Đã giảm: -{giamGiaDon.toLocaleString('vi-VN')} đ
                                  </span>
                                )}
                                <span className="font-bold text-zinc-900 text-sm md:text-base">
                                  Tổng: {Number(order.tong_tien).toLocaleString('vi-VN')} đ
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handlePrintOrder(order)}
                                  className="bg-zinc-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-all"
                                >
                                  In
                                </button>
                                <button
                                  onClick={() => handleDeleteOrder(order.id, order.ma_hoa_don)}
                                  className="bg-white border border-red-200 text-red-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-all"
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-zinc-700">
                            <p className="font-semibold text-zinc-500 mb-1 uppercase tracking-wider text-[10px]">Chi tiết sản phẩm:</p>
                            <ul className="list-disc list-inside space-y-1 text-[11px] md:text-xs">
                              {order.items?.map((item) => {
                                const lineGiamGia = Number(item.giam_gia_item ?? item.giam_gia ?? 0);
                                const donGiaGoc = Number(item.don_gia);
                                const totalGoc = donGiaGoc * Number(item.so_luong);
                                const percent = totalGoc > 0 ? (lineGiamGia / totalGoc) * 100 : 0;

                                return (
                                  <li key={item.id || item.ma_san_pham}>
                                    <strong className="text-zinc-900">{item.ma_san_pham}</strong> - {item.ten_san_pham} (Size {item.size}) x{' '}
                                    <strong className="text-zinc-900">{item.so_luong}</strong> ={' '}
                                    <span className="font-semibold text-zinc-900">
                                      {Number(item.thanh_tien || (totalGoc - lineGiamGia)).toLocaleString('vi-VN')} đ
                                    </span>
                                    {lineGiamGia > 0 && (
                                      <span className="text-red-600 font-medium ml-1">
                                        (-{lineGiamGia.toLocaleString('vi-VN')} đ)
                                      </span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-zinc-400 text-sm py-6 text-center border border-dashed border-zinc-200 rounded-xl">
                    Không có hóa đơn nào trong ngày {new Date(selectedDate).toLocaleDateString('vi-VN')}.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* KHUNG IN HÓA ĐƠN KHI BẤM IN */}
      {orderToPrint && printSummary && (
        <div id="print-receipt-area" className="hidden print:block">
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0' }}>CỬA HÀNG VIỆT TIẾN</h2>
            <p style={{ margin: '2px 0' }}>ĐC: 552 Đường Độc Lập, Phường Phú Mỹ, TP. Hồ Chí Minh</p>
            <p style={{ margin: '2px 0' }}>SĐT: 037.686.0039</p>
            <p style={{ margin: '2px 0' }}>MST: 0376860039</p>
            <h3 style={{ fontSize: '13px', fontWeight: 'bold', margin: '8px 0 2px 0' }}>HÓA ĐƠN THANH TOÁN</h3>
            <p style={{ margin: '0' }}>Mã HD: {orderToPrint.ma_hoa_don}</p>
            <p style={{ margin: '0' }}>
              Ngày: {new Date(orderToPrint.ngay_tao).toLocaleString('vi-VN')}
            </p>
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>

          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ padding: '2px 0' }}>Chi tiết sản phẩm</th>
              </tr>
            </thead>
            <tbody>
              {orderToPrint.items?.map((item, idx) => {
                const donGiaGoc = Number(item.don_gia);
                const soLuong = Number(item.so_luong);
                const totalGoc = donGiaGoc * soLuong;
                
                const giamGiaTien = Number(item.giam_gia_item ?? item.giam_gia ?? 0);
                const giamGiaPercent = item.giam_gia_percent !== undefined 
                  ? Number(item.giam_gia_percent)
                  : totalGoc > 0 ? (giamGiaTien / totalGoc) * 100 : 0;

                const lineFinal = Number(item.thanh_tien ?? (totalGoc - giamGiaTien));

                return (
                  <tr key={idx} style={{ borderBottom: '1px dashed #ccc' }}>
                    <td style={{ padding: '4px 0' }}>
                      <div style={{ fontWeight: 'bold' }}>
                        {item.ten_san_pham} (Size {item.size}) x {soLuong}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', marginTop: '2px' }}>
                        <span>Giá: {donGiaGoc.toLocaleString('vi-VN')}</span>
                        {giamGiaTien > 0 ? (
                          <span>Giảm: -{giamGiaPercent.toFixed(0)}% (-{giamGiaTien.toLocaleString('vi-VN')})</span>
                        ) : (
                          <span>Giảm: 0</span>
                        )}
                        <span style={{ fontWeight: 'bold' }}>={lineFinal.toLocaleString('vi-VN')} đ</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ borderTop: '1px solid #000', margin: '6px 0' }}></div>

          <div style={{ fontSize: '10px', lineHeight: '1.5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>Tổng tiền hàng:</span>
              <span>{printSummary.tongTienHang.toLocaleString('vi-VN')} đ</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>Tổng tiền giảm:</span>
              <span>-{printSummary.tongGiamMon.toLocaleString('vi-VN')} đ</span>
            </div>

            {printSummary.giamGiaThem > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Tiền giảm thêm:</span>
                <span>-{printSummary.giamGiaThem.toLocaleString('vi-VN')} đ</span>
              </div>
            )}

            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', margin: '4px 0' }}>
              <span>TỔNG CỘNG:</span>
              <span>{printSummary.tongCong.toLocaleString('vi-VN')} đ</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #000', margin: '6px 0' }}></div>

          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <p style={{ margin: '2px 0', fontStyle: 'italic' }}>Cảm ơn quý khách & Hẹn gặp lại!</p>
          </div>
        </div>
      )}
    </div>
  );
}