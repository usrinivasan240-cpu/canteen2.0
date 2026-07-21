/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  QrCode, ShoppingCart, Sparkles, Star, Plus, Minus, ArrowRight,
  Clock, CheckCircle, Ticket, X, ChevronRight, MessageSquare, Flame, Trash2
} from 'lucide-react';
import { MenuItem, Order, Review, AIRecommendation, College, Canteen, SubCanteen } from '../types';
import { API_BASE } from '../config';

interface CustomerAppProps {
  canteenName: string;
  menuItems: MenuItem[];
  orders: Order[];
  reviews: Review[];
  onOrderPlaced: (cartItems: { itemId: string; name: string; quantity: number }[], pickupSlot: string, canteenId?: string, subCanteenId?: string) => Promise<any>;
  onAddReview: (rating: number, comment: string, menuItemId?: string, menuItemName?: string) => Promise<any>;
  onResetCanteen: () => void;
  userEmail: string;
  onLogout: () => void;
  onCanteenChange: (canteenId: string) => void;
}

export default function CustomerApp({
  canteenName,
  menuItems,
  orders,
  reviews,
  onOrderPlaced,
  onAddReview,
  onResetCanteen,
  userEmail,
  onLogout,
  onCanteenChange
}: CustomerAppProps) {
  // Generate pickup slots
  const generateTimeSlots = () => {
    const slots = ['ASAP (Instant)'];
    const current = new Date();
    let minutes = current.getMinutes();
    let hours = current.getHours();
    
    const remainder = minutes % 15;
    minutes += (15 - remainder);
    if (minutes >= 60) {
      minutes = 0;
      hours += 1;
    }
    
    for (let i = 0; i < 16; i++) {
      const slotMin = minutes.toString().padStart(2, '0');
      let displayHours = hours % 12;
      if (displayHours === 0) displayHours = 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      slots.push(`${displayHours}:${slotMin} ${ampm}`);
      
      minutes += 15;
      if (minutes >= 60) {
        minutes = 0;
        hours += 1;
      }
    }
    return slots;
  };
  
  const availableTimeSlots = generateTimeSlots();

  // Navigation & session state (Initializing as linked to Table 04 to match screenshots!)
  const [scannedTable, setScannedTable] = useState<string>('Table 04');
  const [selectedCategory, setSelectedCategory] = useState<string>('Meals');
  const [cart, setCart] = useState<{ [itemId: string]: number }>({});
  const [selectedSlot, setSelectedSlot] = useState<string>('ASAP (Instant)');
  const [customerTab, setCustomerTab] = useState<'menu' | 'history'>('menu');
  
  // AI Recommendations
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [currentTimeSlot, setCurrentTimeSlot] = useState<string>('Noon (Lunch hour)');

  // Hierarchical College, Canteen, SubCanteen states
  const [colleges, setColleges] = useState<College[]>([]);
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [subCanteens, setSubCanteens] = useState<SubCanteen[]>([]);
  
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('college_001');
  const [selectedCanteenId, setSelectedCanteenId] = useState<string>('canteen_001');
  const [selectedSubCanteenId, setSelectedSubCanteenId] = useState<string>('sub_001');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [colResp, cantResp, subResp] = await Promise.all([
          fetch(`${API_BASE}/api/colleges`),
          fetch(`${API_BASE}/api/canteens`),
          fetch(`${API_BASE}/api/subcanteens`)
        ]);
        const colData = await colResp.json();
        const cantData = await cantResp.json();
        const subData = await subResp.json();
        if (colData.success) setColleges(colData.colleges);
        if (cantData.success) setCanteens(cantData.canteens);
        if (subData.success) setSubCanteens(subData.subCanteens);
      } catch (e) {
        console.error("Failed to fetch hierarchy lists", e);
      }
    };
    fetchData();
  }, []);

  // Checkout, G Pay, and ticket states
  const [showGPayModal, setShowGPayModal] = useState<boolean>(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  
  // Review form state
  const [selectedReviewItem, setSelectedReviewItem] = useState<MenuItem | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewFeedbackText, setReviewFeedbackText] = useState<string>('');

  // Toast message state
  const [toastMessage, setToastMessage] = useState<string>('');
  // QR code generation state
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [qrPayload, setQrPayload] = useState<string>('');

  // Cart helper quantities
  const totalCartCount = (Object.values(cart) as number[]).reduce((a, b) => a + b, 0);
  const cartSubtotal = Object.entries(cart).reduce((sum, [itemId, qty]) => {
    const item = menuItems.find(i => i.id === itemId);
    const itemQuantity = qty as number;
    return sum + (item ? item.price : 0) * itemQuantity;
  }, 0);
  const baseConvenienceFee = cartSubtotal > 0 ? Math.ceil(cartSubtotal / 100) : 0;
  const pgCharge = cartSubtotal > 0 ? ((cartSubtotal + baseConvenienceFee) / 0.9764) - (cartSubtotal + baseConvenienceFee) : 0;
  const totalAmount = cartSubtotal + baseConvenienceFee + pgCharge;
  const displayedConvenienceFee = baseConvenienceFee + pgCharge;

  // Sync latest order state
  useEffect(() => {
    if (successOrder) {
      const match = orders.find(o => o.id === successOrder.id);
      if (match) {
        setSuccessOrder(match);
      }
    }
  }, [orders]);

  // Generate QR code data URL locally when order is placed
  useEffect(() => {
    if (successOrder) {
      const payload = qrPayload || successOrder.id;
      QRCode.toDataURL(payload, {
        width: 180,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      }).then(url => {
        setQrImageUrl(url);
      }).catch(err => {
        console.error('QR generation failed:', err);
        // Fallback: use the order ID as plain text
        setQrImageUrl('');
      });
    }
  }, [successOrder, qrPayload]);

  // Load recommendations when table scan finishes
  useEffect(() => {
    if (scannedTable) {
      triggerAIRecommendations(currentTimeSlot);
    }
  }, [scannedTable, currentTimeSlot]);

  const triggerAIRecommendations = async (slot: string) => {
    setLoadingAi(true);
    try {
      const resp = await fetch(`${API_BASE}/api/ai/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeOfDay: slot,
          orderHistory: orders.map(o => o.items.map(it => it.name)).flat(),
          currentTempCelsius: slot.includes('Noon') ? 34 : 28
        })
      });
      const data = await resp.json();
      if (data.success && data.recommendation) {
        setRecommendation(data.recommendation);
      }
    } catch (e) {
      console.error("AI recommendations fetching failed:", e);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleScanSuccess = (canteenId: string, tableName: string) => {
    setScannedTable(tableName);
    showToast(`Linked successfully to ${tableName}`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  const updateCartQty = (itemId: string, increment: boolean) => {
    const menuProduct = menuItems.find(i => i.id === itemId);
    if (!menuProduct) return;

    const currentQty = cart[itemId] || 0;
    if (increment) {
      if (currentQty >= menuProduct.stock) {
        alert(`Sorry, only ${menuProduct.stock} units of ${menuProduct.name} are left.`);
        return;
      }
      setCart({ ...cart, [itemId]: currentQty + 1 });
      showToast(`Added to cart: ${menuProduct.name} has been added.`);
    } else {
      if (currentQty <= 1) {
        const copy = { ...cart };
        delete copy[itemId];
        setCart(copy);
      } else {
        setCart({ ...cart, [itemId]: currentQty - 1 });
      }
    }
  };

  const handleRemoveFromCart = (itemId: string) => {
    const copy = { ...cart };
    delete copy[itemId];
    setCart(copy);
    showToast("Item removed from cart");
  };

  const handleTriggerGPay = () => {
    if (totalCartCount === 0) return;
    setShowGPayModal(true);
  };

  const handleCompleteGPay = async () => {
    setIsSubmittingOrder(true);
    
    // Format cart payload
    const orderItems = Object.entries(cart).map(([itemId, qty]) => {
      const prd = menuItems.find(i => i.id === itemId);
      return {
        itemId,
        name: prd ? prd.name : 'Unknown Food',
        quantity: qty as number
      };
    });

    try {
      const res = await onOrderPlaced(orderItems, selectedSlot, selectedCanteenId, selectedSubCanteenId);
      if (res && res.success) {
        setSuccessOrder(res.order);
        setQrPayload(res.qrPayload || res.order.id);
        setCart({}); // clear cart
        setShowGPayModal(false); // dismiss G Pay
        showToast("Payment processed via Google Pay!");
      } else {
        alert(res?.error || "Failed to checkout. Out of stock.");
      }
    } catch (err) {
      console.error(err);
      alert("Checkout failure occurred on server.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleAddQuickReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReviewItem || !reviewComment.trim()) return;
    setIsSubmittingReview(true);
    setReviewFeedbackText('');

    try {
      const result = await onAddReview(
        reviewRating,
        reviewComment,
        selectedReviewItem.id,
        selectedReviewItem.name
      );
      if (result && result.success) {
        setReviewFeedbackText(`Success! Sentiment analyzed as: "${result.review.sentiment.toUpperCase()}"`);
        setReviewComment('');
        setReviewRating(5);
        setTimeout(() => {
          setSelectedReviewItem(null);
          setReviewFeedbackText('');
        }, 3000);
      }
    } catch (err) {
      console.error(err);
      setReviewFeedbackText('Error posting review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Filter items based on Category, sub-canteen selection, and search query
  const filteredItems = menuItems.filter(item => {
    const categoryMatch = selectedCategory === 'All' || item.category.toLowerCase().includes(selectedCategory.split(' ')[0].toLowerCase());
    const subCanteenMatch = true; // Disabled sub-canteen filtering per request
    const searchMatch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return categoryMatch && subCanteenMatch && searchMatch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* HIERARCHICAL COLLEGES & CANTEENS SELECTOR */}
      <div className="bg-white border border-violet-100 rounded-3xl p-6 shadow-xs mb-8 space-y-4 text-left">
        <div className="flex items-center justify-between border-b border-violet-50 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700">Select Canteen Outlet</h3>
          <span className="text-[10px] text-gray-400 font-medium font-mono">Dynamic Multi-Tier Campus Dining</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* College Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">College / Campus</label>
            <select
              value={selectedCollegeId}
              onChange={(e) => {
                const colId = e.target.value;
                setSelectedCollegeId(colId);
                // Auto-select first canteen in this college
                const firstCanteen = canteens.find(c => c.collegeId === colId);
                if (firstCanteen) {
                  setSelectedCanteenId(firstCanteen.id);
                  onCanteenChange(firstCanteen.id);
                  // Auto-select first sub-canteen of that canteen
                  const firstSub = subCanteens.find(s => s.canteenId === firstCanteen.id);
                  if (firstSub) {
                    setSelectedSubCanteenId(firstSub.id);
                  }
                }
              }}
              className="w-full bg-violet-50/55 hover:bg-violet-50 focus:bg-white text-xs px-3 py-2.5 border border-violet-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all font-semibold text-gray-800"
            >
              {colleges.length === 0 ? (
                <option value="college_001">Engineering College East</option>
              ) : (
                colleges.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>
          </div>

          {/* Canteen Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Main Canteen</label>
            <select
              value={selectedCanteenId}
              onChange={(e) => {
                const cantId = e.target.value;
                setSelectedCanteenId(cantId);
                onCanteenChange(cantId);
                // Auto-select first sub-canteen
                const firstSub = subCanteens.find(s => s.canteenId === cantId);
                if (firstSub) {
                  setSelectedSubCanteenId(firstSub.id);
                }
              }}
              className="w-full bg-violet-50/55 hover:bg-violet-50 focus:bg-white text-xs px-3 py-2.5 border border-violet-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all font-semibold text-gray-800"
            >
              {canteens.length === 0 ? (
                <option value="canteen_001">Violet Bites</option>
              ) : (
                canteens.filter(c => c.collegeId === selectedCollegeId).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Canteen Search Option */}
        <div className="pt-2">
          <input
            type="text"
            placeholder="🔍 Search menus, food items, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-violet-50/30 hover:bg-violet-50/50 focus:bg-white text-xs px-4 py-3 border border-violet-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all text-gray-800 font-medium"
          />
        </div>
      </div>
      
      {/* 1. CANTEEN HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-violet-50 border border-violet-100 p-4 rounded-2xl mb-8 space-y-3 md:space-y-0">
        <div className="flex items-center space-x-3 text-left">
          <div className="h-10 w-10 rounded-full bg-violet-200 text-violet-800 flex items-center justify-center font-bold">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-violet-700 font-extrabold tracking-wider uppercase font-mono">Express Campus Food Court</p>
            <h2 className="font-display font-bold text-gray-950 text-sm">
              Canteen Room: <span className="text-violet-700">{canteenName}</span>
            </h2>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      {!successOrder && (
        <div className="flex border-b border-violet-100 mb-8 gap-6 text-left">
          <button
            type="button"
            onClick={() => setCustomerTab('menu')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 tracking-wide uppercase cursor-pointer ${
              customerTab === 'menu'
                ? 'border-violet-600 text-violet-750 font-extrabold'
                : 'border-transparent text-gray-400 hover:text-gray-900'
            }`}
          >
            Menu & Order
          </button>
          <button
            type="button"
            onClick={() => setCustomerTab('history')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 tracking-wide uppercase cursor-pointer ${
              customerTab === 'history'
                ? 'border-violet-650 text-violet-750 font-extrabold'
                : 'border-transparent text-gray-400 hover:text-gray-900'
            }`}
          >
            Order History & Milestones
          </button>
        </div>
      )}

      {/* 2. MAIN TRANSACTION SCREENS OR MENU COMPOSITIONS */}
      <div className="transition-all">
          {successOrder ? (
            /* E-TICKET SUCCESS VIEW (Image 6 & Image 13) */
            <div className="max-w-xl mx-auto bg-white rounded-3xl border border-violet-100 shadow-xl overflow-hidden p-8 transition-all relative text-center">
              <div className="flex flex-col items-center space-y-4">
                <div className="h-14 w-14 bg-emerald-500 rounded-2xl text-white flex items-center justify-center shadow-lg">
                  <CheckCircle className="h-8 w-8 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-2xl text-gray-900 tracking-tight">Order Placed Successfully!</h2>
                  <p className="text-xs text-gray-500 mt-1 font-sans">Show this QR code at the counter to collect your order.</p>
                </div>

                {/* QR Code generated locally */}
                <div className="bg-[#ffffff] p-5 rounded-2xl border-2 border-dashed border-violet-200/80 my-4 flex flex-col items-center">
                  <div className="bg-neutral-900 p-4 rounded-xl">
                    {qrImageUrl ? (
                      <img src={qrImageUrl} alt="Order QR Code" className="h-44 w-44 rounded-lg" />
                    ) : (
                      <div className="h-44 w-44 bg-neutral-800 rounded-lg flex items-center justify-center text-white text-xs font-mono p-4 text-center">
                        {successOrder.id}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono font-bold text-gray-400 mt-2.5">TICKET AUTHENTICATION LOCK</span>
                </div>

                {/* Info summary brackets */}
                <div className="w-full grid grid-cols-2 gap-4 bg-violet-50/50 p-4 rounded-2xl text-left border border-violet-100/30">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Order ID</span>
                    <span className="text-xs font-mono font-bold text-violet-750">{successOrder.id}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Amount Paid</span>
                    <span className="text-sm font-display font-bold text-emerald-600">₹{successOrder.totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                {/* Dynamic List order summary */}
                <div className="w-full text-left space-y-3.5 mt-4">
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Order Summary</h3>
                  <div className="divide-y divide-violet-100/50 font-sans text-xs">
                    {successOrder.items.map((item, idx) => (
                      <div key={idx} className="py-2.5 flex justify-between items-center">
                        <span className="text-gray-800 font-medium">
                          {item.name} <span className="text-violet-600 font-bold ml-1">x{item.quantity}</span>
                        </span>
                        <span className="font-mono text-gray-600">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    {(() => {
                      const ticketSubtotal = successOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                      const ticketFee = Math.max(0, successOrder.totalPrice - ticketSubtotal);
                      return (
                        <>
                          <div className="py-2.5 flex justify-between text-gray-500">
                            <span>Subtotal</span>
                            <span className="font-mono">₹{ticketSubtotal.toFixed(2)}</span>
                          </div>
                          <div className="py-2.5 flex justify-between text-gray-500">
                            <span>Convenience Fee</span>
                            <span className="font-mono">₹{ticketFee.toFixed(2)}</span>
                          </div>
                          <div className="py-3 flex justify-between font-bold text-sm text-gray-900">
                            <span>Total Paid</span>
                            <span className="font-mono text-violet-750">₹{successOrder.totalPrice.toFixed(2)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Reset or check status button */}
                <button
                  type="button"
                  onClick={() => { setSuccessOrder(null); setQrImageUrl(''); setQrPayload(''); }}
                  className="w-full mt-6 bg-violet-600 hover:bg-violet-750 active:bg-violet-800 text-white rounded-xl text-xs py-3.5 font-semibold transition-all shadow-md cursor-pointer font-display"
                >
                  Place Another Order
                </button>
              </div>
            </div>
          ) : customerTab === 'menu' ? (
            /* ACTIVE MENU & CART split columns */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
              
              {/* MENU COLUMN (LEFT) */}
              <div className="lg:col-span-8 space-y-8">

                {/* TODAY'S MENU BLOCK */}
                <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-violet-50 pb-5">
                    <div>
                      <h2 className="font-display font-bold text-xl text-gray-900 tracking-tight">Today's Menu</h2>
                      <p className="text-xs text-gray-400 mt-0.5 font-sans">Freshly prepared, just for you.</p>
                    </div>

                    {/* MENU FILTER TABS (Meals, Snacks & Beverages) */}
                    <div className="bg-violet-50/80 p-1.5 rounded-xl flex items-center border border-violet-100/50">
                      {['Meals', 'Snacks & Beverages'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                            selectedCategory === cat
                              ? 'bg-white text-violet-750 shadow-xs border border-violet-100'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CARDS GRID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredItems.map(item => {
                      const cartCount = cart[item.id] || 0;
                      return (
                        <div key={item.id} className="bg-[#ffffff] rounded-2xl border border-violet-100 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden relative">
                          {/* Image Box */}
                          <div className="aspect-video relative overflow-hidden bg-violet-50">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-3xl">🍲</div>
                            )}
                            
                            {/* Paused or Sold Out Overlays */}
                            {item.isPaused ? (
                              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                                <span className="bg-amber-600 text-white text-[10px] font-bold px-3 py-1 rounded-md uppercase tracking-wider shadow-md">
                                  Currently Unavailable
                                </span>
                              </div>
                            ) : (item.stock <= 0 || item.bookedToday >= item.dailyLimit) ? (
                              <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center">
                                <span className="bg-rose-600 text-white text-[10px] font-bold px-3 py-1 rounded-md uppercase tracking-wider shadow-md">
                                  Sold Out Today
                                </span>
                              </div>
                            ) : item.stock < 5 ? (
                              <span className="absolute top-2.5 left-2.5 bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase font-mono border border-rose-100 shadow-sm">
                                Only {item.stock} Left
                              </span>
                            ) : null}
                          </div>

                          {/* Body info */}
                          <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                            <div className="space-y-1">
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-display font-semibold text-sm text-gray-900 tracking-tight leading-tight capitalize">{item.name}</h4>
                                <span className="font-mono text-gray-400 text-[10px] shrink-0 font-semibold">★ {item.rating}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 font-sans line-clamp-2 leading-relaxed">{item.description}</p>
                              <div className="flex items-center space-x-2 pt-0.5">
                                <span className="text-[9px] font-mono bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-md font-bold">Prep: {item.prepTime} mins</span>
                                <span className="text-[9px] font-mono bg-neutral-50 text-gray-500 px-1.5 py-0.5 rounded-md font-medium">Limit: {item.dailyLimit}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1.5">
                              <span className="font-display font-extrabold text-sm text-violet-700">₹{item.price.toFixed(2)}</span>
                              
                              {cartCount > 0 && !item.isPaused ? (
                                <div className="flex items-center space-x-1.5 bg-violet-50 p-1 rounded-lg">
                                  <button
                                    onClick={() => updateCartQty(item.id, false)}
                                    className="p-1 rounded-md bg-white hover:bg-violet-100 text-violet-700 transition"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="text-xs font-bold font-mono px-1.5 text-slate-800">{cartCount}</span>
                                  <button
                                    onClick={() => updateCartQty(item.id, true)}
                                    className="p-1 rounded-md bg-white hover:bg-violet-100 text-violet-700 transition"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => updateCartQty(item.id, true)}
                                  disabled={item.stock === 0 || item.bookedToday >= item.dailyLimit || item.isPaused}
                                  className="bg-violet-600 hover:bg-violet-750 active:bg-violet-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition shadow-xs flex items-center space-x-1 disabled:bg-slate-100 disabled:text-slate-450"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>{item.isPaused ? 'Unavailable' : (item.stock === 0 || item.bookedToday >= item.dailyLimit) ? 'Sold Out' : 'Add to Cart'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* WRITE A PUBLIC CAMPUS REVIEW */}
                <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-sm text-gray-900">Add Public Faculty Review</h3>
                    <p className="text-[11px] text-gray-400 font-sans">Reviews are sentiment analyzed automatically using server-side Gemini models.</p>
                  </div>

                  <div className="flex flex-wrap gap-2.5 py-1">
                    {menuItems.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedReviewItem(selectedReviewItem?.id === m.id ? null : m)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold font-mono transition-all uppercase border ${
                          selectedReviewItem?.id === m.id
                            ? 'bg-violet-600 text-white border-violet-650'
                            : 'bg-violet-50/50 hover:bg-violet-50 text-gray-500 border-violet-100/40'
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>

                  {selectedReviewItem && (
                    <form onSubmit={handleAddQuickReview} className="space-y-3.5 animate-fade-in text-xs font-sans mt-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-500">Rating Stars:</span>
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map(stars => (
                            <button
                              key={stars}
                              type="button"
                              onClick={() => setReviewRating(stars)}
                              className="text-amber-400 focus:outline-none hover:scale-110 transition"
                            >
                              <Star className={`h-4.5 w-4.5 ${stars <= reviewRating ? 'fill-current' : 'text-gray-200'}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <textarea
                          placeholder={`How was the ${selectedReviewItem.name}? Tell us...`}
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          required
                          rows={2}
                          className="w-full bg-violet-50/50 focus:bg-white text-xs px-3.5 py-2 rounded-xl focus:outline-none border border-violet-100 focus:ring-1 focus:ring-violet-400 text-gray-700"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          type="submit"
                          disabled={isSubmittingReview}
                          className="bg-violet-600 hover:bg-violet-750 text-white rounded-lg px-4 py-2 text-[10px] font-bold uppercase tracking-wider shadow-xs"
                        >
                          {isSubmittingReview ? 'Analyzing AI Sentiment...' : 'Post Security Review'}
                        </button>
                        <span className="text-[10px] font-mono text-purple-700 font-bold">{reviewFeedbackText}</span>
                      </div>
                    </form>
                  )}
                </div>

                {/* FEEDBACK LOGS PREVIEW */}
                <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs space-y-4">
                  <h3 className="font-display font-bold text-xs tracking-wider uppercase text-gray-400">Live Campus Sentiment Log</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reviews.slice(0, 4).map((rev, idx) => (
                      <div key={idx} className="bg-violet-50/50 p-4 rounded-2xl text-xs font-sans border border-violet-100/30">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-gray-900">{rev.userName}</span>
                          <span className={`text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded ${
                            rev.sentiment === 'positive' 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : rev.sentiment === 'negative'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}>
                            {rev.sentiment}
                          </span>
                        </div>
                        {rev.menuItemName && (
                          <span className="text-[9px] font-semibold text-violet-700 uppercase tracking-wider block mb-1">On: {rev.menuItemName}</span>
                        )}
                        <p className="text-gray-500 leading-relaxed italic">"{rev.comment}"</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* LIVE SLIDING CHECKOUT CART BAR (RIGHT COLUMN) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="sticky top-20 bg-white p-6 rounded-3xl border border-violet-100 shadow-sm space-y-6">
                  
                  <div>
                    <h3 className="font-display font-bold text-base text-gray-900">Your Checkout Basket</h3>
                    <p className="text-xs text-gray-400 font-sans mt-0.5">Connected dynamically under {scannedTable}</p>
                  </div>

                  {totalCartCount === 0 ? (
                    <div className="text-center py-10 space-y-3">
                      <ShoppingCart className="h-10 w-10 text-violet-100 mx-auto" />
                      <p className="text-xs text-gray-400 max-w-xs mx-auto">Your cart is currently empty. Tap products to include them in your lunch order.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Products list */}
                      <div className="divide-y divide-violet-50 max-h-[240px] overflow-y-auto pr-1">
                        {Object.entries(cart).map(([itemId, qty]) => {
                          const item = menuItems.find(i => i.id === itemId);
                          if (!item) return null;
                          return (
                            <div key={itemId} className="py-3 flex justify-between items-center text-xs font-sans">
                              <div className="flex items-center space-x-2">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.name} referrerPolicy="no-referrer" className="h-9 w-9 rounded-lg object-cover bg-violet-50" />
                                ) : (
                                  <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center text-sm">🍲</div>
                                )}
                                <div>
                                  <span className="font-semibold text-gray-800 block capitalize">{item.name}</span>
                                  <span className="text-[10px] text-violet-700 font-bold font-mono">₹{item.price.toFixed(2)}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center space-x-1.5 bg-violet-50 p-1 rounded-lg">
                                  <button onClick={() => updateCartQty(item.id, false)} className="p-1 rounded-md bg-white hover:bg-violet-100 text-violet-600">
                                    <Minus className="h-2.5 w-2.5" />
                                  </button>
                                  <span className="font-bold text-gray-800 px-1 font-mono">{qty}</span>
                                  <button onClick={() => updateCartQty(item.id, true)} className="p-1 rounded-md bg-white hover:bg-violet-100 text-violet-600">
                                    <Plus className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => handleRemoveFromCart(item.id)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* PRE-BOOKING SLOT SELECTOR */}
                      <div className="border-t border-violet-100/60 pt-4 space-y-1.5 text-xs text-left">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Choose Pickup Slot</label>
                        <select
                          value={selectedSlot}
                          onChange={(e) => setSelectedSlot(e.target.value)}
                          className="w-full bg-violet-50/50 hover:bg-violet-50 focus:bg-white text-xs px-3 py-2.5 rounded-xl border border-violet-150 focus:outline-none focus:ring-2 focus:ring-violet-500 font-semibold cursor-pointer transition-all"
                        >
                          {availableTimeSlots.map(slot => (
                            <option key={slot} value={slot}>{slot}</option>
                          ))}
                        </select>
                      </div>

                      {/* Financial values */}
                      <div className="border-t border-violet-100/60 pt-4 space-y-2.5 text-xs font-sans text-gray-500">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-mono text-gray-700">₹{cartSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Convenience Fee:</span>
                          <span className="font-mono text-gray-700">₹{displayedConvenienceFee.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-violet-50 pt-2.5 flex justify-between font-bold text-sm text-gray-900">
                          <span>Grand Total Due:</span>
                          <span className="font-mono text-violet-750">₹{totalAmount.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* PAY WITH GOOGLE PAY BUTTON (Image 12) */}
                      <button
                        type="button"
                        onClick={handleTriggerGPay}
                        className="w-full bg-neutral-900 hover:bg-black text-white rounded-xl py-3.5 text-xs font-semibold shadow-md flex items-center justify-center space-x-2 transition cursor-pointer"
                      >
                        {/* G Pay Logo styling */}
                        <span className="bg-white text-black px-1.5 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide font-mono">G Pay</span>
                        <span>Pay with G Pay</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* HISTORY TAB */
            <div className="max-w-4xl mx-auto space-y-8 text-left animate-fade-in">
              <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs space-y-4">
                <div>
                  <h3 className="font-display font-bold text-sm text-gray-900">Your Booking History</h3>
                  <p className="text-xs text-gray-400 font-sans mt-0.5">Track kitchen progress, countdowns, and click any order to retrieve its pickup QR code.</p>
                </div>

                {(() => {
                  const myOrders = orders
                    .filter(o => 
                      o.userId === 'user_guest' || 
                      (o.userName || '').toLowerCase() === userEmail.split('@')[0].toLowerCase() ||
                      o.userName === 'Raju Watson' ||
                      (o.userId && o.userId.includes('watson'))
                    )
                    .sort((a, b) => b.createdAt - a.createdAt);

                  if (myOrders.length === 0) {
                    return (
                      <p className="text-xs text-gray-400 text-center py-6">No previous bookings found in the database.</p>
                    );
                  }
                  return (
                    <div className="divide-y divide-violet-100">
                      {myOrders.map(o => {
                        let remainingMinutes = 0;
                        if (o.expiryTime && (o.status === 'scheduled' || o.status === 'preparing' || o.status === 'ready')) {
                          remainingMinutes = Math.ceil((o.expiryTime - Date.now()) / (60 * 1000));
                        }
                        const isActive = o.status === 'scheduled' || o.status === 'preparing' || o.status === 'ready';
                        return (
                          <div key={o.id} className="py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-sans">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center space-x-2 flex-wrap gap-1">
                                <span className="font-mono font-bold text-gray-800">{o.id}</span>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  o.status === 'collected' || o.status === 'delivered'
                                    ? 'bg-emerald-50 text-emerald-750'
                                    : o.status === 'expired'
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-violet-50 text-violet-750'
                                }`}>
                                  {o.status}
                                </span>
                                {o.pickupSlot && (
                                  <span className="text-[10px] text-gray-450 font-mono">Slot: <strong className="text-gray-900">{o.pickupSlot}</strong></span>
                                )}
                                {o.status === 'ready' && remainingMinutes > 0 && (
                                  <span className="bg-rose-50 text-rose-700 text-[9px] font-bold px-2 py-0.5 rounded-md animate-pulse">
                                    Expires in {remainingMinutes} mins
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-650 leading-relaxed font-sans">
                                {o.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                              </p>
                              
                              <div className="flex items-center space-x-4">
                                <span className="text-[9px] text-gray-400 font-sans">{new Date(o.createdAt || Date.now()).toLocaleString()}</span>
                              </div>

                              {/* STEPPER PROGRESS TIMELINE */}
                              {isActive && (
                                <div className="flex items-center space-x-2.5 pt-1.5 text-[9px] uppercase tracking-wide font-bold">
                                  <span className={`${o.status === 'scheduled' || o.status === 'preparing' || o.status === 'ready' ? 'text-violet-750 font-black' : 'text-gray-300'}`}>● Scheduled</span>
                                  <span className="text-gray-300">➔</span>
                                  <span className={`${o.status === 'preparing' || o.status === 'ready' ? 'text-violet-750 font-black' : 'text-gray-300'}`}>● Preparing</span>
                                  <span className="text-gray-300">➔</span>
                                  <span className={`${o.status === 'ready' ? 'text-emerald-600 animate-pulse font-black' : 'text-gray-300'}`}>● Ready</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center space-x-3 shrink-0 self-end md:self-auto">
                              <span className="font-mono font-bold text-gray-950 text-sm">₹{o.totalPrice.toFixed(2)}</span>
                              <button
                                onClick={() => { setSuccessOrder(o); setQrPayload(o.qrCode || o.id); }}
                                className="bg-violet-50 hover:bg-violet-100 text-violet-750 border border-violet-150 rounded-xl px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider transition flex items-center space-x-1 cursor-pointer"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                                <span>QR Ticket</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

      {/* 3. TOAST NOTIFICATIONS DRAWER */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white rounded-2xl py-3 px-5 shadow-xl text-xs font-semibold animate-bounce shadow-violet-950/20 max-w-sm flex items-center space-x-2.5 border border-neutral-800">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 4. GOOGLE PAY GATEWAY MODAL (pay.google.com Simulation - Image 5) */}
      {showGPayModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#f0f4f9] rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transition-all border border-neutral-200">
            {/* pay.google.com header bar */}
            <div className="bg-white px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
              <span className="text-[10px] font-mono text-gray-400 font-bold tracking-wider">pay.google.com</span>
              <button
                onClick={() => setShowGPayModal(false)}
                className="p-1 rounded-full hover:bg-neutral-100 text-gray-400 hover:text-gray-600 transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Inner modal card container */}
            <div className="p-6 space-y-5">
              {/* Profile/Payee Header */}
              <div className="flex items-center justify-between">
                {/* G Pay brand */}
                <div className="flex items-center space-x-2">
                  <div className="px-2 py-1.5 bg-violet-600 text-white font-extrabold text-[10px] rounded tracking-wide font-mono">G Pay</div>
                  <span className="text-xs font-bold text-gray-700">Google Pay</span>
                </div>
                {/* Simulated round avatar photo representing Raju/Watson */}
                <div className="h-8 w-8 rounded-full overflow-hidden ring-2 ring-violet-200">
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop" alt="User Profile" className="h-full w-full object-cover" />
                </div>
              </div>

              {/* VISA CARD MOCKUP */}
              <div className="bg-white p-4 rounded-xl border border-neutral-300/60 shadow-xs flex items-center justify-between hover:bg-neutral-50 transition cursor-pointer">
                <div className="flex items-center space-x-2.5">
                  <div className="px-2 py-1 bg-violet-100 text-violet-700 rounded font-semibold text-[10px] font-mono">VISA</div>
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">Test Card</span>
                    <span className="text-[10px] text-gray-400 font-mono">Visa •••• 1111</span>
                  </div>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-gray-400" />
              </div>

              {/* WARNING BOX RED */}
              <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-[10px] text-rose-800 leading-relaxed font-sans font-medium text-left">
                Your payment method won't be charged because you're in a test environment.
              </div>

              {/* CHARGE CALCULATION VIEW */}
              <div className="flex justify-between items-end border-t border-neutral-200/80 pt-4 text-xs">
                <div>
                  <span className="text-gray-400 block font-semibold text-[10px] uppercase">Transaction Value</span>
                  <span className="text-xs text-gray-500">Convenience fee applied</span>
                </div>
                <span className="text-xl font-display font-bold text-gray-900 font-mono">₹{totalAmount.toFixed(2)}</span>
              </div>

              {/* ACTION EXECUTION BUTTON */}
              <button
                type="button"
                onClick={handleCompleteGPay}
                disabled={isSubmittingOrder}
                className="w-full bg-[#1a73e8] hover:bg-[#1557b0] active:bg-[#124b96] text-white rounded-xl py-3.5 text-xs font-bold transition shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isSubmittingOrder ? (
                  <div className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Pay ₹{totalAmount.toFixed(2)}</span>
                )}
              </button>

              <div className="text-center">
                <span className="text-[9px] text-gray-400 font-semibold font-mono uppercase tracking-wide">SECURE ENCRYPTED HANDSHAKE</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
