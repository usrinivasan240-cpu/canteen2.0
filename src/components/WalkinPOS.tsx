import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, ShoppingCart, X, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone,
  CheckCircle, Clock, User, Phone, Hash, FileText, Printer, Download, QrCode,
  AlertTriangle, Wifi, WifiOff, RefreshCw, StickyNote, ChevronDown, Receipt
} from 'lucide-react';
import QRCode from 'qrcode';
import { MenuItem, WalkinCartItem, WalkinBill } from '../types';
import { API_BASE } from '../config';

interface WalkinPOSProps {
  menuItems: MenuItem[];
  canteenId: string;
  subCanteenId?: string;
  cashierName: string;
  onBillCreated: () => void;
  onLogout: () => void;
}

const TAX_RATE = 0.05;

const DB_NAME = 'VioletBitesPOS';
const DB_VERSION = 1;
const STORE_NAME = 'pending_bills';

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveOfflineBill(bill: WalkinBill): Promise<void> {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(bill);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getOfflineBills(): Promise<WalkinBill[]> {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function removeOfflineBill(id: string): Promise<void> {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function generateBillId(): string {
  return 'WB' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function generateBillNumber(): string {
  const d = new Date();
  const prefix = 'VB';
  const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `${prefix}-${datePart}-${seq}`;
}

export default function WalkinPOS({
  menuItems,
  canteenId,
  subCanteenId,
  cashierName,
  onBillCreated,
}: WalkinPOSProps) {
  const [cart, setCart] = useState<WalkinCartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerRegNo, setCustomerRegNo] = useState('');
  const [customerDept, setCustomerDept] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'netbanking' | 'wallet' | 'other'>('cash');
  const [pendingReason, setPendingReason] = useState('');
  const [pendingExpectedTime, setPendingExpectedTime] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineBills, setOfflineBills] = useState<WalkinBill[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastBill, setLastBill] = useState<WalkinBill | null>(null);
  const [showQRPayment, setShowQRPayment] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [receiptQrUrl, setReceiptQrUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSpecialIdx, setActiveSpecialIdx] = useState<number | null>(null);
  const [specialText, setSpecialText] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    syncOfflineBills();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncOfflineBills = async () => {
    try {
      const bills = await getOfflineBills();
      setOfflineBills(bills);
      if (bills.length > 0 && navigator.onLine) {
        for (const bill of bills) {
          try {
            await fetch(`${API_BASE}/api/canteen/walkin-bill`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...bill, synced: true }),
            });
            await removeOfflineBill(bill.id);
          } catch { break; }
        }
        setOfflineBills(await getOfflineBills());
      }
    } catch { /* ignore */ }
  };

  const categories = useMemo(() => {
    const cats = new Set(menuItems.filter(i => i.available && !i.isPaused).map(i => i.category));
    return ['All', ...Array.from(cats)];
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      if (!item.available || item.isPaused) return false;
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [menuItems, searchQuery, selectedCategory]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.itemId === item.id);
      if (existing) {
        return prev.map(c => c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { itemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateCartQty = (itemId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.itemId !== itemId));
    } else {
      setCart(prev => prev.map(c => c.itemId === itemId ? { ...c, quantity: qty } : c));
    }
  };

  const removeCartItem = (itemId: string) => {
    setCart(prev => prev.filter(c => c.itemId !== itemId));
  };

  const updateSpecialInstructions = (itemId: string, text: string) => {
    setCart(prev => prev.map(c => c.itemId === itemId ? { ...c, specialInstructions: text } : c));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = subtotal * TAX_RATE;
  const grandTotal = subtotal + taxAmount - discount;

  const generateQRForPayment = async () => {
    const upiString = `upi://pay?pa=canteen@upi&pn=Violet%20Bites&am=${grandTotal.toFixed(2)}&cu=INR&tn=Walk-in%20Bill`;
    try {
      const url = await QRCode.toDataURL(upiString, { width: 200, margin: 2 });
      setQrDataUrl(url);
      setShowQRPayment(true);
    } catch { /* ignore */ }
  };

  const handleGenerateBill = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);

    const bill: WalkinBill = {
      id: generateBillId(),
      billNumber: generateBillNumber(),
      items: [...cart],
      subtotal,
      discount,
      tax: taxAmount,
      grandTotal,
      paymentStatus,
      paymentMethod: paymentStatus === 'paid' ? paymentMethod : undefined,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      customerRegNo: customerRegNo || undefined,
      customerDept: customerDept || undefined,
      customerNotes: customerNotes || undefined,
      pendingReason: paymentStatus === 'pending' ? pendingReason || undefined : undefined,
      pendingExpectedTime: paymentStatus === 'pending' ? pendingExpectedTime || undefined : undefined,
      cashierName,
      canteenId,
      subCanteenId,
      timestamp: new Date().toISOString(),
      createdAt: Date.now(),
      synced: false,
      type: 'walkin',
    };

    try {
      if (!navigator.onLine) throw new Error('offline');
      const resp = await fetch(`${API_BASE}/api/canteen/walkin-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bill),
      });
      const data = await resp.json();
      if (data.success) {
        bill.synced = true;
        bill.id = data.bill?.id || bill.id;
      }
    } catch {
      await saveOfflineBill(bill);
    }

    setOfflineBills(await getOfflineBills().catch(() => []));
    setLastBill(bill);
    setShowReceipt(true);

    // Generate receipt QR code
    try {
      const qrPayload = JSON.stringify({ bill: bill.billNumber, total: bill.grandTotal, date: bill.createdAt, verify: `${API_BASE}/api/canteen/qr/verify` });
      const url = await QRCode.toDataURL(qrPayload, { width: 150, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
      setReceiptQrUrl(url);
    } catch { setReceiptQrUrl(''); }

    setCart([]);
    setDiscount(0);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerRegNo('');
    setCustomerDept('');
    setCustomerNotes('');
    setPendingReason('');
    setPendingExpectedTime('');
    setIsProcessing(false);
    onBillCreated();
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const w = window.open('', '_blank', 'width=400,height=700');
    if (!w) return;
    w.document.write(`
      <html><head><title>Bill</title>
      <style>
        body{font-family:'Courier New',monospace;margin:0;padding:16px;font-size:12px;color:#000;max-width:300px;margin:auto}
        .center{text-align:center}.bold{font-weight:bold}.line{border-top:1px dashed #000;margin:8px 0}
        table{width:100%;border-collapse:collapse}td{padding:2px 0}
        .right{text-align:right}
      </style></head><body>
      ${printContent.innerHTML}
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-4">
      {/* Connectivity Banner */}
      {!isOnline && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <WifiOff className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-800">Offline Mode Active</p>
            <p className="text-[10px] text-amber-600">Bills will be saved locally and synced when connection returns.</p>
          </div>
          {offlineBills.length > 0 && (
            <span className="ml-auto bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-full">
              {offlineBills.length} pending sync
            </span>
          )}
        </div>
      )}

      {isOnline && offlineBills.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-blue-800">Syncing {offlineBills.length} offline bill(s)...</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* LEFT: Menu + Search */}
        <div className="xl:col-span-8 space-y-4">
          {/* Search & Category Filter */}
          <div className="bg-white p-4 rounded-2xl border border-violet-100 shadow-xs space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search food by name, category..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-violet-50/30 hover:bg-violet-50/60 focus:bg-white text-xs pl-10 pr-4 py-3 border border-violet-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 font-sans transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-full whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Food Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredItems.map(item => {
              const inCart = cart.find(c => c.itemId === item.id);
              const stockLeft = item.stock - item.bookedToday;
              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  disabled={stockLeft <= 0}
                  className={`relative bg-white p-3 rounded-2xl border text-left transition-all cursor-pointer group ${
                    inCart
                      ? 'border-violet-400 ring-2 ring-violet-200 shadow-md'
                      : stockLeft <= 0
                        ? 'border-gray-100 opacity-50 cursor-not-allowed'
                        : 'border-violet-100 hover:border-violet-300 hover:shadow-md active:scale-95'
                  }`}
                >
                  {inCart && (
                    <span className="absolute -top-2 -right-2 bg-violet-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow">
                      {inCart.quantity}
                    </span>
                  )}
                  {item.imageUrl ? (
                    <div className="w-full h-20 rounded-xl bg-violet-50 overflow-hidden mb-2">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-20 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 flex items-center justify-center mb-2 text-2xl">
                      🍽️
                    </div>
                  )}
                  <p className="font-display font-bold text-[11px] text-gray-900 truncate">{item.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono font-bold text-xs text-violet-700">₹{item.price}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      stockLeft > 5 ? 'bg-emerald-50 text-emerald-700' : stockLeft > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {stockLeft > 0 ? `${stockLeft} left` : 'Out'}
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-400 mt-0.5 block">{item.category} · {item.prepTime}min</span>
                </button>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400 text-xs">
                No items found. Try a different search or category.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Cart + Payment */}
        <div className="xl:col-span-4 space-y-4">
          {/* Cart */}
          <div className="bg-white p-4 rounded-2xl border border-violet-100 shadow-xs">
            <div className="flex items-center justify-between border-b border-violet-50 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-violet-600" />
                <span className="font-display font-bold text-sm text-gray-900">Cart</span>
                <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {cart.reduce((s, c) => s + c.quantity, 0)}
                </span>
              </div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-red-400 hover:text-red-600 text-[10px] font-bold cursor-pointer">
                  Clear All
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Click items to add to cart</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {cart.map((item, idx) => (
                  <div key={item.itemId} className="bg-violet-50/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-sans font-semibold text-[11px] text-gray-900 truncate">{item.name}</p>
                        <p className="font-mono text-[10px] text-violet-600">₹{item.price} each</p>
                      </div>
                      <button onClick={() => removeCartItem(item.itemId)} className="text-red-400 hover:text-red-600 ml-2 cursor-pointer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartQty(item.itemId, item.quantity - 1)}
                          className="w-6 h-6 rounded-lg bg-white border border-violet-200 flex items-center justify-center hover:bg-violet-50 cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateCartQty(item.itemId, parseInt(e.target.value) || 0)}
                          className="w-10 text-center text-xs font-bold bg-transparent border-none outline-none"
                          min={1}
                        />
                        <button
                          onClick={() => updateCartQty(item.itemId, item.quantity + 1)}
                          className="w-6 h-6 rounded-lg bg-white border border-violet-200 flex items-center justify-center hover:bg-violet-50 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-mono font-bold text-xs text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    {/* Special Instructions */}
                    {activeSpecialIdx === idx ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={item.specialInstructions || ''}
                          onChange={e => updateSpecialInstructions(item.itemId, e.target.value)}
                          placeholder="Special instructions..."
                          className="flex-1 text-[10px] px-2 py-1 border border-violet-200 rounded-lg outline-none"
                          autoFocus
                        />
                        <button onClick={() => setActiveSpecialIdx(null)} className="text-violet-600 text-[10px] font-bold cursor-pointer">OK</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setActiveSpecialIdx(idx); setSpecialText(item.specialInstructions || ''); }}
                        className="text-[9px] text-violet-500 hover:text-violet-700 flex items-center gap-1 cursor-pointer"
                      >
                        <StickyNote className="h-2.5 w-2.5" />
                        {item.specialInstructions ? item.specialInstructions : 'Add note'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Details */}
          <div className="bg-white p-4 rounded-2xl border border-violet-100 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-violet-50 pb-2">
              <User className="h-4 w-4 text-violet-600" />
              <span className="font-display font-bold text-sm text-gray-900">Customer (Optional)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Name" value={customerName} onChange={e => setCustomerName(e.target.value)}
                className="bg-violet-50/30 text-xs px-3 py-2 border border-violet-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-400 font-sans" />
              <input type="tel" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                className="bg-violet-50/30 text-xs px-3 py-2 border border-violet-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-400 font-sans" />
              <input type="text" placeholder="Reg Number" value={customerRegNo} onChange={e => setCustomerRegNo(e.target.value)}
                className="bg-violet-50/30 text-xs px-3 py-2 border border-violet-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-400 font-sans" />
              <input type="text" placeholder="Department" value={customerDept} onChange={e => setCustomerDept(e.target.value)}
                className="bg-violet-50/30 text-xs px-3 py-2 border border-violet-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-400 font-sans" />
            </div>
            <textarea placeholder="Notes..." value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} rows={1}
              className="w-full bg-violet-50/30 text-xs px-3 py-2 border border-violet-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-400 font-sans resize-none" />
          </div>

          {/* Payment */}
          <div className="bg-white p-4 rounded-2xl border border-violet-100 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-violet-50 pb-2">
              <CreditCard className="h-4 w-4 text-violet-600" />
              <span className="font-display font-bold text-sm text-gray-900">Payment</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPaymentStatus('paid')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  paymentStatus === 'paid' ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                <CheckCircle className="h-3.5 w-3.5 inline mr-1" /> PAID
              </button>
              <button
                onClick={() => setPaymentStatus('pending')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  paymentStatus === 'pending' ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Clock className="h-3.5 w-3.5 inline mr-1" /> PENDING
              </button>
            </div>

            {paymentStatus === 'paid' && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cash' as const, label: 'Cash', icon: Banknote },
                  { id: 'upi' as const, label: 'UPI', icon: Smartphone },
                  { id: 'card' as const, label: 'Card', icon: CreditCard },
                  { id: 'netbanking' as const, label: 'Net Bank', icon: FileText },
                  { id: 'wallet' as const, label: 'Wallet', icon: Wallet },
                  { id: 'other' as const, label: 'Other', icon: Hash },
                ].map(m => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setPaymentMethod(m.id);
                        if (m.id === 'upi') generateQRForPayment();
                      }}
                      className={`py-2 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        paymentMethod === m.id ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-400' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}

            {paymentStatus === 'pending' && (
              <div className="space-y-2">
                <input type="text" placeholder="Reason (e.g. will pay after lab)" value={pendingReason} onChange={e => setPendingReason(e.target.value)}
                  className="w-full bg-violet-50/30 text-xs px-3 py-2 border border-violet-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-400 font-sans" />
                <input type="text" placeholder="Expected payment time (e.g. 2:00 PM)" value={pendingExpectedTime} onChange={e => setPendingExpectedTime(e.target.value)}
                  className="w-full bg-violet-50/30 text-xs px-3 py-2 border border-violet-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-400 font-sans" />
              </div>
            )}

            {/* QR Payment Display */}
            {showQRPayment && paymentMethod === 'upi' && qrDataUrl && (
              <div className="bg-violet-50 rounded-xl p-4 text-center space-y-2 border border-violet-200">
                <p className="text-[10px] font-bold text-violet-700">Scan to Pay ₹{grandTotal.toFixed(2)}</p>
                <img src={qrDataUrl} alt="UPI QR" className="mx-auto rounded-lg" />
                <button onClick={() => setShowQRPayment(false)} className="text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer">Hide QR</button>
              </div>
            )}
          </div>

          {/* Bill Summary */}
          <div className="bg-white p-4 rounded-2xl border border-violet-100 shadow-xs space-y-3">
            <div className="space-y-2 text-xs font-sans">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-mono font-medium">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Discount</span>
                <div className="flex items-center gap-1">
                  <span className="text-red-500 font-mono">-₹{discount.toFixed(2)}</span>
                  <input
                    type="number"
                    value={discount}
                    onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-16 text-right text-[10px] bg-violet-50/50 border border-violet-100 rounded px-1.5 py-0.5 outline-none"
                    min={0}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tax (5%)</span>
                <span className="font-mono font-medium">₹{taxAmount.toFixed(2)}</span>
              </div>
              <div className="border-t border-violet-100 pt-2 flex justify-between font-bold text-sm">
                <span>Grand Total</span>
                <span className="font-mono text-violet-700 text-base">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleGenerateBill}
              disabled={cart.length === 0 || isProcessing}
              className={`w-full py-3.5 rounded-xl text-xs font-bold tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer font-display ${
                cart.length === 0 || isProcessing
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-750 hover:to-fuchsia-750 text-white active:scale-98'
              }`}
            >
              <Receipt className="h-4 w-4" />
              {isProcessing ? 'Processing...' : 'Generate Bill'}
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && lastBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-violet-100">
            <div className="p-6 text-center border-b border-violet-50">
              <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="font-display font-bold text-lg text-gray-900">Bill Generated!</h3>
              <p className="text-xs text-gray-400 mt-1">{lastBill.billNumber}</p>
              {!lastBill.synced && (
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <WifiOff className="h-3 w-3" /> Saved offline — will sync later
                </span>
              )}
            </div>

            {/* Printable Receipt */}
            <div ref={printRef} className="p-6 font-sans text-xs">
              <div className="text-center mb-4">
                <p className="font-bold text-sm">VIOLET BITES</p>
                <p className="text-[10px] text-gray-400">Smart College Canteen</p>
                <div className="border-t border-dashed border-gray-300 my-3" />
              </div>
              <div className="space-y-1 mb-3">
                <div className="receipt-row"><span className="text-gray-500">Bill No:</span><span className="font-mono font-bold">{lastBill.billNumber}</span></div>
                <div className="receipt-row"><span className="text-gray-500">Date:</span><span>{new Date(lastBill.createdAt).toLocaleDateString()}</span></div>
                <div className="receipt-row"><span className="text-gray-500">Time:</span><span>{new Date(lastBill.createdAt).toLocaleTimeString()}</span></div>
                <div className="receipt-row"><span className="text-gray-500">Cashier:</span><span>{lastBill.cashierName}</span></div>
                {lastBill.customerName && <div className="receipt-row"><span className="text-gray-500">Customer:</span><span>{lastBill.customerName}</span></div>}
              </div>
              <div className="border-t border-dashed border-gray-300 my-3" />
              <table className="receipt-table w-full mb-3">
                <thead>
                  <tr className="text-[9px] text-gray-400 uppercase">
                    <th className="text-left">Item</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lastBill.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-1">{it.name}{it.specialInstructions ? ` (${it.specialInstructions})` : ''}</td>
                      <td className="text-center">{it.quantity}</td>
                      <td className="text-right">₹{it.price}</td>
                      <td className="text-right font-medium">₹{(it.price * it.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-dashed border-gray-300 my-3" />
              <div className="space-y-1">
                <div className="receipt-row"><span>Subtotal</span><span className="font-mono">₹{lastBill.subtotal.toFixed(2)}</span></div>
                <div className="receipt-row"><span>Discount</span><span className="font-mono text-red-500">-₹{lastBill.discount.toFixed(2)}</span></div>
                <div className="receipt-row"><span>Tax</span><span className="font-mono">₹{lastBill.tax.toFixed(2)}</span></div>
                <div className="receipt-row font-bold text-sm border-t border-gray-300 pt-1">
                  <span>Grand Total</span><span className="font-mono">₹{lastBill.grandTotal.toFixed(2)}</span>
                </div>
              </div>
              <div className="border-t border-dashed border-gray-300 my-3" />
              <div className="space-y-1">
                <div className="receipt-row"><span>Payment:</span><span className="font-bold uppercase">{lastBill.paymentStatus} {lastBill.paymentMethod ? `(${lastBill.paymentMethod})` : ''}</span></div>
              </div>
              {receiptQrUrl && (
                <div className="text-center my-4">
                  <div className="inline-block bg-white p-2 rounded-xl border border-gray-200">
                    <img src={receiptQrUrl} alt="Bill QR Code" className="h-28 w-28" />
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1">Scan to verify this bill</p>
                </div>
              )}
              <div className="text-center mt-4">
                <p className="text-[10px] text-gray-400">Thank you for dining with us!</p>
                <p className="text-[9px] text-gray-300">For support: Violet Bites Helpdesk</p>
              </div>
            </div>

            <div className="p-4 border-t border-violet-50 flex gap-2">
              <button onClick={handlePrint} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
              <button onClick={() => { setShowReceipt(false); setLastBill(null); }} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-xs font-bold cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Wallet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}
