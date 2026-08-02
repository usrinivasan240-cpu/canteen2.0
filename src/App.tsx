/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ChefHat, AlertCircle } from 'lucide-react';
import AppHeader from './components/AppHeader';
import CustomerApp from './components/CustomerApp';
import CanteenAdmin from './components/CanteenAdmin';
import ServicePanel from './components/ServicePanel';
import LoginScreen from './components/LoginScreen';
import UpdatePopup from './components/UpdatePopup';
import LegalPages from './components/LegalPages';
import LegalFooter from './components/LegalFooter';
import { MenuItem, Order, Review, Canteen, College } from './types';
import { API_BASE } from './config';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try { return localStorage.getItem('bb_loggedIn') === 'true'; } catch { return false; }
  });
  const [role, setRole] = useState<'customer' | 'owner' | 'superadmin' | 'admin' | 'chef' | 'staff'>(() => {
    try { return (localStorage.getItem('bb_role') as any) || 'customer'; } catch { return 'customer'; }
  });
  const [canteen, setCanteen] = useState<Canteen | null>(() => {
    try { const c = localStorage.getItem('bb_canteen'); return c ? JSON.parse(c) : null; } catch { return null; }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string; role: 'customer' | 'owner' | 'superadmin' | 'admin' | 'chef' | 'staff'; collegeId?: string; canteenId?: string; subCanteenId?: string } | null>(() => {
    try { const u = localStorage.getItem('bb_user'); return u ? JSON.parse(u) : null; } catch { return null; }
  });
  const [selectedCanteenId, setSelectedCanteenId] = useState<string>('canteen_001');
  const [colleges, setColleges] = useState<College[]>(() => {
    try { const c = localStorage.getItem('bb_colleges'); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [legalPage, setLegalPage] = useState<string | null>(null);

  const userEmail = currentUser ? currentUser.email : '';

  const fetchUserOrders = async () => {
    if (!currentUser?.id) return;
    try {
      const resp = await fetch(`${API_BASE}/api/user/orders?userId=${currentUser.id}&canteenId=${selectedCanteenId}`);
      const data = await resp.json();
      if (data.success && Array.isArray(data.orders)) {
        setUserOrders(data.orders);
        try { localStorage.setItem('bb_orders', JSON.stringify(data.orders)); } catch {}
      }
    } catch (e) {
      console.error('Failed to fetch user orders:', e);
    }
  };

  useEffect(() => {
    // Hydrate from cache immediately
    try {
      const cached = localStorage.getItem('bb_orders');
      if (cached) setUserOrders(JSON.parse(cached));
    } catch {}
    if (currentUser?.id) {
      fetchUserOrders();
      const interval = setInterval(fetchUserOrders, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser?.id, selectedCanteenId]);

  const fetchCanteenData = async (canteenId?: string) => {
    try {
      const activeCanteenId = canteenId || selectedCanteenId;
      const resp = await fetch(`${API_BASE}/api/canteen?canteenId=${activeCanteenId}`);
      const data = await resp.json();
      if (data.success && data.canteen) {
        if (data.canteen.items && data.canteen.items.length > 0) {
          setCanteen(data.canteen);
          try { localStorage.setItem('bb_canteen', JSON.stringify(data.canteen)); } catch {}
        } else if (canteen && canteen.items && canteen.items.length > 0) {
        } else {
          setCanteen(data.canteen);
        }
        setErrorMessage('');
      } else {
        setErrorMessage('Failed to fetch cafeteria details from backend.');
      }
    } catch (e) {
      console.error('Error synchronizing database:', e);
      setErrorMessage('Full-Stack Server connection offline. Retrying soon...');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCanteenData(selectedCanteenId);
    const interval = setInterval(() => fetchCanteenData(selectedCanteenId), 60000);
    return () => clearInterval(interval);
  }, [selectedCanteenId]);

  // Fetch colleges - hydrate from cache first, then refresh
  useEffect(() => {
    if (isLoggedIn) {
      fetch(`${API_BASE}/api/colleges`).then(r => r.json()).then(d => {
        if (d.success && d.colleges) {
          setColleges(d.colleges);
          try { localStorage.setItem('bb_colleges', JSON.stringify(d.colleges)); } catch {}
        }
      }).catch(() => {});
    }
  }, [isLoggedIn]);

  // Handle Paytm callback redirect
  const [paytmSuccess, setPaytmSuccess] = useState<{ orderId: string; status: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const orderId = params.get('orderId');
    if (paymentStatus && orderId) {
      fetchUserOrders();
      setPaytmSuccess({ orderId, status: paymentStatus });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Derive user's college info
  const userCollege = colleges.find(c => c.id === currentUser?.collegeId);

  const handleOrderPlaced = async (cartItems: { itemId: string; name: string; quantity: number }[], pickupSlot?: string, canteenId?: string, subCanteenId?: string): Promise<any> => {
    try {
      const resp = await fetch(`${API_BASE}/api/canteen/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser ? currentUser.id : 'user_guest',
          userName: currentUser ? currentUser.name : 'Raju Watson',
          items: cartItems,
          paymentMethod: 'Paytm Gateway',
          pickupSlot,
          canteenId: canteenId || currentUser?.canteenId || selectedCanteenId,
          subCanteenId: subCanteenId || currentUser?.subCanteenId
        })
      });
      const data = await resp.json();
      if (!data.success) {
        return data;
      }

      if (data.usePaytm) {
        const paytmForm = document.createElement('form');
        paytmForm.setAttribute('method', 'POST');
        paytmForm.setAttribute('action', data.paytmGatewayUrl);
        paytmForm.style.display = 'none';

        for (const [key, value] of Object.entries(data.paytmParams)) {
          const input = document.createElement('input');
          input.setAttribute('type', 'hidden');
          input.setAttribute('name', key);
          input.setAttribute('value', value as string);
          paytmForm.appendChild(input);
        }

        document.body.appendChild(paytmForm);
        paytmForm.submit();

        return { success: true, order: data.order, redirecting: true };
      }

      await fetchCanteenData(); // resync lists
      fetchUserOrders(); // refresh user-specific order history
      return data;
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Network failure placing checkout' };
    }
  };

  const handleAddReview = async (rating: number, comment: string, menuItemId?: string, menuItemName?: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/canteen/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser ? currentUser.id : 'user_guest',
          userName: currentUser ? currentUser.name : 'Raju Watson',
          rating,
          comment,
          menuItemId,
          menuItemName
        })
      });
      const data = await resp.json();
      if (data.success) {
        await fetchCanteenData();
      }
      return data;
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Network failure recording review' };
    }
  };

  const handleAddMenuItem = async (payload: any) => {
    try {
      const resp = await fetch(`${API_BASE}/api/canteen/menu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...payload, canteenId: currentUser?.canteenId || selectedCanteenId })
      });
      const data = await resp.json();
      if (data.success) {
        // Silent refresh - don't trigger loading state
        try {
          const r = await fetch(`${API_BASE}/api/canteen?canteenId=${currentUser?.canteenId || selectedCanteenId}`);
          const d = await r.json();
          if (d.success && d.canteen) setCanteen(d.canteen);
        } catch {}
      }
      return data;
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Network failure saving menu item' };
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/canteen/menu/${id}`, {
        method: 'DELETE',
      });
      const data = await resp.json();
      if (data.success) {
        await fetchCanteenData();
      }
      return data;
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Network failure deleting item' };
    }
  };

  const handleUpdateOrderStatus = async (id: string, status: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/canteen/order/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status })
      });
      const data = await resp.json();
      if (data.success) {
        await fetchCanteenData();
      }
      return data;
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Network failure updating order' };
    }
  };

  const handleResetCanteen = async () => {
    if (confirm("Are you sure you want to reset the food ordering demo database? All user reviews and custom recipes will be wiped.")) {
      try {
        const resp = await fetch(`${API_BASE}/api/canteen/reset`, { method: 'POST' });
        const data = await resp.json();
        if (data.success) {
          await fetchCanteenData();
          alert("Demo states successfully reset back to factory defaults!");
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    setRole(user.role);
    const userCanteenId = user.canteenId || 'canteen_001';
    setSelectedCanteenId(userCanteenId);
    setIsLoggedIn(true);
    try {
      localStorage.setItem('bb_user', JSON.stringify(user));
      localStorage.setItem('bb_role', user.role);
      localStorage.setItem('bb_loggedIn', 'true');
    } catch {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    try {
      localStorage.removeItem('bb_user');
      localStorage.removeItem('bb_role');
      localStorage.removeItem('bb_loggedIn');
      localStorage.removeItem('bb_orders');
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#e8e4f5] flex flex-col items-center justify-center p-6 text-center text-gray-500">
        <div className="relative mb-6">
          <div className="h-16 w-16 bg-amber-600 rounded-3xl flex items-center justify-center text-white shadow-lg animate-bounce">
            <ChefHat className="h-8 w-8" />
          </div>
          <div className="absolute -bottom-2 -right-2 h-6 w-6 bg-white rounded-full flex items-center justify-center shadow-xs">
            <div className="h-4.5 w-4.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
         <h2 className="font-display font-bold text-gray-950 text-xl tracking-tight">Booting Esc(Q)</h2>
        <p className="text-xs text-amber-600 mt-1 max-w-xs font-semibold">Connecting smart dining cloud network...</p>
      </div>
    );
  }

  // 0. LEGAL PAGE VIEW (full-screen override)
  if (legalPage) {
    return (
      <LegalPages
        page={legalPage as any}
        onBack={() => setLegalPage(null)}
      />
    );
  }

  // 1. GATED ENTRY FOR LOGIN
  if (!isLoggedIn) {
    return (
      <>
        <UpdatePopup />
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onNavigateLegal={(page) => setLegalPage(page)}
        />
      </>
    );
  }

  // 2. MAIN LOGGED-IN VIEWPORT
  return (
    <div className="min-h-screen flex flex-col bg-[#fbfcff] text-slate-800 antialiased font-sans transition-colors duration-150">
      <UpdatePopup />
      
      {/* Dynamic server warning offline bar */}
      {errorMessage && (
        <div className="bg-amber-50 border-b border-amber-200 py-2.5 px-4 text-center text-xs font-medium text-amber-800 flex items-center justify-center space-x-2">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* HEADER CONTROL BAR (Disabled for superadmin who has its own layout) */}
      {role !== 'superadmin' && (
        <AppHeader
          currentRole={role === 'customer' ? 'customer' : 'owner'}
          onChangeRole={(newRole) => setRole(newRole as any)}
          userEmail={userEmail}
          onLogout={handleLogout}
          collegeName={userCollege?.name}
          collegeLogo={userCollege?.logoUrl}
        />
      )}

      {/* INTERACTIVE VIEWS */}
      <main className="flex-1">
        {role === 'customer' ? (
           <CustomerApp
              canteenName={canteen ? canteen.name : 'Esc(Q)'}
            menuItems={canteen?.items || []}
            orders={userOrders}
            reviews={canteen?.reviews || []}
            onOrderPlaced={handleOrderPlaced}
            onAddReview={handleAddReview}
            onResetCanteen={handleResetCanteen}
            userEmail={userEmail}
            userId={currentUser?.id || ''}
            userCollegeId={currentUser?.collegeId}
            userCanteenId={currentUser?.canteenId || selectedCanteenId}
            onLogout={handleLogout}
            onCanteenChange={setSelectedCanteenId}
            paytmSuccess={paytmSuccess}
            onDismissPaytmSuccess={() => setPaytmSuccess(null)}
          />
        ) : (role === 'owner' || role === 'chef' || role === 'staff') ? (
          <CanteenAdmin
            menuItems={canteen?.items || []}
            orders={userOrders}
            reviews={canteen?.reviews || []}
            ingredients={canteen?.ingredients || []}
            settings={canteen?.settings}
            onAddMenuItem={handleAddMenuItem}
            onDeleteMenuItem={handleDeleteMenuItem}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onFetchCanteen={fetchCanteenData}
            onLogout={handleLogout}
            userRole={role}
            subCanteenId={currentUser?.subCanteenId}
          />
        ) : (
          <ServicePanel
            orders={userOrders}
            menuItems={canteen?.items || []}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onFetchCanteen={fetchCanteenData}
            onLogout={handleLogout}
            currentUser={currentUser}
          />
        )}
      </main>

      {/* FOOTER - Hidden for customer (CustomerApp has its own branded footer) */}
      {role !== 'superadmin' && role !== 'customer' && (
        <footer className="border-t border-gray-800 bg-gray-900 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500 font-sans gap-3">
            <div className="flex items-center space-x-2">
               <span className="font-bold text-white font-display text-sm">Esc(Q)</span>
              <span>&copy; 2026 Campus Cafeteria Systems. All rights reserved.</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1 font-mono text-[10px] bg-emerald-50/10 text-emerald-400 px-2.5 py-0.5 rounded-full font-bold uppercase select-none ring-1 ring-emerald-500/20">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping mr-1" />
                <span>Cloud Synced</span>
              </span>
              <span className="font-mono text-[10px]">Secure UPI v1.0.0</span>
            </div>
          </div>
        </footer>
      )}

      {/* LEGAL FOOTER - Always visible */}
      <LegalFooter onNavigate={(page) => setLegalPage(page)} />

    </div>
  );
}

