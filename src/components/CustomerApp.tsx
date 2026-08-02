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
  userId: string;
  userCollegeId?: string;
  userCanteenId?: string;
  onLogout: () => void;
  onCanteenChange: (canteenId: string) => void;
  paytmSuccess?: { orderId: string; status: string } | null;
  onDismissPaytmSuccess?: () => void;
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
  userId,
  userCollegeId,
  userCanteenId,
  onLogout,
  onCanteenChange,
  paytmSuccess,
  onDismissPaytmSuccess
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

  // Hierarchical College, Canteen, SubCanteen states - hydrate from cache
  const [colleges, setColleges] = useState<College[]>(() => {
    try { const c = localStorage.getItem('bb_colleges'); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [canteens, setCanteens] = useState<Canteen[]>(() => {
    try { const c = localStorage.getItem('bb_canteens'); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [subCanteens, setSubCanteens] = useState<SubCanteen[]>(() => {
    try { const c = localStorage.getItem('bb_subcanteens'); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>(userCollegeId || 'college_001');
  const [selectedCanteenId, setSelectedCanteenId] = useState<string>(userCanteenId || 'canteen_001');
  const [selectedSubCanteenId, setSelectedSubCanteenId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const userCollege = colleges.find(c => c.id === selectedCollegeId);
  const branding = (userCollege as any)?.branding || {};

  // Filter canteens and subcounters by college
  const collegeCanteens = canteens.filter(c => c.collegeId === selectedCollegeId);
  const canteenSubCounters = subCanteens.filter(s => s.canteenId === selectedCanteenId);
  const hasMultipleCanteens = collegeCanteens.length > 1;
  const hasMultipleSubCounters = canteenSubCounters.length > 1;

  // Auto-select single canteen
  useEffect(() => {
    if (collegeCanteens.length === 1 && selectedCanteenId !== collegeCanteens[0].id) {
      setSelectedCanteenId(collegeCanteens[0].id);
      onCanteenChange(collegeCanteens[0].id);
    }
  }, [collegeCanteens.length]);

  // Auto-select single subcounter
  useEffect(() => {
    if (canteenSubCounters.length === 1 && selectedSubCanteenId !== canteenSubCounters[0].id) {
      setSelectedSubCanteenId(canteenSubCounters[0].id);
    } else if (canteenSubCounters.length === 0) {
      setSelectedSubCanteenId('');
    }
  }, [canteenSubCounters.length]);

  // Auto-switch to history tab when Paytm payment completes
  useEffect(() => {
    if (paytmSuccess && paytmSuccess.status === 'success') {
      setCustomerTab('history');
    }
  }, [paytmSuccess]);
   const bHeroTitle = branding.heroTitle || 'Esc(Q)';
  const bHeroSubtitle = branding.heroSubtitle || `Official ${userCollege?.name || ''} Canteen Platform`;
  const bHeroTagline = branding.heroTagline || 'Order Faster · Skip the Queue · Smart Pickup';
  const bFeatureBadges = branding.featureBadges || ['Order Faster', 'Skip the Queue', 'Smart Pickup'];
  const bMenuTitle = branding.menuTitle || "Today's Menu";
  const bMenuSubtitle = branding.menuSubtitle || 'Freshly prepared, just for you.';
  const bMenuColumns = branding.menuColumns || 4;
  const bShowCategoryTabs = branding.showCategoryTabs !== false;
  const bShowReviews = branding.showReviews !== false;
  const bShowSentiment = branding.showSentiment !== false;
   const bContactPhone = branding.contactPhone || '+91 9940918442';
   const bContactEmail = branding.contactEmail || 'escqsupportemail@gmail.com';
   const bContactAddress = branding.contactAddress || 'AUTO HUB SOLUTION (AHS), Tamil Nadu, India';
   const bFooterCopyright = branding.footerCopyright || `\u00a9 2026 Esc(Q). All Rights Reserved.`;
  const bFooterLinks = branding.footerLinks || [
    { label: 'Menu &amp; Order', action: 'menu' },
    { label: 'Order History', action: 'history' },
    { label: 'My Profile', action: 'profile' },
    { label: 'Help &amp; Support', action: 'help' }
  ];

  // Alignment & layout controls
  const bHeroLayout = branding.heroLayout || 'logo-left';
  const bHeroBannerPosition = branding.heroBannerPosition || 'right';
  const bHeroLogoSize = branding.heroLogoSize || 144;
  const bHeroPadding = branding.heroPadding || 'normal';
  const bMenuCardSize = branding.menuCardSize || 'medium';
  const bMenuGap = branding.menuGap || 'normal';
  const bMenuAlignment = branding.menuAlignment || 'left';
  const bFooterLayout = branding.footerLayout || '3-col';
  const bSectionSpacing = branding.sectionSpacing || 'normal';

  const heroPaddingClass = bHeroPadding === 'compact' ? 'p-4 md:p-5' : bHeroPadding === 'spacious' ? 'p-8 md:p-10' : 'p-6 md:p-8';
  const heroLogoPx = bHeroLogoSize <= 96 ? 'w-20 h-20 md:w-24 md:h-24' : bHeroLogoSize <= 120 ? 'w-24 h-24 md:w-28 md:h-28' : bHeroLogoSize <= 176 ? 'w-32 h-32 md:w-40 md:h-40' : 'w-28 h-28 md:w-36 md:h-36';
  const menuGapClass = bMenuGap === 'tight' ? 'gap-2' : bMenuGap === 'loose' ? 'gap-6' : 'gap-4';
  const menuColStyle = typeof window !== 'undefined' && window.innerWidth >= 640
    ? { gridTemplateColumns: `repeat(${bMenuColumns}, minmax(0, 1fr))` }
    : {};
  const menuCardClass = bMenuCardSize === 'small' ? 'p-3' : bMenuCardSize === 'large' ? 'p-6' : 'p-4';
  const sectionSpacingClass = bSectionSpacing === 'compact' ? 'mb-6' : bSectionSpacing === 'spacious' ? 'mb-14' : 'mb-8';

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Auto-select from cached data first (instant)
        const userCantId = userCanteenId || 'canteen_001';
        setSelectedCanteenId(userCantId);
        onCanteenChange(userCantId);
        if (userCollegeId) {
          setSelectedCollegeId(userCollegeId);
        }
        // Auto-select first sub from cache
        try {
          const cachedSub = JSON.parse(localStorage.getItem('bb_subcanteens') || '[]');
          const userSub = cachedSub.find((s: any) => s.canteenId === userCantId);
          if (userSub) setSelectedSubCanteenId(userSub.id);
        } catch {}

        // Then fetch fresh data
        const [colResp, cantResp, subResp] = await Promise.all([
          fetch(`${API_BASE}/api/colleges`),
          fetch(`${API_BASE}/api/canteens`),
          fetch(`${API_BASE}/api/subcanteens`)
        ]);
        const colData = await colResp.json();
        const cantData = await cantResp.json();
        const subData = await subResp.json();
        if (colData.success) {
          setColleges(colData.colleges);
          try { localStorage.setItem('bb_colleges', JSON.stringify(colData.colleges)); } catch {}
        }
        if (cantData.success) {
          setCanteens(cantData.canteens);
          try { localStorage.setItem('bb_canteens', JSON.stringify(cantData.canteens)); } catch {}
        }
        if (subData.success) {
          setSubCanteens(subData.subCanteens);
          try { localStorage.setItem('bb_subcanteens', JSON.stringify(subData.subCanteens)); } catch {}
        }

        // Re-select if user profile has it
        if (userCollegeId) {
          setSelectedCollegeId(userCollegeId);
        } else if (cantData.success && cantData.canteens) {
          const cant = cantData.canteens.find((c: any) => c.id === userCantId);
          if (cant) setSelectedCollegeId(cant.collegeId);
        }

        if (subData.success && subData.subCanteens) {
          const userSub = subData.subCanteens.find((s: any) => s.canteenId === userCantId);
          if (userSub) setSelectedSubCanteenId(userSub.id);
        }

        // Preload college logo + banner images
        if (colData.success && colData.colleges) {
          const userCol = colData.colleges.find((c: any) => c.id === (userCollegeId || ''));
          if (userCol?.logoUrl) { const img = new Image(); img.src = userCol.logoUrl; }
          if (userCol?.bannerUrl) { const img = new Image(); img.src = userCol.bannerUrl; }
        }
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
        setSuccessOrder(prev => ({
          ...match,
          qrPayload: match.qrPayload || prev?.qrPayload || match.id
        }));
      }
    }
  }, [orders]);

  // Generate QR code data URL locally when order is placed
  useEffect(() => {
    if (successOrder) {
      const payload = qrPayload || successOrder.qrPayload || successOrder.id;
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
    handleCompleteGPay();
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
        // Paytm All-in-One SDK flow (CheckoutJS overlay)
        if (res.usePaytm && res.txnToken) {
          setCart({});
          setShowGPayModal(false);

          // Load Paytm CheckoutJS SDK dynamically
          const loadSDK = (): Promise<void> => new Promise((resolve, reject) => {
            if ((window as any).Paytm && (window as any).Paytm.CheckoutJS) { resolve(); return; }
            const script = document.createElement('script');
            script.src = `https://securegw-stage.paytm.in/merchantpgpui/checkoutjs/merchants/${res.mid}.js`;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Paytm SDK'));
            document.head.appendChild(script);
          });

          try {
            showToast('Opening Paytm checkout...');
            await loadSDK();

            const paytmConfig = {
              root: '',
              flow: 'DEFAULT',
              data: {
                orderId: res.orderId,
                token: res.txnToken,
                tokenType: 'TXN_TOKEN',
                amount: res.amount,
              },
              handler: {
                notifyMerchant: (eventName: string, payload: any) => {
                  console.log('[Paytm Web] Event:', eventName, payload);
                },
              },
            };

            const paytmJs = (window as any).Paytm.CheckoutJS;
            await paytmJs.init(paytmConfig);
            await paytmJs.open();

            // After checkout closes, poll for payment status
            const orderId = res.orderId;
            let attempts = 0;
            const poll = setInterval(async () => {
              attempts++;
              try {
                const resp = await fetch(`${API_BASE}/api/paytm/status?orderId=${orderId}`);
                const statusData = await resp.json();
                if (statusData.success && statusData.paymentStatus === 'paid') {
                  clearInterval(poll);
                  try { localStorage.removeItem('bb_pendingPaytmOrderId'); } catch {}
                  fetchUserOrders?.();
                  setSuccessOrder(res.order);
                  setQrPayload(res.order.qrPayload || res.order.id);
                  showToast('Payment successful! Order confirmed.');
                } else if (attempts >= 10) {
                  clearInterval(poll);
                  try { localStorage.removeItem('bb_pendingPaytmOrderId'); } catch {}
                  fetchUserOrders?.();
                  setSuccessOrder(res.order);
                  setQrPayload(res.order.qrPayload || res.order.id);
                  showToast('Payment submitted. Check Order History for status.');
                }
              } catch {
                if (attempts >= 10) {
                  clearInterval(poll);
                  showToast('Could not verify payment. Check Order History.');
                }
              }
            }, 3000);
          } catch (sdkErr: any) {
            console.error('[Paytm Web] SDK error:', sdkErr);
            showToast('Payment cancelled or SDK error.');
          }
          return;
        }

        // Non-Paytm (instant checkout)
        setSuccessOrder(res.order);
        setQrPayload(res.order.qrPayload || res.qrPayload || res.order.id);
        setCart({}); // clear cart
        setShowGPayModal(false); // dismiss modal
        showToast("Payment processed via Paytm!");
      } else {
        setShowGPayModal(false);
        alert(res?.error || "Failed to checkout. Out of stock.");
      }
    } catch (err) {
      console.error(err);
      setShowGPayModal(false);
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

      {/* HERO - Logo + Content Only (No Banner) */}
      <div className={`relative rounded-3xl overflow-hidden ${sectionSpacingClass} bg-white border border-gray-100 shadow-sm`}>
        <div className={`flex items-center gap-3 md:gap-5 ${heroPaddingClass} min-h-[180px]`}>
          <div className="shrink-0">
            {userCollege?.logoUrl ? (
              <img src={userCollege.logoUrl} alt={userCollege.name} className="w-16 h-16 md:w-36 md:h-36 rounded-full object-contain border-2 border-gray-100 shadow-md bg-white" />
            ) : (
              <div className="w-16 h-16 md:w-36 md:h-36 rounded-full bg-red-50 flex items-center justify-center text-2xl md:text-5xl font-bold text-red-700 border-2 border-gray-100 shadow-md">
                {userCollege?.name?.charAt(0) || 'B'}
              </div>
            )}
          </div>
          <div className={`${bMenuAlignment === 'center' ? 'text-center' : 'text-left'} flex-1 min-w-0`}>
            <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600 mb-0.5">Welcome to</p>
            <h1 className="font-display font-black text-lg md:text-3xl tracking-tight leading-tight text-gray-900" dangerouslySetInnerHTML={{ __html: bHeroTitle }} />
            <p className="text-[11px] md:text-sm text-gray-600 font-sans mt-0.5" dangerouslySetInnerHTML={{ __html: bHeroSubtitle }} />
            <p className="text-[10px] md:text-[11px] text-gray-400 font-sans mt-0.5 italic hidden md:block">{bHeroTagline}</p>
            <div className={`flex flex-wrap gap-1.5 md:gap-2 mt-2 md:mt-3 ${bMenuAlignment === 'center' ? 'justify-center' : ''}`}>
              {bFeatureBadges.map((feat: string, i: number) => (
                <span key={i} className="bg-white text-amber-700 text-[9px] md:text-[10px] font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-amber-200 flex items-center gap-1 shadow-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 md:h-3 md:w-3 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  {feat}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PAYTM PAYMENT SUCCESS / FAILURE BANNER */}
      {paytmSuccess && (
        <div className={`mb-4 p-4 rounded-2xl border shadow-sm flex items-start gap-3 ${paytmSuccess.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${paytmSuccess.status === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
            {paytmSuccess.status === 'success' ? (
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${paytmSuccess.status === 'success' ? 'text-green-800' : 'text-red-800'}`}>
              {paytmSuccess.status === 'success' ? 'Payment Successful!' : 'Payment Failed'}
            </p>
            <p className={`text-xs mt-0.5 ${paytmSuccess.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {paytmSuccess.status === 'success'
                ? `Order ${paytmSuccess.orderId} confirmed. Check Order History for QR code.`
                : `Order ${paytmSuccess.orderId} payment was not completed.`}
            </p>
          </div>
          <button onClick={onDismissPaytmSuccess} className={`shrink-0 p-1 rounded-lg hover:bg-white/80 ${paytmSuccess.status === 'success' ? 'text-green-500' : 'text-red-500'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* SUB-CANTEEN SELECTOR + SEARCH (compact) */}
      <div className={`flex flex-col sm:flex-row gap-3 ${sectionSpacingClass}`}>
        {hasMultipleCanteens && (
          <select
            value={selectedCanteenId}
            onChange={(e) => {
              setSelectedCanteenId(e.target.value);
              onCanteenChange(e.target.value);
              setSelectedSubCanteenId('');
            }}
            className="bg-white border border-red-100 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-[200px]"
          >
            {collegeCanteens.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        {hasMultipleCanteens === false && collegeCanteens.length === 1 && (
          <div className="flex items-center gap-2 bg-red-50/60 border border-red-100 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-700 min-w-[200px]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            {collegeCanteens[0].name}
          </div>
        )}
        {hasMultipleSubCounters && (
          <select
            value={selectedSubCanteenId}
            onChange={(e) => setSelectedSubCanteenId(e.target.value)}
            className="bg-white border border-red-100 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-[200px]"
          >
            {canteenSubCounters.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        {hasMultipleSubCounters === false && canteenSubCounters.length === 1 && (
          <div className="flex items-center gap-2 bg-red-50/60 border border-red-100 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-700 min-w-[200px]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            {canteenSubCounters[0].name}
          </div>
        )}
        <input
          type="text"
          placeholder="Search menus, food items, categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-white border border-red-100 rounded-xl px-4 py-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
        />
      </div>
      
      {/* Tab Switcher */}
      {!successOrder && (
        <div className={`flex border-b border-red-100 ${sectionSpacingClass} gap-6 text-left`}>
          <button
            type="button"
            onClick={() => setCustomerTab('menu')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 tracking-wide uppercase cursor-pointer ${
              customerTab === 'menu'
                ? 'border-amber-600 text-amber-600 font-extrabold'
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
                ? 'border-amber-600 text-amber-600 font-extrabold'
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
            <div className="max-w-xl mx-auto bg-white rounded-3xl border border-red-100 shadow-xl overflow-hidden p-8 transition-all relative text-center">
              <div className="flex flex-col items-center space-y-4">
                <div className="h-14 w-14 bg-emerald-500 rounded-2xl text-white flex items-center justify-center shadow-lg">
                  <CheckCircle className="h-8 w-8 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-2xl text-gray-900 tracking-tight">Order Placed Successfully!</h2>
                  <p className="text-xs text-gray-500 mt-1 font-sans">Show this QR code at the counter to collect your order.</p>
                </div>

                {/* QR Code generated locally */}
                <div className="bg-[#ffffff] p-5 rounded-2xl border-2 border-dashed border-red-200/80 my-4 flex flex-col items-center">
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
                <div className="w-full grid grid-cols-2 gap-4 bg-red-50/50 p-4 rounded-2xl text-left border border-red-100/30">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Order ID</span>
                    <span className="text-xs font-mono font-bold text-amber-700">{successOrder.id}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Amount Paid</span>
                    <span className="text-sm font-display font-bold text-emerald-600">₹{successOrder.totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                {/* Dynamic List order summary */}
                <div className="w-full text-left space-y-3.5 mt-4">
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Order Summary</h3>
                  <div className="divide-y divide-red-100/50 font-sans text-xs">
                    {successOrder.items.map((item, idx) => (
                      <div key={idx} className="py-2.5 flex justify-between items-center">
                        <span className="text-gray-800 font-medium">
                          {item.name} <span className="text-amber-600 font-bold ml-1">x{item.quantity}</span>
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
                            <span className="font-mono text-amber-700">₹{successOrder.totalPrice.toFixed(2)}</span>
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
                  className="w-full mt-6 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs py-3.5 font-semibold transition-all shadow-md cursor-pointer font-display"
                >
                  Place Another Order
                </button>
              </div>
            </div>
          ) : customerTab === 'menu' ? (
            /* ACTIVE MENU & CART split columns */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 text-left">
              
              {/* MENU COLUMN (LEFT) */}
              <div className="lg:col-span-8 space-y-8">

                {/* TODAY'S MENU BLOCK */}
                <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-red-50 pb-5">
                    <div>
                      <h2 className="font-display font-bold text-xl text-gray-900 tracking-tight">{bMenuTitle}</h2>
                      <p className="text-xs text-gray-400 mt-0.5 font-sans">{bMenuSubtitle}</p>
                    </div>

                    {/* MENU FILTER TABS (Meals, Snacks & Beverages) */}
                    <div className="bg-red-50/80 p-1.5 rounded-xl flex items-center border border-red-100/50">
                      {['Meals', 'Snacks & Beverages'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                            selectedCategory === cat
                              ? 'bg-white text-amber-700 shadow-xs border border-red-100'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CARDS GRID */}
                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${menuGapClass}`} style={menuColStyle}>
                    {filteredItems.map(item => {
                      const cartCount = cart[item.id] || 0;
                      return (
                        <div key={item.id} className="bg-[#ffffff] rounded-2xl border border-red-100 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden relative">
                          {/* Image Box */}
                          <div className="aspect-video relative overflow-hidden bg-red-50">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-all" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center text-3xl ${item.imageUrl ? 'hidden' : ''}`}>🍲</div>
                            
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
                          <div className={`${menuCardClass} flex-1 flex flex-col justify-between gap-3`}>
                            <div className="space-y-1">
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-display font-semibold text-sm text-gray-900 tracking-tight leading-tight capitalize">{item.name}</h4>
                                <span className="font-mono text-gray-400 text-[10px] shrink-0 font-semibold">★ {item.rating}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 font-sans line-clamp-2 leading-relaxed">{item.description}</p>
                              <div className="flex items-center space-x-2 pt-0.5">
                                <span className="text-[9px] font-mono bg-red-50 text-red-800 px-1.5 py-0.5 rounded-md font-bold">Prep: {item.prepTime} mins</span>
                                <span className="text-[9px] font-mono bg-neutral-50 text-gray-500 px-1.5 py-0.5 rounded-md font-medium">Limit: {item.dailyLimit}</span>
                              </div>
                            </div>

                            <div className="pt-1.5 space-y-2">
                              {cartCount > 0 && !item.isPaused ? (
                                <div className="flex items-center justify-between">
                                  <span className="font-display font-extrabold text-sm text-red-800">₹{item.price.toFixed(2)}</span>
                                  <div className="flex items-center space-x-1.5 bg-red-50 p-1 rounded-lg">
                                    <button
                                      onClick={() => updateCartQty(item.id, false)}
                                      className="p-1 rounded-md bg-white hover:bg-red-100 text-red-800 transition"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="text-xs font-bold font-mono px-1.5 text-slate-800">{cartCount}</span>
                                    <button
                                      onClick={() => updateCartQty(item.id, true)}
                                      className="p-1 rounded-md bg-white hover:bg-red-100 text-red-800 transition"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="font-display font-extrabold text-sm text-red-800">₹{item.price.toFixed(2)}</span>
                                  </div>
                                  <button
                                    onClick={() => updateCartQty(item.id, true)}
                                    disabled={item.stock === 0 || item.bookedToday >= item.dailyLimit || item.isPaused}
                                    className="w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-[11px] font-bold py-2 rounded-xl transition shadow-xs flex items-center justify-center space-x-1 disabled:bg-slate-100 disabled:text-slate-400"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>{item.isPaused ? 'Unavailable' : (item.stock === 0 || item.bookedToday >= item.dailyLimit) ? 'Sold Out' : 'Add to Cart'}</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {filteredItems.length > 4 && (
                    <div className="text-center mt-4">
                      <button onClick={() => setSearchQuery('')} className="text-amber-600 hover:text-amber-700 text-xs font-bold font-display cursor-pointer transition">
                        View All Menu Items →
                      </button>
                    </div>
                  )}
                </div>

                {/* WRITE A PUBLIC CAMPUS REVIEW */}
                <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-xs space-y-4">
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
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-red-50/50 hover:bg-red-50 text-gray-500 border-red-100/40'
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
                          className="w-full bg-red-50/50 focus:bg-white text-xs px-3.5 py-2 rounded-xl focus:outline-none border border-red-100 focus:ring-1 focus:ring-amber-400 text-gray-700"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          type="submit"
                          disabled={isSubmittingReview}
                          className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 text-[10px] font-bold uppercase tracking-wider shadow-xs"
                        >
                          {isSubmittingReview ? 'Analyzing AI Sentiment...' : 'Post Security Review'}
                        </button>
                        <span className="text-[10px] font-mono text-red-700 font-bold">{reviewFeedbackText}</span>
                      </div>
                    </form>
                  )}
                </div>

                {/* FEEDBACK LOGS PREVIEW */}
                <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-xs space-y-4">
                  <h3 className="font-display font-bold text-xs tracking-wider uppercase text-gray-400">Live Campus Sentiment Log</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reviews.slice(0, 4).map((rev, idx) => (
                      <div key={idx} className="bg-red-50/50 p-4 rounded-2xl text-xs font-sans border border-red-100/30">
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
                          <span className="text-[9px] font-semibold text-red-800 uppercase tracking-wider block mb-1">On: {rev.menuItemName}</span>
                        )}
                        <p className="text-gray-500 leading-relaxed italic">"{rev.comment}"</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* LIVE SLIDING CHECKOUT CART BAR (RIGHT COLUMN) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="sticky top-20 bg-white p-6 rounded-3xl border border-red-100 shadow-sm space-y-6">
                  
                  <div>
                    <h3 className="font-display font-bold text-base text-gray-900">Your Checkout Basket</h3>
                    <p className="text-xs text-gray-400 font-sans mt-0.5">Connected dynamically under {scannedTable}</p>
                  </div>

                  {totalCartCount === 0 ? (
                    <div className="text-center py-10 space-y-3">
                      <ShoppingCart className="h-10 w-10 text-red-100 mx-auto" />
                      <p className="text-xs text-gray-400 max-w-xs mx-auto">Your cart is currently empty. Tap products to include them in your lunch order.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Products list */}
                      <div className="divide-y divide-red-50 max-h-[240px] overflow-y-auto pr-1">
                        {Object.entries(cart).map(([itemId, qty]) => {
                          const item = menuItems.find(i => i.id === itemId);
                          if (!item) return null;
                          return (
                            <div key={itemId} className="py-3 flex justify-between items-center text-xs font-sans">
                              <div className="flex items-center space-x-2">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.name} referrerPolicy="no-referrer" className="h-9 w-9 rounded-lg object-cover bg-red-50" />
                                ) : (
                                  <div className="h-9 w-9 rounded-lg bg-red-50 flex items-center justify-center text-sm">🍲</div>
                                )}
                                <div>
                                  <span className="font-semibold text-gray-800 block capitalize">{item.name}</span>
                                  <span className="text-[10px] text-red-800 font-bold font-mono">₹{item.price.toFixed(2)}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center space-x-1.5 bg-red-50 p-1 rounded-lg">
                                  <button onClick={() => updateCartQty(item.id, false)} className="p-1 rounded-md bg-white hover:bg-red-100 text-amber-600">
                                    <Minus className="h-2.5 w-2.5" />
                                  </button>
                                  <span className="font-bold text-gray-800 px-1 font-mono">{qty}</span>
                                  <button onClick={() => updateCartQty(item.id, true)} className="p-1 rounded-md bg-white hover:bg-red-100 text-amber-600">
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
                      <div className="border-t border-red-100/60 pt-4 space-y-1.5 text-xs text-left">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Choose Pickup Slot</label>
                        <select
                          value={selectedSlot}
                          onChange={(e) => setSelectedSlot(e.target.value)}
                          className="w-full bg-red-50/50 hover:bg-red-50 focus:bg-white text-xs px-3 py-2.5 rounded-xl border border-red-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold cursor-pointer transition-all"
                        >
                          {availableTimeSlots.map(slot => (
                            <option key={slot} value={slot}>{slot}</option>
                          ))}
                        </select>
                      </div>

                      {/* Financial values */}
                      <div className="border-t border-red-100/60 pt-4 space-y-2.5 text-xs font-sans text-gray-500">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-mono text-gray-700">₹{cartSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Convenience Fee:</span>
                          <span className="font-mono text-gray-700">₹{displayedConvenienceFee.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-red-50 pt-2.5 flex justify-between font-bold text-sm text-gray-900">
                          <span>Grand Total Due:</span>
                          <span className="font-mono text-amber-700">₹{totalAmount.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* PAY WITH PAYTM BUTTON */}
                      <button
                        type="button"
                        onClick={handleTriggerGPay}
                        className="w-full bg-[#00baf2] hover:bg-[#00a3d9] text-white rounded-xl py-3.5 text-xs font-semibold shadow-md flex items-center justify-center space-x-2 transition cursor-pointer"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2 6.5l2.5-2h5l1.5 2h9v13h-18z"/><text x="7" y="15" fontSize="7" fontWeight="bold" fill="white">P</text></svg>
                        <span>Pay via Paytm</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* HISTORY TAB */
            <div className="max-w-4xl mx-auto space-y-8 text-left animate-fade-in">
              <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-xs space-y-4">
                <div>
                  <h3 className="font-display font-bold text-sm text-gray-900">Your Booking History</h3>
                  <p className="text-xs text-gray-400 font-sans mt-0.5">Track kitchen progress, countdowns, and click any order to retrieve its pickup QR code.</p>
                </div>

                {(() => {
                  const myOrders = orders
                    .filter(o =>
                      o.userId === userId ||
                      o.userId === 'user_guest'
                    )
                    .sort((a, b) => b.createdAt - a.createdAt);

                  if (myOrders.length === 0) {
                    return (
                      <p className="text-xs text-gray-400 text-center py-6">No previous bookings found in the database.</p>
                    );
                  }
                  return (
                    <div className="divide-y divide-red-100">
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
                                    : 'bg-red-50 text-amber-700'
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
                                  <span className={`${o.status === 'scheduled' || o.status === 'preparing' || o.status === 'ready' ? 'text-amber-700 font-black' : 'text-gray-300'}`}>● Scheduled</span>
                                  <span className="text-gray-300">➔</span>
                                  <span className={`${o.status === 'preparing' || o.status === 'ready' ? 'text-amber-700 font-black' : 'text-gray-300'}`}>● Preparing</span>
                                  <span className="text-gray-300">➔</span>
                                  <span className={`${o.status === 'ready' ? 'text-emerald-600 animate-pulse font-black' : 'text-gray-300'}`}>● Ready</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center space-x-3 shrink-0 self-end md:self-auto">
                              <span className="font-mono font-bold text-gray-950 text-sm">₹{o.totalPrice.toFixed(2)}</span>
                              <button
                                onClick={() => { setSuccessOrder(o); setQrPayload(o.qrPayload || o.qrCode || o.id); }}
                                className="bg-red-50 hover:bg-red-100 text-amber-700 border border-red-200 rounded-xl px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider transition flex items-center space-x-1 cursor-pointer"
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
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white rounded-2xl py-3 px-5 shadow-xl text-xs font-semibold animate-bounce shadow-amber-950/20 max-w-sm flex items-center space-x-2.5 border border-neutral-800">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 4. PAYTM PROCESSING OVERLAY */}
      {showGPayModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transition-all border border-neutral-200">
            <div className="bg-[#00baf2] px-5 py-4 flex items-center justify-center">
              <span className="text-white font-bold text-lg tracking-tight">Paytm</span>
            </div>
            <div className="p-8 text-center space-y-4">
              {isSubmittingOrder ? (
                <>
                  <div className="h-10 w-10 border-4 border-[#00baf2] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-gray-700">Connecting to Paytm...</p>
                  <p className="text-xs text-gray-400">Please wait while we redirect you</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500">Something went wrong.</p>
                  <button onClick={() => setShowGPayModal(false)} className="mt-2 px-4 py-2 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-200">Close</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BRANDED FOOTER */}
      <footer className={`mt-12 bg-gray-900 text-white`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className={`grid grid-cols-1 ${bFooterLayout === '3-col' ? 'md:grid-cols-3' : bFooterLayout === '2-col' ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-10`}>
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {userCollege?.logoUrl ? (
                  <img src={userCollege.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover border border-white/20" />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-red-900 flex items-center justify-center text-lg font-bold border border-white/20">{userCollege?.name?.charAt(0) || 'S'}</div>
                )}
                <div>
                    <p className="font-display font-black text-xl tracking-tight" dangerouslySetInnerHTML={{ __html: bHeroTitle }} />
                  <p className="text-[10px] text-gray-400 font-sans">Campus Smart Canteen Platform</p>
                </div>
              </div>
               <p className="text-[11px] text-gray-500 font-sans">Powered by {userCollege?.name || 'Esc(Q)'}</p>
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
              <h4 className="font-display font-bold text-sm">Quick Links</h4>
              <ul className="space-y-2 text-[11px] text-gray-400">
                {bFooterLinks.map((link: any, i: number) => (
                  <li
                    key={i}
                    onClick={() => {
                      if (link.action === 'menu') { setCustomerTab('menu'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                      else if (link.action === 'history') { setCustomerTab('history'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                      else if (link.action === 'profile') { setToastMessage('Profile settings are available in the top-right menu.'); setTimeout(() => setToastMessage(''), 3000); }
                      else { setToastMessage(`For help, contact ${bContactEmail} or call ${bContactPhone}`); setTimeout(() => setToastMessage(''), 4000); }
                    }}
                    className="hover:text-white cursor-pointer transition flex items-center gap-1.5"
                  >
                    <span className="text-gray-600">&gt;</span> {link.label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h4 className="font-display font-bold text-sm">Contact Us</h4>
              <ul className="space-y-2.5 text-[11px] text-gray-400">
                <li className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  {bContactPhone}
                </li>
                <li className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  {bContactEmail}
                </li>
                <li className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {bContactAddress}
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between text-[10px] text-gray-500 font-sans gap-2">
            <span dangerouslySetInnerHTML={{ __html: bFooterCopyright }} />
            <div className="flex items-center gap-4">
              <span className="hover:text-white cursor-pointer transition">Privacy Policy</span>
              <span>|</span>
              <span className="hover:text-white cursor-pointer transition">Terms & Conditions</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
