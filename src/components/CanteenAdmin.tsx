import React, { useState, useEffect } from 'react';
import {
  ChefHat, Layers, ClipboardList, TrendingUp, AlertTriangle, Star, CheckCircle,
  Plus, Edit2, Trash2, ShieldCheck, QrCode, Search, RefreshCw, X, MessageSquare, Sparkles, LogOut, Package,
  Camera, Check, AlertCircle, Clock, User, Play, PlayCircle, Settings, ShieldAlert, ShoppingCart
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { MenuItem, Order, Review, Ingredient, CanteenSettings } from '../types';
import { API_BASE } from '../config';
import WalkinPOS from './WalkinPOS';

interface CanteenAdminProps {
  menuItems: MenuItem[];
  orders: Order[];
  reviews: Review[];
  ingredients: Ingredient[];
  settings?: CanteenSettings;
  onAddMenuItem: (payload: any) => Promise<any>;
  onDeleteMenuItem: (id: string) => Promise<any>;
  onUpdateOrderStatus: (id: string, status: string) => Promise<any>;
  onFetchCanteen: () => void;
  onLogout: () => void;
  userRole?: 'owner' | 'chef' | 'staff';
  subCanteenId?: string;
}

function parseSlotToTimestamp(slot: string): number {
  const match = slot.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return Date.now();
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

export default function CanteenAdmin({
  menuItems,
  orders: rawOrders,
  reviews,
  ingredients,
  settings,
  onAddMenuItem,
  onDeleteMenuItem,
  onUpdateOrderStatus,
  onFetchCanteen,
  onLogout,
  userRole,
  subCanteenId
}: CanteenAdminProps) {
  const orders = subCanteenId
    ? rawOrders.filter(o => !o.subCanteenId || o.subCanteenId === subCanteenId)
    : rawOrders;

  const [activeTab, setActiveTab] = useState<'chef' | 'counter' | 'owner'>(
    userRole === 'chef' ? 'chef' : userRole === 'staff' ? 'counter' : 'chef'
  );
  const [ownerSubTab, setOwnerSubTab] = useState<'orders_mgr' | 'pos' | 'menu' | 'inventory' | 'revenue' | 'settings' | 'reviews' | 'ai'>('orders_mgr');
  
  // State for editing order slots in Canteen Owner Hub
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderSlot, setEditingOrderSlot] = useState<string>('');
  
  // Search state and real camera integration
  const [scannedReceiptId, setScannedReceiptId] = useState<string>('');
  const [matchedOrderId, setMatchedOrderId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [useRealCamera, setUseRealCamera] = useState<boolean>(false);

  const [searchCode, setSearchCode] = useState('');
  const [scanStatus, setScanStatus] = useState<{ success: boolean; text: string } | null>(null);
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [alreadyServedOrderId, setAlreadyServedOrderId] = useState<string | null>(null);
  const [isScanningActive, setIsScanningActive] = useState(false);
  
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  // Auto clean-up camera stream on unmount or tab switch
  React.useEffect(() => {
    if (activeTab !== 'counter' && useRealCamera) {
      stopRealCamera();
    }
  }, [activeTab]);

  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRealCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setUseRealCamera(true);
    } catch (err) {
      console.error("Failed to acquire camera: ", err);
      alert("Could not access your device's camera. Ensure you gave camera permissions to the applet in your browser, or that no other app is currently using the camera.");
    }
  };

  const stopRealCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setUseRealCamera(false);
  };

  // Derive matched order dynamically so it reflects real-time status changes instantly
  const matchedOrder = orders.find(
    o => o.id === matchedOrderId || o.qrCode === matchedOrderId || o.id.toLowerCase() === matchedOrderId.toLowerCase()
  ) || null;
  
  // Menu form state
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formStock, setFormStock] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Meals');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formPrepTime, setFormPrepTime] = useState<string>('15');
  const [formDailyLimit, setFormDailyLimit] = useState<string>('100');
  const [formRequiresChef, setFormRequiresChef] = useState<boolean>(true);
  const [formRecipe, setFormRecipe] = useState<{ ingredientId: string; amountGrams: number }[]>([]);

  // Config settings form states
  const [noShowMinutesVal, setNoShowMinutesVal] = useState<string>('30');
  const [defaultSlotCapacityVal, setDefaultSlotCapacityVal] = useState<string>('30');
  const [updatingSettings, setUpdatingSettings] = useState<boolean>(false);

  // Ingredient CRUD Form State
  const [showIngModal, setShowIngModal] = useState<boolean>(false);
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null);
  const [formIngName, setFormIngName] = useState<string>('');
  const [formIngStock, setFormIngStock] = useState<string>('');
  const [formIngUnit, setFormIngUnit] = useState<string>('g');

  const handleOpenAddIngModal = () => {
    setEditingIng(null);
    setFormIngName('');
    setFormIngStock('1000');
    setFormIngUnit('g');
    setShowIngModal(true);
  };

  const handleOpenEditIngModal = (ing: Ingredient) => {
    setEditingIng(ing);
    setFormIngName(ing.name);
    setFormIngStock(ing.stockGrams.toString());
    setFormIngUnit(ing.unit);
    setShowIngModal(true);
  };

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formIngName || isNaN(Number(formIngStock))) return;
    try {
      const resp = await fetch(`${API_BASE}/api/canteen/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingIng?.id || undefined,
          name: formIngName,
          stockGrams: Number(formIngStock),
          unit: formIngUnit
        })
      });
      const data = await resp.json();
      if (data.success) {
        setShowIngModal(false);
        onFetchCanteen();
      } else {
        alert(data.error || "Failed to save ingredient");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteIngredient = async (ingId: string) => {
    if (!confirm('Are you sure you want to delete this ingredient?')) return;
    try {
      const resp = await fetch(`${API_BASE}/api/canteen/ingredients/${ingId}`, {
        method: 'DELETE'
      });
      const data = await resp.json();
      if (data.success) {
        onFetchCanteen();
      } else {
        alert(data.error || "Failed to delete ingredient");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Sync settings prop when it loads
  React.useEffect(() => {
    if (settings) {
      setNoShowMinutesVal(settings.noShowMinutes.toString());
      setDefaultSlotCapacityVal(settings.defaultSlotCapacity.toString());
    }
  }, [settings]);



  // Compute stats
  const totalIncome = orders
    .filter(o => o.status === 'collected' || o.status === 'delivered')
    .reduce((sum, o) => sum + o.totalPrice, 0);

  const pendingOrders = orders.filter(o => o.status === 'scheduled' || o.status === 'preparing' || o.status === 'pending');
  const preppingOrdersCount = orders.filter(o => o.status === 'preparing').length;
  const readyOrdersCount = orders.filter(o => o.status === 'ready').length;
  const outOfStockItemsCount = menuItems.filter(i => i.stock === 0).length;
  const lowStockItems = menuItems.filter(i => i.stock < 3);

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '4.8';

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormPrice('120');
    setFormStock('40');
    setFormCategory('Meals');
    setFormDescription('');
    setFormImageUrl('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop');
    setFormPrepTime('15');
    setFormDailyLimit('100');
    setFormRequiresChef(true);
    setFormRecipe([]);
    setShowItemModal(true);
  };

  const handleOpenEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormPrice(item.price.toString());
    setFormStock(item.stock.toString());
    setFormCategory(item.category);
    setFormDescription(item.description);
    setFormImageUrl(item.imageUrl || '');
    setFormPrepTime(item.prepTime?.toString() || '15');
    setFormDailyLimit(item.dailyLimit?.toString() || '100');
    setFormRequiresChef(item.requiresChef !== false);
    setFormRecipe(item.recipe || []);
    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || isNaN(Number(formPrice)) || isNaN(Number(formStock))) return;

    const payload = {
      id: editingItem ? editingItem.id : undefined,
      name: formName,
      price: Number(formPrice),
      stock: Number(formStock),
      category: formCategory,
      description: formDescription,
      imageUrl: formImageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop',
      available: Number(formStock) > 0,
      tags: formCategory === 'Meals' ? ['lunch', 'dinner'] : ['beverage', 'snack'],
      prepTime: Number(formPrepTime) || 10,
      dailyLimit: Number(formDailyLimit) || 100,
      requiresChef: formRequiresChef,
      isPaused: editingItem ? editingItem.isPaused : false,
      recipe: formRecipe.filter(r => r.amountGrams > 0)
    };

    const res = await onAddMenuItem(payload);
    if (res && res.success) {
      setShowItemModal(false);
      onFetchCanteen();
    } else {
      alert("Error saving item. Check backend logs.");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm("Are you sure you want to retire this food option from the live menu?")) {
      const res = await onDeleteMenuItem(id);
      if (res && res.success) {
        onFetchCanteen();
      }
    }
  };

  // Helper to generate a beep sound using HTML5 Web Audio API
  const playBeep = (freq = 880, duration = 120) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      osc.start();
      setTimeout(() => {
        osc.stop();
        audioCtx.close();
      }, duration);
    } catch (e) {
      // Browsers often block AudioContext initially until user interacts, ignore
    }
  };

  // Simulate scanning the customer's generated QR code
  const handleSimulateQRScan = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsScanning(true);
    setScannedReceiptId(queryText.trim());
    
    // Short initial interaction ticker sound
    playBeep(440, 50);

    try {
      // Verify against live database via server endpoint
      const resp = await fetch(`${API_BASE}/api/canteen/qr/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: queryText.trim() })
      });
      const data = await resp.json();
      setIsScanning(false);
      if (data.success && data.verified && data.order) {
        setMatchedOrderId(data.order.id);
        playBeep(880, 150);
      } else {
        // Fallback to local lookup
        const cleanQuery = queryText.trim().toLowerCase();
        const found = orders.find(o => 
          o.id.toLowerCase() === cleanQuery ||
          (o.qrCode || '').toLowerCase() === cleanQuery ||
          cleanQuery.includes(o.id.toLowerCase()) ||
          (o.qrCode || '').toLowerCase().includes(cleanQuery)
        );
        if (found) {
          setMatchedOrderId(found.id);
          playBeep(880, 150);
        } else {
          setMatchedOrderId('');
          playBeep(220, 300);
          alert(`No order found matching tag/ID "${queryText}". Ensure it matches an active student ticket.`);
        }
      }
    } catch (err) {
      console.error('QR verify API failed, using local lookup:', err);
      const cleanQuery = queryText.trim().toLowerCase();
      const found = orders.find(o => 
        o.id.toLowerCase() === cleanQuery ||
        (o.qrCode || '').toLowerCase() === cleanQuery ||
        cleanQuery.includes(o.id.toLowerCase()) ||
        (o.qrCode || '').toLowerCase().includes(cleanQuery)
      );
      setIsScanning(false);
      if (found) {
        setMatchedOrderId(found.id);
        playBeep(880, 150);
      } else {
        setMatchedOrderId('');
        playBeep(220, 300);
        alert(`No order found matching tag/ID "${queryText}". Ensure it matches an active student ticket.`);
      }
    }
  };

  const handleCycleStatus = async (orderId: string, currentStatus: string) => {
    let nextStatus = 'preparing';
    if (currentStatus === 'pending') nextStatus = 'preparing';
    else if (currentStatus === 'preparing') nextStatus = 'ready';
    else if (currentStatus === 'ready') nextStatus = 'delivered';

    await onUpdateOrderStatus(orderId, nextStatus);
    onFetchCanteen();
  };

  const handleMarkAsServed = async (orderId: string) => {
    await onUpdateOrderStatus(orderId, 'delivered');
    onFetchCanteen();
    // Warm chime upon food handover serving mark
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      osc.start();
      setTimeout(() => {
        osc.stop();
        audioCtx.close();
      }, 250);
    } catch (e) {
      // Audio context blocked
    }
  };

  const handleSearchReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (scannedReceiptId.trim()) {
      handleSimulateQRScan(scannedReceiptId.trim());
    }
  };

  const handleUpdateOrderSlot = async (orderId: string) => {
    if (!editingOrderSlot.trim()) return;
    try {
      const resp = await fetch(`${API_BASE}/api/canteen/order/update-slot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, pickupSlot: editingOrderSlot })
      });
      const data = await resp.json();
      if (data.success) {
        setEditingOrderId(null);
        onFetchCanteen();
      } else {
        alert(data.error || "Failed to update order slot");
      }
    } catch (e) {
      console.error(e);
    }
  };




  // Save settings handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingSettings(true);
    try {
      const resp = await fetch(`${API_BASE}/api/canteen/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noShowMinutes: Number(noShowMinutesVal),
          defaultSlotCapacity: Number(defaultSlotCapacityVal)
        })
      });
      const data = await resp.json();
      if (data.success) {
        alert("Settings updated successfully!");
        onFetchCanteen();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingSettings(false);
    }
  };


  // Toggle item paused control
  const handleTogglePause = async (item: MenuItem) => {
    const updated = {
      ...item,
      isPaused: !item.isPaused
    };
    const res = await onAddMenuItem(updated);
    if (res && res.success) {
      onFetchCanteen();
    }
  };

  // Batch Cook action helpers
  const startBatchCooking = async (slot: string, itemId: string) => {
    const slotOrders = orders.filter(o => o.pickupSlot === slot && o.status === 'scheduled');
    const matchedOrderIds = slotOrders
      .filter(o => o.items.some(it => it.itemId === itemId))
      .map(o => o.id);
    
    if (matchedOrderIds.length > 0) {
      await handleUpdateBatchStatus(matchedOrderIds, 'preparing');
      playBeep(600, 150);
    }
  };

  const finishBatchCooking = async (slot: string, itemId: string) => {
    const slotOrders = orders.filter(o => o.pickupSlot === slot && o.status === 'preparing');
    const matchedOrderIds = slotOrders
      .filter(o => o.items.some(it => it.itemId === itemId))
      .map(o => o.id);
    
    if (matchedOrderIds.length > 0) {
      await handleUpdateBatchStatus(matchedOrderIds, 'ready');
      playBeep(880, 200);
    }
  };

  const handleUpdateBatchStatus = async (orderIds: string[], nextStatus: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/canteen/order/batch-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: orderIds, status: nextStatus })
      });
      const data = await resp.json();
      if (data.success) {
        onFetchCanteen();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Group Chef timeline orders using: Priority = Pickup Time + FIFO
  const sortedChefOrders = [...orders]
    .filter(o => o.status === 'scheduled' || o.status === 'preparing' || o.status === 'ready')
    .filter(o => o.items.some(it => {
      const itemMenu = menuItems.find(m => m.id === it.itemId);
      return itemMenu ? itemMenu.requiresChef !== false : true;
    }))
    .sort((a, b) => {
      // Sort by pickup slot time first
      const timeA = parseSlotToTimestamp(a.pickupSlot || '12:00 PM');
      const timeB = parseSlotToTimestamp(b.pickupSlot || '12:00 PM');
      if (timeA !== timeB) return timeA - timeB;
      // FIFO within same slot
      return a.createdAt - b.createdAt;
    });

  // Aggregated slot demands for Chef (Bulk orders)
  const slotAggregatedDemands: { [slot: string]: { [itemId: string]: { name: string; quantity: number; status: string } } } = {};
  orders.forEach(o => {
    if (o.status === 'scheduled' || o.status === 'preparing') {
      const slot = o.pickupSlot || '12:00 PM';
      o.items.forEach(it => {
        const itemMenu = menuItems.find(m => m.id === it.itemId);
        const requiresChef = itemMenu ? itemMenu.requiresChef !== false : true;
        if (!requiresChef) return; // skip non-chef items

        if (!slotAggregatedDemands[slot]) slotAggregatedDemands[slot] = {};
        if (!slotAggregatedDemands[slot][it.itemId]) {
          slotAggregatedDemands[slot][it.itemId] = { name: it.name, quantity: 0, status: o.status };
        }
        slotAggregatedDemands[slot][it.itemId].quantity += it.quantity;
      });
    }
  });

  // Calculate total chef ingredient requirements
  const totalIngredientRequirements: { [name: string]: number } = {};
  orders.forEach(o => {
    if (o.status === 'scheduled' || o.status === 'preparing') {
      o.items.forEach(it => {
        const itemMenu = menuItems.find(m => m.id === it.itemId);
        const requiresChef = itemMenu ? itemMenu.requiresChef !== false : true;
        if (!requiresChef) return; // skip non-chef items

        if (itemMenu && itemMenu.recipe) {
          itemMenu.recipe.forEach(recipeItem => {
            const ingProfile = ingredients.find(ing => ing.id === recipeItem.ingredientId);
            if (ingProfile) {
              totalIngredientRequirements[ingProfile.name] = (totalIngredientRequirements[ingProfile.name] || 0) + (recipeItem.amountGrams * it.quantity);
            }
          });
        }
      });
    }
  });

  // Counter staff live counters
  const totalCollectedCount = orders.filter(o => o.status === 'collected' || o.status === 'delivered').length;
  const totalRemainingCount = orders.filter(o => o.status === 'scheduled' || o.status === 'preparing' || o.status === 'ready').length;

  // ===== SHARED SCANNER FUNCTIONS (staff + counter) =====
  const handleOrderLoadedStaff = async (orderId: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/canteen/qr/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: orderId })
      });
      const data = await resp.json();
      if (data.success && data.verified && data.order) {
        if (data.order.status === 'delivered' || data.order.status === 'collected') {
          setAlreadyServedOrderId(data.order.id);
          setScannedOrder(null);
          setScanStatus(null);
        } else {
          setScannedOrder(data.order);
          setAlreadyServedOrderId(null);
          setScanStatus(null);
        }
        return;
      }
    } catch (err) {
      console.error('QR verify API failed:', err);
    }

    // Fallback 1: Direct walkin bill lookup
    try {
      const lookupResp = await fetch(`${API_BASE}/api/canteen/walkin-bill/lookup?billNumber=${encodeURIComponent(orderId.trim())}`);
      const lookupData = await lookupResp.json();
      if (lookupData.success && lookupData.order) {
        const order = lookupData.order;
        if (order.status === 'delivered' || order.status === 'collected') {
          setAlreadyServedOrderId(order.id);
          setScannedOrder(null);
          setScanStatus(null);
        } else {
          setScannedOrder(order);
          setAlreadyServedOrderId(null);
          setScanStatus(null);
        }
        return;
      }
    } catch (err) {
      console.error('Walkin bill lookup failed:', err);
    }

    // Fallback 2: local in-memory lookup
    const cleanQuery = orderId.trim().toLowerCase();
    const found = orders.find(o =>
      o.id.toLowerCase() === cleanQuery ||
      (o.qrCode || '').toLowerCase() === cleanQuery ||
      (o.qrCode || '').toLowerCase().includes(cleanQuery) ||
      cleanQuery.includes(o.id.toLowerCase())
    );

    if (found) {
      if (found.status === 'delivered') {
        setAlreadyServedOrderId(found.id);
        setScannedOrder(null);
        setScanStatus(null);
      } else {
        setScannedOrder(found);
        setAlreadyServedOrderId(null);
        setScanStatus(null);
      }
    } else {
      setScannedOrder(null);
      setAlreadyServedOrderId(null);
      setScanStatus({
        success: false,
        text: `NOT FOUND: Ticket ID #${orderId} was not found in the canteen database.`
      });
    }
  };

  const handleSimulateQRScanStaff = async (orderId: string) => {
    setIsScanningActive(true);
    setScanStatus(null);
    setScannedOrder(null);
    setAlreadyServedOrderId(null);
    playBeep(950, 150);
    try {
      await handleOrderLoadedStaff(orderId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanningActive(false);
    }
  };

  const startCameraScannerStaff = () => {
    setIsCameraActive(true);
    setScanStatus(null);
    setAlreadyServedOrderId(null);
    setScannedOrder(null);
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode("reader-staff");
      const qrCodeSuccessCallback = (decodedText: string) => {
        playBeep(950, 150);
        html5QrCode.stop().then(async () => {
          setIsCameraActive(false);
          await handleOrderLoadedStaff(decodedText);
        }).catch(async () => {
          setIsCameraActive(false);
          await handleOrderLoadedStaff(decodedText);
        });
      };
      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
        const qrboxSize = Math.floor(minEdgeSize * 0.7);
        return { width: qrboxSize, height: qrboxSize };
      };
      html5QrCode.start({ facingMode: "environment" }, { fps: 20, qrbox: qrboxFunction, aspectRatio: 1.0 }, qrCodeSuccessCallback, () => {})
        .then(() => { (window as any).activeQrCodeScannerStaff = html5QrCode; })
        .catch(err => {
          console.error("Error starting camera qr scanner", err);
          alert("Could not start camera. Make sure camera permission is granted.");
          setIsCameraActive(false);
        });
    }, 300);
  };

  const stopCameraScannerStaff = () => {
    const scanner = (window as any).activeQrCodeScannerStaff;
    if (scanner) {
      scanner.stop().then(() => {
        setIsCameraActive(false);
        (window as any).activeQrCodeScannerStaff = null;
      }).catch(() => { setIsCameraActive(false); });
    } else {
      setIsCameraActive(false);
    }
  };

  const handleMarkAsServedStaff = async (orderId: string) => {
    try {
      const res = await onUpdateOrderStatus(orderId, 'delivered');
      if (res.success) {
        setScanStatus({ success: true, text: `SUCCESS: Order #${orderId} successfully marked as Served!` });
        setScannedOrder(prev => prev && prev.id === orderId ? { ...prev, status: 'delivered' } : prev);
        onFetchCanteen();
      } else {
        setScanStatus({ success: false, text: `FAILED: Could not update status for order #${orderId}.` });
      }
    } catch (err) {
      console.error(err);
      setScanStatus({ success: false, text: `FAILED: Network error setting served status.` });
    }
  };

  const handleManualCodeLookupStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCode.trim()) return;
    handleOrderLoadedStaff(searchCode.trim());
  };

  if (userRole === 'staff') {
    return (
      <div className="max-w-7xl mx-auto space-y-6 py-6 text-left px-4">
        {/* ALREADY SERVED RED BANNER */}
        {alreadyServedOrderId && (
          <div className="bg-rose-500 text-white p-4 rounded-2xl shadow-lg shadow-rose-500/10 flex items-start space-x-3 relative animate-fade-in text-left">
            <ShieldAlert className="h-5 w-5 text-white shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-sm">Order Already Served</h4>
              <p className="text-xs text-rose-100 mt-1 font-sans">
                This order ({alreadyServedOrderId}) has already been marked as completed/delivered.
              </p>
            </div>
            <button 
              onClick={() => setAlreadyServedOrderId(null)} 
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 shrink-0 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ERROR LOG BAR */}
        {scanStatus && !scanStatus.success && (
          <div className="p-4 rounded-2xl text-xs font-sans flex items-start space-x-2.5 border bg-rose-50/80 border-rose-200/60 text-rose-800 text-left shadow-xs">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-500" />
            <div>
              <span className="font-bold block tracking-wide uppercase text-[10px] mb-0.5">Verification Error</span>
              <p>{scanStatus.text}</p>
            </div>
          </div>
        )}

        {/* SUCCESS LOG BAR */}
        {scanStatus && scanStatus.success && (
          <div className="p-4 rounded-2xl text-xs font-sans flex items-start space-x-2.5 border bg-emerald-50/80 border-emerald-200/60 text-emerald-800 text-left shadow-xs">
            <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
            <div>
              <span className="font-bold block tracking-wide uppercase text-[10px] mb-0.5">Verification Success</span>
              <p>{scanStatus.text}</p>
            </div>
          </div>
        )}

        {/* SCAN & SERVE CENTRAL CONTROLLER */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-violet-100/70 shadow-sm text-center space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-left gap-4">
            <div>
              <h2 className="font-display font-black text-xl text-gray-900 tracking-tight">Staff Order Scan & Serve</h2>
              <p className="text-xs text-gray-400 mt-1 font-sans">
                Scan a student's QR code to retrieve, verify, and complete their order.
              </p>
            </div>
            <button
              onClick={startCameraScannerStaff}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-750 hover:to-fuchsia-750 active:scale-98 text-white font-semibold py-3 px-5 rounded-2xl text-xs tracking-wide transition-all shadow-md flex items-center space-x-2 cursor-pointer font-display self-start sm:self-auto"
            >
              <QrCode className="h-4.5 w-4.5" />
              <span>Open Camera Scanner</span>
            </button>
          </div>

          {/* Manual code lookup form */}
          <div className="border-t border-violet-50 pt-4 text-left">
            <form onSubmit={handleManualCodeLookupStaff} className="flex gap-2 max-w-xl">
              <input
                type="text"
                placeholder="Paste/Type Order ID (e.g. 4bZHdu1ca9qs...)"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="flex-1 bg-violet-50/30 hover:bg-violet-50/60 focus:bg-white text-xs px-4 py-3.5 border border-violet-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 font-mono transition-all"
              />
              <button
                type="submit"
                className="bg-violet-600 hover:bg-violet-750 text-white rounded-xl text-xs px-6 font-semibold transition-all shadow-md shrink-0 flex items-center space-x-1.5 cursor-pointer font-display"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Verify Ticket</span>
              </button>
            </form>
          </div>
        </div>

        {/* REAL CAMERA SCANNER OVERLAY MODAL */}
        {isCameraActive && (
          <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full relative border border-violet-100 text-center shadow-2xl">
              <button 
                onClick={stopCameraScannerStaff}
                className="absolute top-5 right-5 p-1 text-gray-400 hover:text-gray-655 transition rounded-full hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="font-display font-bold text-gray-900 mb-2">Scan Customer QR Code</h3>
              <p className="text-xs text-gray-400 mb-4 font-sans">Point your device camera at the customer's order QR code screen</p>
              
              <div id="reader-staff" className="w-full overflow-hidden rounded-2xl bg-neutral-900 aspect-square flex items-center justify-center border border-neutral-800" />
            </div>
          </div>
        )}

        {/* ORDER DETAILS MODAL SHEET */}
        {scannedOrder && scannedOrder.status !== 'delivered' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden p-6 relative border border-violet-100 text-left">
              <button 
                onClick={() => setScannedOrder(null)} 
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-655 transition p-1 hover:bg-gray-55 rounded-full cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
              
              <h2 className="font-display font-bold text-lg text-gray-900 text-center">
                {(scannedOrder as any).type === 'walkin' ? 'Walk-in Bill Details' : 'Order Details'}
              </h2>
              <p className="text-[11px] text-gray-400 text-center mt-1">
                {(scannedOrder as any).type === 'walkin'
                  ? `Bill ${(scannedOrder as any).billNumber || scannedOrder.id}`
                  : `Complete information for order ${scannedOrder.id}.`}
              </p>

              <div className="border-t border-violet-50 my-4" />

              <div className="space-y-3.5 text-xs font-sans">
                {(scannedOrder as any).type === 'walkin' && (scannedOrder as any).customerName && (
                  <div className="flex justify-between py-1 border-b border-violet-50/50">
                    <span className="text-violet-750 font-medium">Customer:</span>
                    <span className="font-semibold text-gray-900">{(scannedOrder as any).customerName}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-violet-50/50">
                  <span className="text-violet-750 font-medium">
                    {(scannedOrder as any).type === 'walkin' ? 'Bill Number:' : 'Customer ID:'}
                  </span>
                  <span className="font-mono text-gray-600 truncate max-w-[200px] select-all">
                    {(scannedOrder as any).billNumber || scannedOrder.userId}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-violet-50/50">
                  <span className="text-violet-750 font-medium">
                    {(scannedOrder as any).type === 'walkin' ? 'Bill ID:' : 'Order ID:'}
                  </span>
                  <span className="font-mono text-gray-955 font-bold">{scannedOrder.id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-violet-50/50">
                  <span className="text-violet-750 font-medium">Date:</span>
                  <span className="font-semibold text-gray-900">
                    {new Date(scannedOrder.timestamp || scannedOrder.createdAt).toLocaleString()}
                  </span>
                </div>
                {(scannedOrder as any).type === 'walkin' && (
                  <div className="flex justify-between py-1 border-b border-violet-50/50">
                    <span className="text-violet-750 font-medium">Payment:</span>
                    <span className="font-semibold text-gray-900 capitalize">
                      {(scannedOrder as any).paymentMethod || 'cash'} ({(scannedOrder as any).paymentStatus || 'pending'})
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1 items-center border-b border-violet-50/50">
                  <span className="text-violet-750 font-medium">Status:</span>
                  <span className="px-3 py-1 bg-violet-600 text-white text-[10px] font-bold rounded-full uppercase">
                    {scannedOrder.status}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="font-display font-bold text-xs text-gray-900 mb-3">Items Ordered</h3>
                
                <div className="grid grid-cols-12 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-violet-50 pb-2 mb-2">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2 text-center">Quantity</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                <div className="divide-y divide-violet-50/50 max-h-[160px] overflow-y-auto pr-1">
                  {scannedOrder.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 items-center py-2.5 text-xs font-sans text-gray-800">
                      <div className="col-span-6 font-medium capitalize truncate">{item.name}</div>
                      <div className="col-span-2 text-center font-mono font-semibold">{item.quantity}</div>
                      <div className="col-span-2 text-right font-mono">₹{item.price.toFixed(2)}</div>
                      <div className="col-span-2 text-right font-mono font-semibold">₹{(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {(() => {
                const orderFoodAmount = scannedOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                const isWalkin = (scannedOrder as any).type === 'walkin';
                const orderFee = isWalkin ? 0 : Math.max(0, scannedOrder.totalPrice - orderFoodAmount);
                return (
                  <div className="border-t border-violet-100 pt-4 mt-4 space-y-2.5 text-xs font-sans text-gray-500">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-mono text-gray-900 font-medium">₹{orderFoodAmount.toFixed(2)}</span>
                    </div>
                    {!isWalkin && orderFee > 0 && (
                      <div className="flex justify-between">
                        <span>Convenience Fee:</span>
                        <span className="font-mono text-gray-900 font-medium">₹{orderFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-violet-50 pt-3 flex justify-between font-bold text-sm text-gray-900">
                      <span>Grand Total:</span>
                      <span className="font-mono text-violet-750 text-base">₹{scannedOrder.totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-6 space-y-2">
                <button
                  onClick={async () => {
                    await handleMarkAsServedStaff(scannedOrder.id);
                    setScannedOrder(null);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3 px-4 rounded-xl text-xs tracking-wide transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer font-display"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Mark as Served / Handover</span>
                </button>
                <button
                  onClick={() => setScannedOrder(null)}
                  className="w-full bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold py-3 px-4 rounded-xl text-xs tracking-wide transition-all border border-gray-200 cursor-pointer font-display"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LIVE ACTIVE TICKETS 3-COLUMN QUEUE */}
        <div className="space-y-6 pt-6 border-t border-violet-150">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-lg text-gray-900">Live Counter Queue</h2>
              <p className="text-xs text-gray-400 font-sans">Real-time status of student kitchen tickets and handovers.</p>
            </div>
            <button
              onClick={onFetchCanteen}
              className="p-2 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-lg transition"
            >
              <RefreshCw className="h-4 w-4 animate-spin-slow" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMN 1: PREPARING / QUEUED */}
            <div className="bg-white p-5 rounded-3xl border border-violet-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-violet-50 pb-3">
                <div>
                  <h3 className="font-display font-bold text-sm text-gray-900">Preparing</h3>
                  <p className="text-[10px] text-gray-400 font-sans">Dishes currently in the kitchen.</p>
                </div>
                <span className="bg-amber-50 text-amber-700 font-bold font-mono text-[10px] px-2 py-0.5 rounded-full">
                  {orders.filter(o => o.status === 'preparing' || o.status === 'scheduled' || o.status === 'pending').length} active
                </span>
              </div>

              {orders.filter(o => o.status === 'preparing' || o.status === 'scheduled' || o.status === 'pending').length === 0 ? (
                <div className="text-center py-8 text-gray-400 font-sans text-xs">
                  No orders in preparation.
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {orders.filter(o => o.status === 'preparing' || o.status === 'scheduled' || o.status === 'pending').map((order) => (
                    <div key={order.id} className="p-3 bg-amber-50/20 border border-amber-100/50 rounded-2xl space-y-2 text-left">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono text-[10px] font-bold text-violet-750 block">{order.id}</span>
                          <span className="text-xs font-semibold text-gray-800">{order.userName}</span>
                        </div>
                        <span className="bg-amber-50 text-amber-800 border border-amber-100 text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase">
                          {order.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-sans">
                        {order.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                      </p>
                      <button
                        onClick={() => handleCycleStatus(order.id, order.status)}
                        className="w-full bg-amber-600 hover:bg-amber-750 text-white rounded-xl py-1.5 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
                      >
                        Set Ready
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COLUMN 2: READY FOR COLLECTION */}
            <div className="bg-white p-5 rounded-3xl border border-violet-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-violet-50 pb-3">
                <div>
                  <h3 className="font-display font-bold text-sm text-gray-900">Ready for Collection</h3>
                  <p className="text-[10px] text-gray-400 font-sans">Prepared and waiting at counter.</p>
                </div>
                <span className="bg-emerald-50 text-emerald-700 font-bold font-mono text-[10px] px-2 py-0.5 rounded-full">
                  {orders.filter(o => o.status === 'ready').length} ready
                </span>
              </div>

              {orders.filter(o => o.status === 'ready').length === 0 ? (
                <div className="text-center py-8 text-gray-400 font-sans text-xs">
                  No orders ready for collection.
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {orders.filter(o => o.status === 'ready').map((order) => (
                    <div key={order.id} className="p-3 bg-emerald-50/20 border border-emerald-100/50 rounded-2xl space-y-2 text-left">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono text-[10px] font-bold text-violet-750 block">{order.id}</span>
                          <span className="text-xs font-semibold text-gray-800">{order.userName}</span>
                        </div>
                        <span className="bg-emerald-50 text-emerald-850 border border-emerald-100 text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase">
                          READY
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-550 font-sans">
                        {order.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                      </p>
                      <button
                        onClick={() => handleMarkAsServedStaff(order.id)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-1.5 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
                      >
                        Serve / Handover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COLUMN 3: SERVED / DELIVERED */}
            <div className="bg-white p-5 rounded-3xl border border-violet-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-violet-50 pb-3">
                <div>
                  <h3 className="font-display font-bold text-sm text-gray-900">Served / Delivered</h3>
                  <p className="text-[10px] text-gray-400 font-sans">Recently completed orders.</p>
                </div>
                <span className="bg-violet-50 text-violet-700 font-bold font-mono text-[10px] px-2 py-0.5 rounded-full">
                  {orders.filter(o => o.status === 'delivered' || o.status === 'collected').length} completed
                </span>
              </div>

              {orders.filter(o => o.status === 'delivered' || o.status === 'collected').length === 0 ? (
                <div className="text-center py-8 text-gray-450 font-sans text-xs">
                  No served orders.
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {[...orders]
                    .filter(o => o.status === 'delivered' || o.status === 'collected')
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                    .slice(0, 15)
                    .map((order) => (
                      <div key={order.id} className="p-3 bg-gray-50 border border-gray-100 rounded-2xl space-y-1.5 text-left">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-[10px] font-bold text-gray-500 block">{order.id}</span>
                            <span className="text-xs font-semibold text-gray-800">{order.userName}</span>
                          </div>
                          <span className="bg-gray-100 text-gray-600 border border-gray-200 text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase">
                            Delivered
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-sans">
                          {order.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-left">
      
      {/* CONDITIONAL ALERT NOTIFICATION FOR LOW STOCK */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-2xl p-4.5 shadow-sm space-y-2">
          <div className="flex items-start space-x-3 text-left">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-display font-bold text-xs text-amber-800 uppercase tracking-wider">
                Low Stock Warning Alert
              </h4>
              <p className="text-xs text-gray-600 mt-1">
                The food menu catalog contains <span className="font-bold text-amber-700">{lowStockItems.length}</span> items running low. Check stock levels soon:
              </p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {lowStockItems.map(item => (
                  <span
                    key={item.id}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-[10px] font-mono font-bold text-amber-800 shadow-xs"
                  >
                    <span>{item.name}</span>
                    <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">{item.stock} left</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. STATE EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-violet-100 rounded-3xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Delivered Sales</span>
            <h3 className="font-display font-extrabold text-2xl text-gray-950">₹{totalIncome.toFixed(2)}</h3>
            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">100% verified payments</span>
          </div>
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white border border-violet-100 rounded-3xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Kitchen Active Orders</span>
            <h3 className="font-display font-extrabold text-2xl text-gray-950">{pendingOrders.length} orders</h3>
            <span className="text-[10px] text-violet-650 font-bold bg-violet-50 px-2 py-0.5 rounded-full">{preppingOrdersCount} prepping • {readyOrdersCount} ready</span>
          </div>
          <div className="h-12 w-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center font-bold">
            <ClipboardList className="h-6 w-6 animate-pulse" />
          </div>
        </div>

        <div className="bg-white border border-violet-100 rounded-3xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Out of Stock</span>
            <h3 className="font-display font-extrabold text-2xl text-rose-600">{outOfStockItemsCount} items</h3>
            <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full">Requires restocking</span>
          </div>
          <div className="h-12 w-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center font-bold">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white border border-violet-100 rounded-3xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Faculty Rating</span>
            <h3 className="font-display font-extrabold text-2xl text-amber-500">{averageRating} ★</h3>
            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full">{reviews.length} total reviews</span>
          </div>
          <div className="h-12 w-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center font-bold">
            <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
          </div>
        </div>
      </div>

      {/* 2. ADMIN CHOICES TABS */}
      <div className="flex border-b border-violet-100 overflow-x-auto scrollbar-none pb-0.5 gap-4">
        {[
          { id: 'chef', label: `Chef Dashboard (${preppingOrdersCount})`, icon: ChefHat },
          { id: 'counter', label: `Counter Staff (${readyOrdersCount})`, icon: QrCode },
          { id: 'owner', label: 'Canteen Owner Hub', icon: ShieldCheck }
        ].filter(tab => {
          if (userRole === 'chef') return tab.id === 'chef';
          return true;
        }).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setMatchedOrderId('');
              }}
              className={`flex items-center space-x-2 px-4 py-3 text-xs font-bold transition-all border-b-2 tracking-wide whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-violet-600 text-violet-750 font-extrabold'
                  : 'border-transparent text-gray-400 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ======================= PORTAL: CHEF DASHBOARD ======================= */}
      {activeTab === 'chef' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* SLOT DEMANDS & TIMELINE */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* UPCOMING SLOT AGGREGATION */}
            <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs space-y-4">
              <div>
                <h3 className="font-display font-bold text-sm text-gray-900">Upcoming Time Slot Aggregation</h3>
                <p className="text-xs text-gray-400 font-sans">Scheduled demand grouped by 15-minute intervals. Start and finish batches in bulk.</p>
              </div>

              {Object.keys(slotAggregatedDemands).length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No active scheduled prep requirements found.</p>
              ) : (
                <div className="space-y-4 font-sans text-xs">
                  {Object.entries(slotAggregatedDemands).map(([slot, itemsMap]) => (
                    <div key={slot} className="border border-violet-100 rounded-2xl p-4 bg-violet-50/10 space-y-3">
                      <div className="flex justify-between items-center border-b border-violet-50 pb-2">
                        <span className="font-bold text-violet-700 font-mono text-sm">{slot} Slot</span>
                        <span className="bg-violet-100 text-violet-850 px-2.5 py-0.5 rounded text-[10px] font-bold">
                          {Object.values(itemsMap).reduce((sum, item) => sum + item.quantity, 0)} Total Dishes
                        </span>
                      </div>
                      
                      <div className="divide-y divide-violet-50">
                        {Object.entries(itemsMap).map(([itemId, details]) => (
                          <div key={itemId} className="py-2.5 flex justify-between items-center flex-wrap gap-2">
                            <div>
                              <span className="font-semibold text-gray-800 capitalize">{details.name}</span>
                              <span className="text-violet-650 font-bold ml-1 font-mono">x{details.quantity}</span>
                              <span className={`text-[9px] font-mono font-bold uppercase ml-2 px-1.5 py-0.2 rounded ${
                                details.status === 'preparing' ? 'bg-amber-100 text-amber-800' : 'bg-violet-55 text-violet-700'
                              }`}>
                                {details.status}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              {details.status === 'scheduled' ? (
                                <button
                                  onClick={() => startBatchCooking(slot, itemId)}
                                  className="bg-violet-600 hover:bg-violet-750 text-white rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
                                >
                                  Start Batch
                                </button>
                              ) : details.status === 'preparing' ? (
                                <button
                                  onClick={() => finishBatchCooking(slot, itemId)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
                                >
                                  Set Ready
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DETAILED TIMELINE WITH COOKING ALERTS */}
            <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs space-y-4">
              <div>
                <h3 className="font-display font-bold text-sm text-gray-900">Priority Cooking Timeline (Priority = Pickup Time + FIFO)</h3>
                <p className="text-xs text-gray-400 font-sans">Sequence of orders determined by earliest pickup time slot, then order queue index.</p>
              </div>

              {sortedChefOrders.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No orders currently waiting in the kitchen timeline.</p>
              ) : (
                <div className="divide-y divide-violet-50">
                  {sortedChefOrders.map(order => {
                    const isCookingOverdue = order.status === 'scheduled' && Date.now() >= (order.prepStartTime || 0);
                    return (
                      <div key={order.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-1">
                            <span className="font-mono font-bold text-violet-750">{order.id}</span>
                            <span className="text-[10px] text-gray-500 font-mono">Slot: <strong className="text-gray-900">{order.pickupSlot}</strong></span>
                            {isCookingOverdue && (
                              <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider animate-pulse flex items-center space-x-1">
                                <AlertCircle className="h-3 w-3" />
                                <span>START COOKING NOW</span>
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-gray-800">
                            For: {order.userName}
                          </p>
                          <p className="text-gray-450 text-[11px]">
                            {order.items
                              .filter(it => {
                                const itemMenu = menuItems.find(m => m.id === it.itemId);
                                return itemMenu ? itemMenu.requiresChef !== false : true;
                              })
                              .map(it => `${it.name} (x${it.quantity})`)
                              .join(', ')}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {order.status !== 'ready' && (
                            <button
                              onClick={() => handleCycleStatus(order.id, order.status)}
                              className="bg-violet-600 hover:bg-violet-750 text-white rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider shadow-xs transition"
                            >
                              {order.status === 'scheduled' && 'Prep Meal'}
                              {order.status === 'preparing' && 'Set Ready'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* INGREDIENTS CHECKLIST (SIDE COLUMN) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-sm space-y-5 text-xs text-left">
              <div>
                <h4 className="font-display font-bold text-sm text-gray-900">Required Cooking Ingredients</h4>
                <p className="text-xs text-gray-400 font-sans">Accumulated weight totals required for all active kitchen orders.</p>
              </div>

              {Object.keys(totalIngredientRequirements).length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">No active ingredient depletion logged.</p>
              ) : (
                <div className="space-y-3.5">
                  {Object.entries(totalIngredientRequirements).map(([ingName, weightGrams]) => {
                    const ingProfile = ingredients.find(i => i.name === ingName);
                    const stock = ingProfile ? ingProfile.stockGrams : 0;
                    const stockUnit = ingProfile ? ingProfile.unit : 'g';
                    const isShortage = stock < weightGrams;
                    
                    const displayWeight = weightGrams >= 1000 ? `${(weightGrams / 1000).toFixed(2)}kg` : `${weightGrams}g`;
                    const displayStock = stock >= 1000 ? `${(stock / 1000).toFixed(2)}kg` : `${stock}g`;
                    
                    return (
                      <div key={ingName} className="p-3 border border-violet-100/50 bg-violet-50/10 rounded-xl space-y-1">
                        <div className="flex justify-between items-center font-semibold text-gray-800">
                          <span className="capitalize">{ingName}</span>
                          <span className="font-mono text-violet-750">{displayWeight}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>In Stock: {displayStock} {stockUnit}</span>
                          {isShortage && (
                            <span className="text-rose-600 font-bold uppercase flex items-center space-x-1 animate-pulse">
                              <AlertCircle className="h-3 w-3" />
                              <span>Shortage Risk</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================= PORTAL: COUNTER STAFF VIEW ======================= */}
      {/* ======================= PORTAL: COUNTER STAFF VIEW ======================= */}
      {activeTab === 'counter' && (
        <div className="space-y-6 text-left">

          {/* SCAN & SERVE FOR COUNTER */}
          {scanStatus && !scanStatus.success && (
            <div className="p-4 rounded-2xl text-xs font-sans flex items-start space-x-2.5 border bg-rose-50/80 border-rose-200/60 text-rose-800 text-left shadow-xs">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-500" />
              <div>
                <span className="font-bold block tracking-wide uppercase text-[10px] mb-0.5">Verification Error</span>
                <p>{scanStatus.text}</p>
              </div>
            </div>
          )}
          {scanStatus && scanStatus.success && (
            <div className="p-4 rounded-2xl text-xs font-sans flex items-start space-x-2.5 border bg-emerald-50/80 border-emerald-200/60 text-emerald-800 text-left shadow-xs">
              <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
              <div>
                <span className="font-bold block tracking-wide uppercase text-[10px] mb-0.5">Verification Success</span>
                <p>{scanStatus.text}</p>
              </div>
            </div>
          )}

          <div className="bg-white p-6 md:p-8 rounded-3xl border border-violet-100/70 shadow-sm text-center space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-left gap-4">
              <div>
                <h2 className="font-display font-black text-xl text-gray-900 tracking-tight">Token Scan & Verify</h2>
                <p className="text-xs text-gray-400 mt-1 font-sans">
                  Scan a student's QR code or walk-in bill to verify and serve.
                </p>
              </div>
              <button
                onClick={startCameraScannerStaff}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-750 hover:to-fuchsia-750 active:scale-98 text-white font-semibold py-3 px-5 rounded-2xl text-xs tracking-wide transition-all shadow-md flex items-center space-x-2 cursor-pointer font-display self-start sm:self-auto"
              >
                <QrCode className="h-4.5 w-4.5" />
                <span>Open Camera Scanner</span>
              </button>
            </div>
            <div className="border-t border-violet-50 pt-4 text-left">
              <form onSubmit={handleManualCodeLookupStaff} className="flex gap-2 max-w-xl">
                <input
                  type="text"
                  placeholder="Paste/Type Order ID or Bill Number"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  className="flex-1 bg-violet-50/30 hover:bg-violet-50/60 focus:bg-white text-xs px-4 py-3.5 border border-violet-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 font-mono transition-all"
                />
                <button
                  type="submit"
                  className="bg-violet-600 hover:bg-violet-750 text-white rounded-xl text-xs px-6 font-semibold transition-all shadow-md shrink-0 flex items-center space-x-1.5 cursor-pointer font-display"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Verify Ticket</span>
                </button>
              </form>
            </div>
          </div>

          {alreadyServedOrderId && (
            <div className="bg-rose-500 text-white p-4 rounded-2xl shadow-lg shadow-rose-500/10 flex items-start space-x-3 relative animate-fade-in text-left">
              <ShieldAlert className="h-5 w-5 text-white shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-bold text-sm">Order Already Served</h4>
                <p className="text-xs text-rose-100 mt-1 font-sans">
                  This order ({alreadyServedOrderId}) has already been marked as completed/delivered.
                </p>
              </div>
              <button 
                onClick={() => setAlreadyServedOrderId(null)} 
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 shrink-0 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-lg text-gray-900">Live Counter Queue</h2>
              <p className="text-xs text-gray-400 font-sans">Real-time status of student kitchen tickets and handovers.</p>
            </div>
            <button
              onClick={onFetchCanteen}
              className="p-2 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-lg transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMN 1: PREPARING / QUEUED */}
            <div className="bg-white p-5 rounded-3xl border border-violet-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-violet-50 pb-3">
                <div>
                  <h3 className="font-display font-bold text-sm text-gray-900">Preparing</h3>
                  <p className="text-[10px] text-gray-400 font-sans">Dishes currently in the kitchen.</p>
                </div>
                <span className="bg-amber-50 text-amber-700 font-bold font-mono text-[10px] px-2 py-0.5 rounded-full">
                  {orders.filter(o => o.status === 'preparing' || o.status === 'scheduled' || o.status === 'pending').length} active
                </span>
              </div>

              {orders.filter(o => o.status === 'preparing' || o.status === 'scheduled' || o.status === 'pending').length === 0 ? (
                <div className="text-center py-8 text-gray-400 font-sans text-xs">
                  No orders in preparation.
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {orders.filter(o => o.status === 'preparing' || o.status === 'scheduled' || o.status === 'pending').map((order) => (
                    <div key={order.id} className="p-3 bg-amber-50/20 border border-amber-100/50 rounded-2xl space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono text-[10px] font-bold text-violet-750 block">{order.id}</span>
                          <span className="text-xs font-semibold text-gray-800">{order.userName}</span>
                        </div>
                        <span className="bg-amber-50 text-amber-800 border border-amber-100 text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase">
                          {order.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-sans">
                        {order.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                      </p>
                      <button
                        onClick={() => handleCycleStatus(order.id, order.status)}
                        className="w-full bg-amber-600 hover:bg-amber-750 text-white rounded-xl py-1.5 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
                      >
                        Set Ready
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COLUMN 2: READY FOR COLLECTION */}
            <div className="bg-white p-5 rounded-3xl border border-violet-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-violet-50 pb-3">
                <div>
                  <h3 className="font-display font-bold text-sm text-gray-900">Ready for Collection</h3>
                  <p className="text-[10px] text-gray-400 font-sans">Prepared and waiting at counter.</p>
                </div>
                <span className="bg-emerald-50 text-emerald-700 font-bold font-mono text-[10px] px-2 py-0.5 rounded-full">
                  {orders.filter(o => o.status === 'ready').length} ready
                </span>
              </div>

              {orders.filter(o => o.status === 'ready').length === 0 ? (
                <div className="text-center py-8 text-gray-400 font-sans text-xs">
                  No orders ready for collection.
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {orders.filter(o => o.status === 'ready').map((order) => (
                    <div key={order.id} className="p-3 bg-emerald-50/20 border border-emerald-100/50 rounded-2xl space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono text-[10px] font-bold text-violet-750 block">{order.id}</span>
                          <span className="text-xs font-semibold text-gray-800">{order.userName}</span>
                        </div>
                        <span className="bg-emerald-50 text-emerald-850 border border-emerald-100 text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase">
                          READY
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-sans">
                        {order.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                      </p>
                      <button
                        onClick={() => handleMarkAsServed(order.id)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-1.5 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
                      >
                        Serve / Handover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COLUMN 3: SERVED / DELIVERED */}
            <div className="bg-white p-5 rounded-3xl border border-violet-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-violet-50 pb-3">
                <div>
                  <h3 className="font-display font-bold text-sm text-gray-900">Served / Delivered</h3>
                  <p className="text-[10px] text-gray-400 font-sans">Recently completed orders.</p>
                </div>
                <span className="bg-violet-50 text-violet-700 font-bold font-mono text-[10px] px-2 py-0.5 rounded-full">
                  {orders.filter(o => o.status === 'delivered' || o.status === 'collected').length} completed
                </span>
              </div>

              {orders.filter(o => o.status === 'delivered' || o.status === 'collected').length === 0 ? (
                <div className="text-center py-8 text-gray-400 font-sans text-xs">
                  No served orders.
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {[...orders]
                    .filter(o => o.status === 'delivered' || o.status === 'collected')
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                    .slice(0, 15)
                    .map((order) => (
                      <div key={order.id} className="p-3 bg-gray-50 border border-gray-100 rounded-2xl space-y-1.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-[10px] font-bold text-gray-500 block">{order.id}</span>
                            <span className="text-xs font-semibold text-gray-800">{order.userName}</span>
                          </div>
                          <span className="bg-gray-100 text-gray-600 border border-gray-200 text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase">
                            Delivered
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-sans">
                          {order.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ======================= PORTAL: CANTEEN OWNER HUB ======================= */}
      {activeTab === 'owner' && (
        <div className="space-y-6">
          {/* Nested Sub Tabs (Menu Management, Inventory Management, Settings Editor, Reviews, AI Predictions) */}
          <div className="flex border-b border-violet-100 overflow-x-auto scrollbar-none pb-0.5 gap-4">
            {[
              { id: 'orders_mgr', label: 'Manage Orders', icon: ClipboardList },
              { id: 'pos', label: 'Walk-in Billing (POS)', icon: ShoppingCart },
              { id: 'menu', label: 'Menu Catalog', icon: Layers },
              { id: 'inventory', label: 'Raw Inventory', icon: Package },
              { id: 'revenue', label: 'Revenue Dashboard', icon: TrendingUp },
              { id: 'settings', label: 'Capacity Settings', icon: Settings },
              { id: 'reviews', label: 'Student Reviews', icon: MessageSquare }
            ].map(sub => {
              const Icon = sub.icon;
              return (
                <button
                  key={sub.id}
                  onClick={() => setOwnerSubTab(sub.id as any)}
                  className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold transition-all border-b-2 tracking-wide whitespace-nowrap cursor-pointer ${
                    ownerSubTab === sub.id
                      ? 'border-violet-600 text-violet-750 font-extrabold'
                      : 'border-transparent text-gray-400 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>

          {/* OWNER SUBTAB: MANAGE ORDERS */}
          {ownerSubTab === 'orders_mgr' && (
            <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs space-y-6">
              <div>
                <h3 className="font-display font-bold text-sm text-gray-900">Manage Canteen Orders</h3>
                <p className="text-xs text-gray-400 font-sans">View prepared orders, ready orders, edit pickup slots, cancel, or collect them.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-violet-50 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                      <th className="pb-3.5">Order ID</th>
                      <th className="pb-3.5">Customer Name</th>
                      <th className="pb-3.5">Items</th>
                      <th className="pb-3.5">Pickup Slot</th>
                      <th className="pb-3.5">Status</th>
                      <th className="pb-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-50 font-sans">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-violet-50/25">
                        <td className="py-4 font-mono font-bold text-gray-800">{order.id}</td>
                        <td className="py-4 text-gray-700 font-semibold">{order.userName}</td>
                        <td className="py-4 text-gray-500">
                          {order.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                        </td>
                        <td className="py-4 font-semibold">
                          {editingOrderId === order.id ? (
                            <div className="flex items-center space-x-1.5">
                              <select
                                value={editingOrderSlot}
                                onChange={(e) => setEditingOrderSlot(e.target.value)}
                                className="bg-violet-50 border border-violet-100 rounded px-2 py-1 text-xs outline-none"
                              >
                                <option value="">Select slot...</option>
                                <option value="12:00 PM">12:00 PM</option>
                                <option value="12:15 PM">12:15 PM</option>
                                <option value="12:30 PM">12:30 PM</option>
                                <option value="12:45 PM">12:45 PM</option>
                                <option value="01:00 PM">01:00 PM</option>
                                <option value="01:15 PM">01:15 PM</option>
                                <option value="01:30 PM">01:30 PM</option>
                                <option value="01:45 PM">01:45 PM</option>
                                <option value="02:00 PM">02:00 PM</option>
                              </select>
                              <button
                                onClick={() => handleUpdateOrderSlot(order.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2 py-1 text-[10px] font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingOrderId(null)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-655 rounded px-2 py-1 text-[10px] font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span>{order.pickupSlot || 'ASAP'}</span>
                              {order.status !== 'delivered' && order.status !== 'collected' && order.status !== 'cancelled' && (
                                <button
                                  onClick={() => {
                                    setEditingOrderId(order.id);
                                    setEditingOrderSlot(order.pickupSlot || '');
                                  }}
                                  className="text-violet-600 hover:text-violet-850 text-[10px] font-bold underline cursor-pointer"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-4">
                          <span className={`px-2.5 py-0.5 rounded-full font-mono font-bold text-[10px] uppercase ${
                            order.status === 'ready'
                              ? 'bg-emerald-50 text-emerald-700'
                              : order.status === 'preparing'
                              ? 'bg-amber-50 text-amber-700'
                              : order.status === 'delivered' || order.status === 'collected'
                              ? 'bg-gray-100 text-gray-600'
                              : order.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {order.status === 'pending' || order.status === 'scheduled' ? (
                              <button
                                onClick={() => onUpdateOrderStatus(order.id, 'preparing')}
                                className="bg-amber-600 hover:bg-amber-750 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                              >
                                Prep Meal
                              </button>
                            ) : order.status === 'preparing' ? (
                              <button
                                onClick={() => onUpdateOrderStatus(order.id, 'ready')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                              >
                                Set Ready
                              </button>
                            ) : order.status === 'ready' ? (
                              <button
                                onClick={() => onUpdateOrderStatus(order.id, 'delivered')}
                                className="bg-violet-600 hover:bg-violet-750 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                              >
                                Collect
                              </button>
                            ) : null}

                            {order.status !== 'delivered' && order.status !== 'collected' && order.status !== 'cancelled' && (
                              <button
                                onClick={() => onUpdateOrderStatus(order.id, 'cancelled')}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded border border-rose-100 cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* OWNER SUBTAB: WALK-IN BILLING (POS) */}
          {ownerSubTab === 'pos' && (
            <WalkinPOS
              menuItems={menuItems}
              canteenId={menuItems[0]?.canteenId || 'canteen_001'}
              subCanteenId={subCanteenId}
              cashierName={userRole === 'owner' ? 'Owner' : 'Cashier'}
              onBillCreated={onFetchCanteen}
              onLogout={onLogout}
            />
          )}

          {/* OWNER SUBTAB: MENU CATALOG */}
          {ownerSubTab === 'menu' && (
            <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-violet-50 pb-5">
                <div>
                  <h3 className="font-display font-bold text-sm text-gray-900">Dynamic Menu Catalog Manager</h3>
                  <p className="text-xs text-gray-400 font-sans">Adjust prices, preparation times, and pause items instantly.</p>
                </div>
                <button
                  onClick={handleOpenAddModal}
                  className="bg-violet-600 hover:bg-violet-750 text-white rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Food Option</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-violet-50 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                      <th className="pb-3.5">Food Product</th>
                      <th className="pb-3.5">Category</th>
                      <th className="pb-3.5">Prep Time</th>
                      <th className="pb-3.5">Daily Limit</th>
                      <th className="pb-3.5">Stock</th>
                      <th className="pb-3.5">Price</th>
                      <th className="pb-3.5">Emergency Controls</th>
                      <th className="pb-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-50 font-sans">
                    {menuItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-violet-50/25">
                        <td className="py-4 font-bold text-gray-800 capitalize flex items-center space-x-2.5">
                          <img src={item.imageUrl} className="h-8 w-8 object-cover rounded-lg bg-violet-50" />
                          <span>{item.name}</span>
                        </td>
                        <td className="py-4 text-gray-500 font-medium">{item.category}</td>
                        <td className="py-4 font-mono font-bold text-gray-650">{item.prepTime} mins</td>
                        <td className="py-4 font-mono text-gray-650">{item.dailyLimit}</td>
                        <td className="py-4">
                          <span className={`px-2.5 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                            item.stock === 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {item.stock} left
                          </span>
                        </td>
                        <td className="py-4 font-bold text-violet-750">₹{item.price.toFixed(2)}</td>
                        <td className="py-4">
                          <button
                            onClick={() => handleTogglePause(item)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all uppercase ${
                              item.isPaused
                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                                : 'bg-neutral-100 hover:bg-neutral-200 text-gray-600'
                            }`}
                          >
                            {item.isPaused ? 'Resume Item' : 'Pause Item'}
                          </button>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1.5 text-gray-400 hover:text-violet-700 hover:bg-violet-50 rounded"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* OWNER SUBTAB: RAW INVENTORY */}
          {ownerSubTab === 'inventory' && (
            <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-violet-50 pb-5">
                <div>
                  <h3 className="font-display font-bold text-sm text-gray-900">Raw Ingredient Depletion Log</h3>
                  <p className="text-xs text-gray-400 font-sans">Active raw supplies measured in grams/kilograms/pcs. Create, update, or delete ingredients.</p>
                </div>
                <button
                  onClick={handleOpenAddIngModal}
                  className="bg-violet-600 hover:bg-violet-750 text-white rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Raw Stock</span>
                </button>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-violet-50 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                      <th className="pb-3.5">Ingredient Name</th>
                      <th className="pb-3.5">Ingredient ID</th>
                      <th className="pb-3.5">Remaining Stock</th>
                      <th className="pb-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-50 font-sans text-slate-755">
                    {ingredients.map((ing, idx) => {
                      const displayStock = ing.stockGrams >= 1000 
                        ? `${(ing.stockGrams / 1000).toFixed(2)} ${ing.unit === 'kg' ? 'kg' : 'pcs'}`
                        : `${ing.stockGrams}g`;
                      return (
                        <tr key={idx} className="hover:bg-violet-50/25">
                          <td className="py-4 font-bold capitalize">{ing.name}</td>
                          <td className="py-4 font-mono text-gray-400">{ing.id}</td>
                          <td className="py-4 font-mono font-bold text-violet-750">{displayStock}</td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleOpenEditIngModal(ing)}
                                className="p-1.5 text-gray-400 hover:text-violet-700 hover:bg-violet-50 rounded"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteIngredient(ing.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* OWNER SUBTAB: REVENUE DASHBOARD */}
          {ownerSubTab === 'revenue' && (
            <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs space-y-6">
              <div>
                <h3 className="font-display font-bold text-sm text-gray-900">Revenue & Earnings Dashboard</h3>
                <p className="text-xs text-gray-400 font-sans">Comprehensive financial reports and real-time transaction history.</p>
              </div>

              {/* KPI Cards */}
              {(() => {
                const completedOrdersList = orders.filter(o => o.status === 'delivered' || o.status === 'collected');
                const totalRevenueEarned = completedOrdersList.reduce((sum, o) => sum + o.totalPrice, 0);
                const avgTicketVal = completedOrdersList.length > 0 ? (totalRevenueEarned / completedOrdersList.length) : 0;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-violet-50/35 border border-violet-100/70 p-5 rounded-2xl">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Total Revenue</span>
                      <h4 className="font-display font-extrabold text-2xl text-violet-750 mt-1">₹{totalRevenueEarned.toFixed(2)}</h4>
                      <p className="text-[10px] text-gray-400 font-sans mt-0.5">Sum of all completed orders</p>
                    </div>
                    <div className="bg-violet-50/35 border border-violet-100/70 p-5 rounded-2xl">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Completed Orders</span>
                      <h4 className="font-display font-extrabold text-2xl text-gray-900 mt-1">{completedOrdersList.length} orders</h4>
                      <p className="text-[10px] text-gray-400 font-sans mt-0.5">Fully served student tickets</p>
                    </div>
                    <div className="bg-violet-50/35 border border-violet-100/70 p-5 rounded-2xl">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Average Ticket Value</span>
                      <h4 className="font-display font-extrabold text-2xl text-gray-900 mt-1">₹{avgTicketVal.toFixed(2)}</h4>
                      <p className="text-[10px] text-gray-400 font-sans mt-0.5">Mean checkout billing value</p>
                    </div>
                  </div>
                );
              })()}

              {/* Transaction Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-violet-50 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                      <th className="pb-3.5">Transaction ID</th>
                      <th className="pb-3.5">Customer</th>
                      <th className="pb-3.5">Method</th>
                      <th className="pb-3.5">Timestamp</th>
                      <th className="pb-3.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-50 font-sans">
                    {orders.filter(o => o.status === 'delivered' || o.status === 'collected').map((order) => (
                      <tr key={order.id} className="hover:bg-violet-50/25">
                        <td className="py-3 font-mono font-bold text-gray-800">{order.id}</td>
                        <td className="py-3 text-gray-700 font-semibold">{order.userName}</td>
                        <td className="py-3 text-gray-500">{order.paymentMethod || 'Razorpay Gateway'}</td>
                        <td className="py-3 text-gray-500">{new Date(order.timestamp || order.createdAt).toLocaleString()}</td>
                        <td className="py-3 text-right font-bold text-violet-750">₹{order.totalPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* OWNER SUBTAB: CAPACITY SETTINGS EDITOR */}
          {ownerSubTab === 'settings' && (
            <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs max-w-md space-y-5">
              <div>
                <h3 className="font-display font-bold text-sm text-gray-900">Queue Capacity Parameters</h3>
                <p className="text-xs text-gray-400 font-sans">Fine-tune pickup window expiry limits and slot bookings capacity.</p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-sans text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Pickup No-Show Window (Minutes)</label>
                  <select
                    value={noShowMinutesVal}
                    onChange={(e) => setNoShowMinutesVal(e.target.value)}
                    className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs font-medium cursor-pointer"
                  >
                    <option value="15">15 Minutes Window</option>
                    <option value="30">30 Minutes Window</option>
                    <option value="45">45 Minutes Window</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Max Bookings Per 15-Min Slot</label>
                  <input
                    type="number"
                    value={defaultSlotCapacityVal}
                    onChange={(e) => setDefaultSlotCapacityVal(e.target.value)}
                    required
                    className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updatingSettings}
                  className="w-full bg-violet-600 hover:bg-violet-750 text-white rounded-xl py-3 text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center"
                >
                  {updatingSettings ? 'Updating Parameters...' : 'Save Configuration Parameters'}
                </button>
              </form>
            </div>
          )}

          {/* OWNER SUBTAB: REVIEWS FEED */}
          {ownerSubTab === 'reviews' && (
            <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs space-y-6">
              <div>
                <h3 className="font-display font-bold text-sm text-gray-900">Student Reviews Audit Log</h3>
                <p className="text-xs text-gray-400 font-sans">Verified checkout reviews analyzed by Gemini NLP sentiment pipelines.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reviews.map((rev, idx) => (
                  <div key={idx} className="bg-violet-50/50 p-5 rounded-2xl text-xs font-sans border border-violet-100/30 text-left space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-900 shrink-0 capitalize">{rev.userName}</h4>
                        {rev.menuItemName && (
                          <span className="text-[10px] text-violet-700 font-bold uppercase tracking-wider block mt-0.5">Purchased: {rev.menuItemName}</span>
                        )}
                      </div>
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider ${
                        rev.sentiment === 'positive'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {rev.sentiment}
                      </span>
                    </div>
                    <p className="text-gray-500 leading-relaxed italic">"{rev.comment}"</p>
                    <div className="flex items-center space-x-1.5 text-amber-400">
                      {Array.from({ length: rev.rating }).map((_, is) => (
                        <Star key={is} className="h-3.5 w-3.5 fill-current" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


        </div>
      )}
      {/* ======================= GLOBAL ADD/EDIT PRODUCT MODAL ======================= */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-violet-100 max-h-[90vh] overflow-y-auto">
            <div className="bg-violet-50 px-6 py-4.5 border-b border-violet-100 flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-gray-900">
                {editingItem ? 'Edit Canteen Meal' : 'Add Custom Combo'}
              </h3>
              <button
                onClick={() => setShowItemModal(false)}
                className="p-1 rounded-full hover:bg-violet-100 text-gray-400 hover:text-gray-650 transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Food Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Schezwan Noodles"
                  className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block font-semibold">Price (INR ₹)</label>
                  <input
                    type="number"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block font-semibold">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block font-semibold">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs font-medium"
                  >
                    <option value="Meals">Meals</option>
                    <option value="Snacks & Beverages">Snacks & Beverages</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block font-semibold">Food Image URL</label>
                  <input
                    type="text"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="Paste Google/Unsplash image URL..."
                    className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs"
                  />
                  {formImageUrl && (
                    <div className="mt-1 rounded-lg overflow-hidden border border-violet-100 h-24 bg-violet-50">
                      <img src={formImageUrl} alt="Preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block font-semibold">Prep Time (mins)</label>
                  <input
                    type="number"
                    required
                    value={formPrepTime}
                    onChange={(e) => setFormPrepTime(e.target.value)}
                    className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block font-semibold">Daily Limits</label>
                  <input
                    type="number"
                    required
                    value={formDailyLimit}
                    onChange={(e) => setFormDailyLimit(e.target.value)}
                    className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs font-mono"
                  />
                </div>
              </div>
 
              <div className="flex items-center space-x-2 bg-violet-50/20 p-3.5 rounded-xl border border-violet-100">
                <input
                  type="checkbox"
                  id="formRequiresChef"
                  checked={formRequiresChef}
                  onChange={(e) => setFormRequiresChef(e.target.checked)}
                  className="rounded text-violet-600 focus:ring-violet-500 h-4 w-4"
                />
                <label htmlFor="formRequiresChef" className="text-xs font-bold text-gray-700 cursor-pointer">
                  Requires Chef cooking (Send to Kitchen Queue)
                </label>
              </div>

              {/* INGREDIENTS RECIPE MAPPING editor inside Save item modal */}
              <div className="space-y-2 border border-violet-100 p-3 rounded-xl bg-violet-50/20">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-violet-750 uppercase tracking-wider block">Recipe Ingredients Map (g / pcs)</span>
                  <button
                    type="button"
                    onClick={() => setFormRecipe([...formRecipe, { ingredientId: '', amountGrams: 0 }])}
                    className="text-[10px] font-bold text-violet-600 hover:text-violet-800 cursor-pointer"
                  >
                    + Add Ingredient
                  </button>
                </div>
                {formRecipe.length === 0 && (
                  <p className="text-[10px] text-gray-400 italic">No ingredients mapped. Click "+ Add Ingredient" to start.</p>
                )}
                <div className="space-y-2">
                  {formRecipe.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={entry.ingredientId}
                        onChange={(e) => {
                          const copy = [...formRecipe];
                          copy[idx] = { ...copy[idx], ingredientId: e.target.value };
                          setFormRecipe(copy);
                        }}
                        className="flex-1 bg-white border border-violet-100 rounded px-2 py-1 outline-none text-[10px]"
                      >
                        <option value="">Select ingredient...</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={entry.amountGrams || ''}
                        placeholder="0"
                        onChange={(e) => {
                          const copy = [...formRecipe];
                          copy[idx] = { ...copy[idx], amountGrams: Number(e.target.value) };
                          setFormRecipe(copy);
                        }}
                        className="w-20 bg-white border border-violet-100 rounded px-2 py-1 outline-none text-[10px] font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setFormRecipe(formRecipe.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600 text-xs font-bold cursor-pointer px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block font-semibold">Canteen Item Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Ingredients list..."
                  className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs text-gray-700"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-4 bg-violet-600 hover:bg-violet-750 text-white rounded-xl py-3 text-xs font-bold transition shadow-md cursor-pointer"
              >
                Save Food Details
              </button>
            </form>
          </div>
        </div>
      )}

      {/* GLOBAL ADD/EDIT INGREDIENT MODAL */}
      {showIngModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-violet-100">
            <div className="bg-violet-50 px-6 py-4.5 border-b border-violet-100 flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-gray-900">
                {editingIng ? 'Edit Raw Stock' : 'Add Raw Stock'}
              </h3>
              <button
                onClick={() => setShowIngModal(false)}
                className="p-1 rounded-full hover:bg-violet-100 text-gray-400 hover:text-gray-655 transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveIngredient} className="p-6 space-y-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Ingredient Name</label>
                <input
                  type="text"
                  required
                  value={formIngName}
                  onChange={(e) => setFormIngName(e.target.value)}
                  placeholder="e.g. Rice, Veg, Sauce"
                  className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block font-semibold">Stock Quantity (grams / pcs)</label>
                  <input
                    type="number"
                    required
                    value={formIngStock}
                    onChange={(e) => setFormIngStock(e.target.value)}
                    className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block font-semibold">Unit</label>
                  <select
                    value={formIngUnit}
                    onChange={(e) => setFormIngUnit(e.target.value)}
                    className="w-full bg-violet-50/40 border border-violet-100 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white text-xs font-medium"
                  >
                    <option value="g">g (grams)</option>
                    <option value="kg">kg (kilograms)</option>
                    <option value="pcs">pcs (pieces)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 bg-violet-600 hover:bg-violet-750 text-white rounded-xl py-3 text-xs font-bold transition shadow-md cursor-pointer"
              >
                Save Ingredient Details
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

