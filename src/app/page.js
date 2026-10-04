'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

const ITEMS_PER_PAGE = 10;

export default function Home() {
  const [mounted, setMounted] = useState(false);
  // Navigation State
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'checkout'

  // Products State
  const [products, setProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1); // State quản lý trang hiện tại
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    totalValue: 0,
    totalDiscountProfit: 0,
    totalValueAfterDiscount: 0,
    stockBySize: {},
  });
  const [searchQuery, setSearchQuery] = useState('');
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
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  });
  const [orderToPrint, setOrderToPrint] = useState(null); // Đơn hàng đang chọn để in

  const fetchProducts = async (query = '') => {
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(query)}`);
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

  // Tính toán dữ liệu phân trang 10 sản phẩm / trang
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

  // --- HÀM THỰC HIỆN IN HÓA ĐƠN ---
  const handlePrintOrder = (order) => {
    setOrderToPrint(order);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // --- CART HANDLERS ---
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
        },
      ]);
    }

    setBuyQuantity(1);
  };

  const handleRemoveFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const subTotal = cart.reduce((sum, item) => sum + Number(item.don_gia) * Number(item.so_luong), 0);
  const finalTotal = Math.max(0, subTotal - Number(orderDiscount || 0));

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Giỏ hàng trống!');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
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
          items: cart.map((item) => ({ ...item, thanh_tien: item.don_gia * item.so_luong })),
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

  // --- PRODUCT FORM HANDLERS ---
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setCurrentPage(1); // Reset về trang 1 khi tìm kiếm
    fetchProducts(value);
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

  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-900">
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

      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col p-4 shadow-lg shrink-0 no-print">
        <div className="text-xl font-bold mb-8 px-2 tracking-wide text-blue-400 border-b border-slate-700 pb-4">
          BÁN HÀNG & KHO
        </div>
        <nav className="flex flex-col space-y-2">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition ${
              activeTab === 'products'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Quản lý sản phẩm
          </button>
          <button
            onClick={() => setActiveTab('checkout')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition ${
              activeTab === 'checkout'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Thanh toán & Lịch sử
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-8 overflow-y-auto no-print">
        {/* TAB 1: QUẢN LÝ SẢN PHẨM */}
        {activeTab === 'products' && (
          <div>
            <h1 className="text-2xl font-bold mb-6 text-gray-900">Quản Lý Sản Phẩm & Tồn Kho</h1>

            {/* DASHBOARD TỔNG QUAN */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg shadow-sm">
                <p className="text-xs font-medium text-blue-600 uppercase">Tổng Số Sản Phẩm</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{stats.totalProducts || 0} mã</p>
              </div>
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg shadow-sm">
                <p className="text-xs font-medium text-green-600 uppercase">Tổng Tồn Kho</p>
                <p className="text-2xl font-bold text-green-900 mt-1">{stats.totalStock || 0} cái</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg shadow-sm">
                <p className="text-xs font-medium text-purple-600 uppercase">Tổng Giá Trị Tiền Hàng (Giá Gốc)</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {Number(stats.totalValue || 0).toLocaleString('vi-VN')} đ
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg shadow-sm">
                <p className="text-xs font-medium text-amber-700 uppercase">Tổng Tiền Hàng Sau Chiết Khấu</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">
                  {Number(stats.totalValueAfterDiscount || 0).toLocaleString('vi-VN')} đ
                </p>
                <p className="text-xs text-emerald-600 font-semibold mt-1">
                  (Tiền lời chiết khấu: +{Number(stats.totalDiscountProfit || 0).toLocaleString('vi-VN')} đ)
                </p>
              </div>
            </div>

            {/* THỐNG KÊ THEO SIZE */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Tồn Kho Theo Loại Size:</h3>
              {stats.stockBySize && Object.keys(stats.stockBySize).length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {Object.entries(stats.stockBySize)
                    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                    .map(([size, count]) => (
                      <div key={size} className="bg-gray-50 border border-blue-200 rounded-lg p-3 text-center shadow-sm">
                        <span className="block text-xs text-gray-500 uppercase font-bold">Size</span>
                        <span className="block text-xl font-extrabold text-blue-600 my-0.5">{size}</span>
                        <span className="block text-sm font-medium text-gray-700">{count} cái</span>
                      </div>
                    ))}
                </div>
              ) : (
                <span className="text-gray-400 text-sm">Chưa có dữ liệu tồn kho theo size</span>
              )}
            </div>

            {/* FORM THÊM / SỬA SẢN PHẨM */}
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-8 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">{editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2>
              <div className="grid grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="Mã sản phẩm"
                  value={formData.ma_san_pham}
                  onChange={(e) => setFormData({ ...formData, ma_san_pham: e.target.value })}
                  className="border border-gray-300 p-2 rounded bg-white text-gray-900"
                  required
                />
                <input
                  type="text"
                  placeholder="Tên sản phẩm"
                  value={formData.ten_san_pham}
                  onChange={(e) => setFormData({ ...formData, ten_san_pham: e.target.value })}
                  className="border border-gray-300 p-2 rounded bg-white text-gray-900"
                  required
                />
                <input
                  type="number"
                  placeholder="Giá gốc"
                  value={formData.gia}
                  onChange={(e) => setFormData({ ...formData, gia: e.target.value })}
                  className="border border-gray-300 p-2 rounded bg-white text-gray-900"
                  required
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Chiết khấu / Tiền lời (%)"
                  value={formData.chiet_khau}
                  onChange={(e) => setFormData({ ...formData, chiet_khau: e.target.value })}
                  className="border border-gray-300 p-2 rounded bg-white text-gray-900"
                />
              </div>

              <div className="space-y-2">
                <label className="font-medium text-sm block text-gray-700">Danh sách Biến thể (Size & Tồn kho):</label>
                {formData.variants.map((v, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Size (VD: 41)"
                      value={v.size}
                      onChange={(e) => handleVariantChange(index, 'size', e.target.value)}
                      className="border border-gray-300 p-2 rounded w-1/3 bg-white text-gray-900"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Tồn kho (VD: 10)"
                      value={v.ton_kho}
                      onChange={(e) => handleVariantChange(index, 'ton_kho', e.target.value)}
                      className="border border-gray-300 p-2 rounded w-1/3 bg-white text-gray-900"
                      required
                    />
                    {formData.variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariantRow(index)}
                        className="bg-red-500 text-white px-3 py-2 rounded text-sm hover:bg-red-600"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addVariantRow}
                  className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm mt-2 hover:bg-gray-800"
                >
                  + Thêm size
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  {editingId ? 'Cập nhật' : 'Thêm mới'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ ma_san_pham: '', ten_san_pham: '', gia: '', chiet_khau: 0, variants: [{ size: '', ton_kho: '' }] });
                    }}
                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>

            {/* TÌM KIẾM */}
            <div className="mb-4 flex items-center gap-2">
              <input
                type="text"
                placeholder="Tìm kiếm theo Mã sản phẩm..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full border border-gray-300 p-2 rounded bg-white text-gray-900 shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                    fetchProducts('');
                  }}
                  className="bg-gray-300 text-gray-800 px-3 py-2 rounded text-sm whitespace-nowrap"
                >
                  Xóa tìm
                </button>
              )}
            </div>

            {/* BẢNG SẢN PHẨM */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <h2 className="text-lg font-bold text-gray-800 p-4 border-b">Danh Sách Sản Phẩm</h2>
              <table className="w-full border-collapse text-left text-gray-900">
                <thead>
                  <tr className="bg-gray-100 text-gray-800">
                    <th className="border-b p-3">Mã SP</th>
                    <th className="border-b p-3">Tên SP</th>
                    <th className="border-b p-3">Giá gốc</th>
                    <th className="border-b p-3 text-center">Chiết khấu</th>
                    <th className="border-b p-3">Giá niêm yết</th>
                    <th className="border-b p-3">Biến thể (Size - Tồn)</th>
                    <th className="border-b p-3 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(currentProducts) && currentProducts.length > 0 ? (
                    currentProducts.map((p) => {
                      const chietKhau = Number(p.chiet_khau) || 0;
                      const giaGoc = Number(p.gia) || 0;
                      const tienLoi = (giaGoc * chietKhau) / 100;

                      return (
                        <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 font-medium">{p.ma_san_pham}</td>
                          <td className="p-3">{p.ten_san_pham}</td>
                          <td className="p-3 font-semibold">{giaGoc.toLocaleString('vi-VN')} đ</td>
                          <td className="p-3 text-center">
                            {chietKhau > 0 ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="bg-emerald-100 text-emerald-800 font-bold text-xs px-2 py-0.5 rounded">
                                  +{chietKhau}%
                                </span>
                                <span className="text-xs text-emerald-700 mt-0.5 font-medium">
                                  (+{tienLoi.toLocaleString('vi-VN')} đ)
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">0%</span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-green-700">{giaGoc.toLocaleString('vi-VN')} đ</td>
                          <td className="p-3">
                            {p.variants && p.variants.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {[...p.variants]
                                  .sort((a, b) =>
                                    String(a.size).localeCompare(String(b.size), undefined, { numeric: true })
                                  )
                                  .map((v) => (
                                    <span
                                      key={v.id || `${v.size}-${v.ton_kho}`}
                                      className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium px-2 py-1 rounded"
                                    >
                                      <span>Size <strong>{v.size}</strong>:</span>
                                      <span className="text-blue-700 font-bold">{v.ton_kho} cái</span>
                                    </span>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Chưa có biến thể</span>
                            )}
                          </td>
                          <td className="p-3 text-center space-x-2">
                            <button
                              onClick={() => handleEdit(p)}
                              className="bg-yellow-500 text-white px-2.5 py-1 rounded text-sm hover:bg-yellow-600"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="bg-red-600 text-white px-2.5 py-1 rounded text-sm hover:bg-red-700"
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center p-6 text-gray-500">
                        Chưa có sản phẩm nào
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* THANH ĐIỀU HƯỚNG PHÂN TRANG */}
              {products.length > 0 && (
                <div className="flex items-center justify-between p-4 border-t border-gray-200 text-sm text-gray-600 bg-gray-50">
                  <div>
                    Hiển thị <b>{startIndex + 1}</b> - <b>{Math.min(startIndex + ITEMS_PER_PAGE, products.length)}</b> trên tổng số <b>{products.length}</b> sản phẩm
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      Trước
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`px-3 py-1.5 rounded border font-medium transition ${
                          currentPage === page
                            ? 'bg-blue-600 text-white border-blue-600 font-bold'
                            : 'bg-white border-gray-300 hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
            <h1 className="text-2xl font-bold mb-6 text-gray-900">Thanh Toán & Lịch Sử Giao Dịch</h1>

            {/* KHU VỰC TẠO ĐƠN HÀNG */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">TẠO ĐƠN HÀNG MỚI</h2>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4 items-center">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Lọc mã/tên SP..."
                    value={checkoutProductSearch}
                    onChange={(e) => setCheckoutProductSearch(e.target.value)}
                    className="w-full border border-gray-300 p-2 rounded bg-white text-gray-900 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                  />
                  {checkoutProductSearch && (
                    <button
                      onClick={() => setCheckoutProductSearch('')}
                      className="absolute right-2 top-2 text-xs text-gray-400 hover:text-gray-600"
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
                  className="border border-gray-300 p-2 rounded bg-white text-gray-900 font-medium text-sm"
                >
                  <option value="">-- Chọn Sản phẩm ({filteredCheckoutProducts.length}) --</option>
                  {filteredCheckoutProducts.map((p) => (
                    <option key={p.id} value={p.ma_san_pham}>
                      {p.ma_san_pham} - {p.ten_san_pham} ({Number(p.gia).toLocaleString('vi-VN')} đ)
                    </option>
                  ))}
                </select>

                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  disabled={!selectedProduct}
                  className="border border-gray-300 p-2 rounded bg-white text-gray-900 font-medium text-sm disabled:bg-gray-100"
                >
                  <option value="">-- Chọn Size --</option>
                  {selectedProdObj?.variants
                    ?.sort((a, b) => String(a.size).localeCompare(String(b.size), undefined, { numeric: true }))
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
                  className="border border-gray-300 p-2 rounded bg-white text-gray-900 text-sm"
                />

                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="bg-green-600 text-white font-bold px-4 py-2 rounded hover:bg-green-700 transition text-sm"
                >
                  + Thêm vào giỏ
                </button>
              </div>

              {cart.length > 0 && (
                <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm mt-4 p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Giỏ hàng hiện tại:</h3>
                  <table className="w-full text-sm text-left border-collapse mb-4">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700">
                        <th className="p-2 border">Mã SP</th>
                        <th className="p-2 border">Tên SP</th>
                        <th className="p-2 border">Size</th>
                        <th className="p-2 border">Đơn giá gốc</th>
                        <th className="p-2 border">Số lượng</th>
                        <th className="p-2 border">Thành tiền</th>
                        <th className="p-2 border text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2 border font-medium">{item.ma_san_pham}</td>
                          <td className="p-2 border">{item.ten_san_pham}</td>
                          <td className="p-2 border text-blue-600 font-bold">Size {item.size}</td>
                          <td className="p-2 border">{Number(item.don_gia).toLocaleString('vi-VN')} đ</td>
                          <td className="p-2 border font-bold">{item.so_luong}</td>
                          <td className="p-2 border font-bold text-green-700">
                            {(Number(item.don_gia) * Number(item.so_luong)).toLocaleString('vi-VN')} đ
                          </td>
                          <td className="p-2 border text-center">
                            <button
                              onClick={() => handleRemoveFromCart(index)}
                              className="text-red-600 font-bold hover:underline"
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-gray-700">Giảm giá thêm (VNĐ):</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Nhập số tiền giảm"
                        value={orderDiscount}
                        onChange={(e) => setOrderDiscount(e.target.value)}
                        className="border border-gray-300 p-2 rounded bg-white text-gray-900 w-48"
                      />
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-gray-500">Tạm tính: {subTotal.toLocaleString('vi-VN')} đ</p>
                      {Number(orderDiscount) > 0 && (
                        <p className="text-xs text-red-500 font-semibold">
                          Giảm giá: -{Number(orderDiscount).toLocaleString('vi-VN')} đ
                        </p>
                      )}
                      <span className="text-lg font-bold text-gray-800">
                        Thành tiền: <strong className="text-red-600 text-xl">{finalTotal.toLocaleString('vi-VN')} đ</strong>
                      </span>
                    </div>

                    <button
                      onClick={handleCheckout}
                      className="bg-blue-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-blue-700 shadow transition flex items-center gap-2"
                    >
                      THANH TOÁN & IN
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* BỘ LỌC VÀ THỐNG KÊ DOANH THU */}
            <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm mb-8">
              <h2 className="text-lg font-bold text-gray-800 mb-4">THỐNG KÊ DOANH THU & LỊCH SỬ</h2>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <label htmlFor="filter-date" className="font-semibold text-gray-700 text-sm">
                    Chọn ngày xem lịch sử:
                  </label>
                  <input
                    id="filter-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-gray-300 p-2 rounded bg-white text-gray-900 font-medium shadow-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* CARD TỔNG TIỀN */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg shadow-sm">
                  <p className="text-xs font-semibold text-emerald-700 uppercase">
                    Tổng Doanh Thu Ngày ({new Date(selectedDate).toLocaleDateString('vi-VN')})
                  </p>
                  <p className="text-2xl font-black text-emerald-800 mt-1">
                    {historyStats.totalBySelectedDate.toLocaleString('vi-VN')} đ
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg shadow-sm">
                  <p className="text-xs font-semibold text-blue-700 uppercase">
                    Tổng Doanh Thu Tháng ({historyStats.filterMonthDisplay})
                  </p>
                  <p className="text-2xl font-black text-blue-800 mt-1">
                    {historyStats.totalBySelectedMonth.toLocaleString('vi-VN')} đ
                  </p>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg shadow-sm">
                  <p className="text-xs font-semibold text-indigo-700 uppercase">Tổng Doanh Thu Toàn Bộ</p>
                  <p className="text-2xl font-black text-indigo-800 mt-1">
                    {historyStats.grandTotal.toLocaleString('vi-VN')} đ
                  </p>
                </div>
              </div>

              {/* DANH SÁCH LỊCH SỬ ĐƠN HÀNG */}
              <div>
                <h3 className="font-bold text-gray-800 mb-3">
                  Danh sách hóa đơn ngày {new Date(selectedDate).toLocaleDateString('vi-VN')}:
                </h3>
                {historyStats.filteredOrders.length > 0 ? (
                  <div className="space-y-4">
                    {historyStats.filteredOrders.map((order) => {
                      const giamGia = Number(order.giam_gia) || 0;
                      return (
                        <div key={order.id || order.ma_hoa_don} className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
                          <div className="flex justify-between items-center border-b pb-2 mb-2">
                            <div>
                              <span className="font-bold text-blue-600">{order.ma_hoa_don}</span>
                              <span className="text-xs text-gray-500 ml-3">
                                {new Date(order.ngay_tao).toLocaleTimeString('vi-VN')} - {new Date(order.ngay_tao).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                {giamGia > 0 && (
                                  <span className="block text-xs text-red-500 font-medium">
                                    Đã giảm giá: -{giamGia.toLocaleString('vi-VN')} đ
                                  </span>
                                )}
                                <span className="font-extrabold text-red-600">
                                  Tổng: {Number(order.tong_tien).toLocaleString('vi-VN')} đ
                                </span>
                              </div>
                              <button
                                onClick={() => handlePrintOrder(order)}
                                className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-slate-700 transition"
                              >
                                🖨️ In Hóa Đơn
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(order.id, order.ma_hoa_don)}
                                className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-red-700 transition"
                              >
                                🗑️ Xóa đơn
                              </button>
                            </div>
                          </div>
                          <div className="text-sm text-gray-700">
                            <p className="font-semibold text-xs text-gray-500 mb-1">Chi tiết sản phẩm:</p>
                            <ul className="list-disc list-inside space-y-1">
                              {order.items?.map((item) => (
                                <li key={item.id || item.ma_san_pham}>
                                  <strong className="text-gray-900">{item.ma_san_pham}</strong> - {item.ten_san_pham} (Size{' '}
                                  <span className="text-blue-600 font-bold">{item.size}</span>) x{' '}
                                  <strong className="text-gray-900">{item.so_luong}</strong> ={' '}
                                  <span className="text-green-700 font-semibold">
                                    {Number(item.thanh_tien || item.don_gia * item.so_luong).toLocaleString('vi-VN')} đ
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm py-4 text-center border border-dashed border-gray-300 rounded">
                    Không có hóa đơn nào trong ngày {new Date(selectedDate).toLocaleDateString('vi-VN')}.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* KHUNG IN HÓA ĐƠN */}
      {orderToPrint && (
        <div id="print-receipt-area" className="hidden print:block">
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0' }}>CỬA HÀNG VIỆT TIẾN</h2>
            <p style={{ margin: '2px 0' }}>ĐC: 552 Đường Độc Lập, Phường Phú Mỹ, TP. Hồ Chí Minh</p>
            <p style={{ margin: '2px 0' }}>SĐT: 037.686.0039</p>
            <h3 style={{ fontSize: '13px', fontWeight: 'bold', margin: '8px 0 2px 0' }}>HÓA ĐƠN THANH TOÁN</h3>
            <p style={{ margin: '0' }}>Mã HD: {orderToPrint.ma_hoa_don}</p>
            <p style={{ margin: '0' }}>
              Ngày: {new Date(orderToPrint.ngay_tao).toLocaleString('vi-VN')}
            </p>
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>

          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ padding: '2px 0' }}>Tên SP</th>
                <th style={{ padding: '2px 0' }}>Size</th>
                <th style={{ textAlign: 'center' }}>SL</th>
                <th style={{ textAlign: 'right' }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {orderToPrint.items?.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '3px 0' }}>
                    {item.ten_san_pham}
                  </td>
                  <td style={{ padding: '3px 0' }}>
                    {item.size}
                  </td>
                  <td style={{ textAlign: 'center' }}>{item.so_luong}</td>
                  <td style={{ textAlign: 'right' }}>
                    {Number(item.thanh_tien || item.don_gia * item.so_luong).toLocaleString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '1px solid #000', margin: '6px 0' }}></div>

          <div style={{ textAlign: 'right' }}>
            {Number(orderToPrint.giam_gia) > 0 && (
              <p style={{ margin: '2px 0' }}>
                Giảm giá: -{Number(orderToPrint.giam_gia).toLocaleString('vi-VN')} đ
              </p>
            )}
            <p style={{ fontSize: '13px', fontWeight: 'bold', margin: '4px 0' }}>
              TỔNG CỘNG: {Number(orderToPrint.tong_tien).toLocaleString('vi-VN')} đ
            </p>
          </div>

          <div style={{ borderTop: '1px solid #000', margin: '6px 0' }}></div>

          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <p style={{ margin: '2px 0', italic: 'true' }}>Cảm ơn quý khách & Hẹn gặp lại!</p>
          </div>
        </div>
      )}
    </div>
  );
}