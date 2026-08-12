/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users, Trash2, LogOut, CheckCircle, AlertTriangle, UserPlus, Sparkles, X, Globe, MapPin, Plus, TrendingUp, LifeBuoy
} from 'lucide-react';
import { SupportTicket } from '../types';
import { Order, MenuItem } from '../types';
import { API_BASE } from '../config';
import CanteenAdmin from './CanteenAdmin';
import ImageEditor from './ImageEditor';

interface ServicePanelProps {
  orders: Order[];
  menuItems: MenuItem[];
  onUpdateOrderStatus: (id: string, status: string) => Promise<any>;
  onFetchCanteen: () => void;
  onLogout: () => void;
  currentUser?: any;
}

export default function ServicePanel({
  orders,
  menuItems,
  onUpdateOrderStatus,
  onFetchCanteen,
  onLogout,
  currentUser
}: ServicePanelProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [canteens, setCanteens] = useState<any[]>([]);
  const [subCanteens, setSubCanteens] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);

  const activeCollegeId = currentUser?.role === 'admin' ? currentUser?.collegeId : 'college_001';
  const collegeName = colleges.find(c => c.id === activeCollegeId)?.name || 'Your College';

  const [viewingCanteenId, setViewingCanteenId] = useState<string | null>(null);
  const [viewingCanteenData, setViewingCanteenData] = useState<any | null>(null);
  const [viewingLoading, setViewingLoading] = useState<boolean>(false);

  const handleLoadCanteenDashboard = async (canteenId: string) => {
    setViewingLoading(true);
    setViewingCanteenId(canteenId);
    try {
      const resp = await fetch(`${API_BASE}/api/canteen?canteenId=${canteenId}`);
      const data = await resp.json();
      if (data.success && data.canteen) {
        setViewingCanteenData(data.canteen);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setViewingLoading(false);
    }
  };

  const silentRefreshCanteen = async (canteenId: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/canteen?canteenId=${canteenId}`);
      const data = await resp.json();
      if (data.success && data.canteen) {
        setViewingCanteenData(data.canteen);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const [activeTab, setActiveTab] = useState<'users' | 'colleges' | 'canteens' | 'tickets'>(isSuperAdmin ? 'canteens' : 'users');
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketFilter, setTicketFilter] = useState<string>('all');
  const [ticketReply, setTicketReply] = useState<Record<string, string>>({});
  const [ticketStatusUpdate, setTicketStatusUpdate] = useState<Record<string, string>>({});
  const [selectedCollegeFilter, setSelectedCollegeFilter] = useState<string>('all');
  const [userCanteenFilter, setUserCanteenFilter] = useState<string>('all');
  const [userSubCanteenFilter, setUserSubCanteenFilter] = useState<string>('all');

  const [scanStatus, setScanStatus] = useState<{ success: boolean; text: string } | null>(null);

  // Form states for User
  const [usrName, setUsrName] = useState('');
  const [usrEmail, setUsrEmail] = useState('');
  const [usrRole, setUsrRole] = useState<'customer' | 'owner' | 'chef' | 'staff' | 'admin' | 'superadmin'>('chef');
  const [usrColId, setUsrColId] = useState('');
  const [usrCantId, setUsrCantId] = useState('');
  const [usrSubId, setUsrSubId] = useState('');
  const [usrPosting, setUsrPosting] = useState('');

  // Form states for College
  const [colName, setColName] = useState('');
  const [colLoc, setColLoc] = useState('');
  const [colLogo, setColLogo] = useState('');

  // Form states for Canteen
  const [cantName, setCantName] = useState('');
  const [cantCol, setCantCol] = useState('');
  const [cantOwnName, setCantOwnName] = useState('');
  const [cantOwnEmail, setCantOwnEmail] = useState('');
  const [cantLoc, setCantLoc] = useState('');
  const [cantLogo, setCantLogo] = useState('');

  // Form states for Sub-Canteen
  const [subName, setSubName] = useState('');
  const [subCantId, setSubCantId] = useState('');

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editColId, setEditColId] = useState('');
  const [editCantId, setEditCantId] = useState('');
  const [editSubId, setEditSubId] = useState('');
  const [editPosting, setEditPosting] = useState('');

  // Edit college modal state
  const [editingCollege, setEditingCollege] = useState<any>(null);
  const [editColName, setEditColName] = useState('');
  const [editColLoc, setEditColLoc] = useState('');

  // Edit canteen modal state
  const [editingCanteen, setEditingCanteen] = useState<any>(null);
  const [editCantName, setEditCantName] = useState('');
  const [editCantCol, setEditCantCol] = useState('');
  const [editCantOwnName, setEditCantOwnName] = useState('');
  const [editCantLoc, setEditCantLoc] = useState('');

  // Edit sub-canteen modal state
  const [editingSubCanteen, setEditingSubCanteen] = useState<any>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubCantId, setEditSubCantId] = useState('');

  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [imageEditorType, setImageEditorType] = useState<'logo' | 'banner'>('logo');
  const [imageEditorCollegeId, setImageEditorCollegeId] = useState<string>('');
  const [imageEditorInitial, setImageEditorInitial] = useState<string>('');

  const syncAdminData = async () => {
    try {
      const [colResp, cantResp, subResp, usrResp] = await Promise.all([
        fetch(`${API_BASE}/api/colleges`),
        fetch(`${API_BASE}/api/canteens`),
        fetch(`${API_BASE}/api/subcanteens`),
        fetch(`${API_BASE}/api/users`)
      ]);
      const col = await colResp.json();
      const cant = await cantResp.json();
      const sub = await subResp.json();
      const usr = await usrResp.json();
      if (col.success) setColleges(col.colleges);
      if (cant.success) setCanteens(cant.canteens);
      if (sub.success) setSubCanteens(sub.subCanteens);
      if (usr.success) setUsers(usr.users);
    } catch (e) {
      console.error("Failed to sync service data", e);
    }
  };

  const fetchSupportTickets = async () => {
    setLoadingTickets(true);
    try {
      const resp = await fetch(`${API_BASE}/api/support/all`);
      const data = await resp.json();
      if (data.success) setSupportTickets(data.tickets || []);
    } catch (e) {
      console.error('Failed to fetch support tickets:', e);
    }
    setLoadingTickets(false);
  };

  const handleTicketReply = async (ticketId: string) => {
    const reply = ticketReply[ticketId];
    const newStatus = ticketStatusUpdate[ticketId] || 'in_progress';
    if (!reply?.trim()) return;

    try {
      const resp = await fetch(`${API_BASE}/api/support/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, adminReply: reply.trim(), status: newStatus }),
      });
      const data = await resp.json();
      if (data.success) {
        setTicketReply(prev => ({ ...prev, [ticketId]: '' }));
        setTicketStatusUpdate(prev => ({ ...prev, [ticketId]: '' }));
        fetchSupportTickets();
      }
    } catch (e) {
      console.error('Failed to reply:', e);
    }
  };

  useEffect(() => {
    syncAdminData();
  }, []);

  const handleCreateCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colName) return;
    try {
      const resp = await fetch(`${API_BASE}/api/colleges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: colName, location: colLoc, logoUrl: colLogo })
      });
      const d = await resp.json();
      if (d.success) {
        setColName('');
        setColLoc('');
        setColLogo('');
        setScanStatus({ success: true, text: `Successfully registered college: ${colName}` });
        await syncAdminData();
      } else {
        setScanStatus({ success: false, text: d.error || "Failed to create college" });
      }
    } catch (e) {
      console.error(e);
      setScanStatus({ success: false, text: "Network failure creating college." });
    }
  };

  const handleCreateCanteen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cantName || !cantCol || !cantOwnEmail) return;
    try {
      const resp = await fetch(`${API_BASE}/api/canteens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cantName,
          collegeId: cantCol,
          ownerName: cantOwnName,
          ownerEmail: cantOwnEmail,
          location: cantLoc,
          logoUrl: cantLogo
        })
      });
      const d = await resp.json();
      if (d.success) {
        // Also register/auto-create the Owner User account
        await fetch(`${API_BASE}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cantOwnName || 'Canteen Owner',
            email: cantOwnEmail,
            role: 'owner',
            canteenId: d.canteen.id,
            collegeId: cantCol
          })
        });
        setCantName('');
        setCantCol('');
        setCantOwnName('');
        setCantOwnEmail('');
        setCantLoc('');
        setCantLogo('');
        setScanStatus({ success: true, text: `Successfully registered canteen: ${cantName}` });
        await syncAdminData();
      } else {
        setScanStatus({ success: false, text: d.error || "Failed to create canteen" });
      }
    } catch (e) {
      console.error(e);
      setScanStatus({ success: false, text: "Network failure creating canteen." });
    }
  };

  const handleCreateSubCanteen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName || !subCantId) return;
    try {
      const resp = await fetch(`${API_BASE}/api/subcanteens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: subName, canteenId: subCantId })
      });
      const d = await resp.json();
      if (d.success) {
        setSubName('');
        setSubCantId('');
        setScanStatus({ success: true, text: `Successfully created counter: ${subName}` });
        await syncAdminData();
      } else {
        setScanStatus({ success: false, text: d.error || "Failed to create sub-canteen counter" });
      }
    } catch (e) {
      console.error(e);
      setScanStatus({ success: false, text: "Network failure creating counter." });
    }
  };

  const handleDeleteCollege = async (id: string) => {
    if (!confirm('Are you sure you want to delete this college?')) return;
    try {
      const resp = await fetch(`${API_BASE}/api/colleges/${id}`, { method: 'DELETE' });
      const d = await resp.json();
      if (d.success) {
        setScanStatus({ success: true, text: "Successfully deleted college." });
        await syncAdminData();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteCanteen = async (id: string) => {
    if (!confirm('Are you sure you want to delete this canteen?')) return;
    try {
      const resp = await fetch(`${API_BASE}/api/canteens/${id}`, { method: 'DELETE' });
      const d = await resp.json();
      if (d.success) {
        setScanStatus({ success: true, text: "Successfully deleted canteen." });
        await syncAdminData();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteSubCanteen = async (id: string) => {
    if (!confirm('Are you sure you want to delete this counter?')) return;
    try {
      const resp = await fetch(`${API_BASE}/api/subcanteens/${id}`, { method: 'DELETE' });
      const d = await resp.json();
      if (d.success) {
        setScanStatus({ success: true, text: "Successfully deleted counter." });
        await syncAdminData();
      }
    } catch (e) { console.error(e); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usrName || !usrEmail || !usrRole) return;
    try {
      const targetCollegeId = currentUser?.role === 'superadmin' ? usrColId : (currentUser?.role === 'admin' ? currentUser?.collegeId : 'college_001');
      
      const resp = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: usrName,
          email: usrEmail,
          role: usrRole,
          collegeId: targetCollegeId,
          canteenId: usrCantId || undefined,
          subCanteenId: usrSubId || undefined,
          posting: usrPosting || undefined
        })
      });
      const d = await resp.json();
      if (d.success) {
        setUsrName('');
        setUsrEmail('');
        setUsrRole('chef');
        setUsrCantId('');
        setUsrSubId('');
        setUsrPosting('');
        setScanStatus({ success: true, text: `Provisioned user account for ${usrEmail} successfully!` });
        await syncAdminData();
      } else {
        setScanStatus({ success: false, text: d.error || "Failed to create user account" });
      }
    } catch (e) {
      console.error(e);
      setScanStatus({ success: false, text: "Network failure creating user account." });
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const resp = await fetch(`${API_BASE}/api/users/${email}`, { method: 'DELETE' });
      const d = await resp.json();
      if (d.success) {
        setScanStatus({ success: true, text: `Successfully deleted user: ${email}` });
        await syncAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateUserRole = async (email: string, newRole: string, newPosting?: string) => {
    try {
      const existingUser = users.find(u => u.email === email);
      const postingVal = newPosting !== undefined ? newPosting : (existingUser?.posting || "");
      const resp = await fetch(`${API_BASE}/api/users/${email}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, posting: postingVal })
      });
      const d = await resp.json();
      if (d.success) {
        setScanStatus({ success: true, text: `Successfully updated user ${email}` });
        await syncAdminData();
      } else {
        setScanStatus({ success: false, text: d.error || "Failed to update user profile." });
      }
    } catch (e) {
      console.error(e);
      setScanStatus({ success: false, text: "Network failure updating user profile." });
    }
  };

  // Filter canteens list
  const handleUpdateUser = async () => {
    if (!editingUser || !editName || !editRole) return;
    try {
      const body: any = {
        name: editName,
        role: editRole,
        collegeId: editColId,
        canteenId: editCantId || undefined,
        subCanteenId: editSubId || undefined,
        posting: editPosting || undefined
      };
      if (editPassword) body.password = editPassword;
      const resp = await fetch(`${API_BASE}/api/users/${editingUser.email}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const d = await resp.json();
      if (d.success) {
        setEditingUser(null);
        setScanStatus({ success: true, text: `Successfully updated user: ${editName}` });
        await syncAdminData();
      } else {
        setScanStatus({ success: false, text: d.error || 'Failed to update user' });
      }
    } catch (e) {
      setScanStatus({ success: false, text: 'Network failure updating user.' });
    }
  };

  const openEditUser = (usr: any) => {
    setEditingUser(usr);
    setEditName(usr.name || '');
    setEditEmail(usr.email || '');
    setEditPassword('');
    setEditRole(usr.role || 'customer');
    setEditColId(usr.collegeId || '');
    setEditCantId(usr.canteenId || '');
    setEditSubId(usr.subCanteenId || '');
    setEditPosting(usr.posting || '');
  };

  // ── Edit College ──────────────────────────────────────────────────────────
  const openEditCollege = (col: any) => {
    setEditingCollege(col);
    setEditColName(col.name || '');
    setEditColLoc(col.location || '');
  };

  const handleUpdateCollege = async () => {
    if (!editingCollege || !editColName) return;
    try {
      const resp = await fetch(`${API_BASE}/api/colleges/${editingCollege.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editColName, location: editColLoc })
      });
      const d = await resp.json();
      if (d.success) {
        setEditingCollege(null);
        setScanStatus({ success: true, text: `College "${editColName}" updated successfully` });
        await syncAdminData();
      } else {
        setScanStatus({ success: false, text: d.error || 'Failed to update college' });
      }
    } catch (e) {
      setScanStatus({ success: false, text: 'Network failure updating college.' });
    }
  };

  // ── Edit Canteen ──────────────────────────────────────────────────────────
  const openEditCanteen = (cant: any) => {
    setEditingCanteen(cant);
    setEditCantName(cant.name || '');
    setEditCantCol(cant.collegeId || '');
    setEditCantOwnName(cant.ownerName || '');
    setEditCantLoc(cant.location || '');
  };

  const handleUpdateCanteen = async () => {
    if (!editingCanteen || !editCantName) return;
    try {
      const resp = await fetch(`${API_BASE}/api/canteens/${editingCanteen.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editCantName, collegeId: editCantCol, ownerName: editCantOwnName, location: editCantLoc })
      });
      const d = await resp.json();
      if (d.success) {
        setEditingCanteen(null);
        setScanStatus({ success: true, text: `Canteen "${editCantName}" updated successfully` });
        await syncAdminData();
      } else {
        setScanStatus({ success: false, text: d.error || 'Failed to update canteen' });
      }
    } catch (e) {
      setScanStatus({ success: false, text: 'Network failure updating canteen.' });
    }
  };

  // ── Edit Sub-Canteen ──────────────────────────────────────────────────────
  const openEditSubCanteen = (sub: any) => {
    setEditingSubCanteen(sub);
    setEditSubName(sub.name || '');
    setEditSubCantId(sub.canteenId || '');
  };

  const handleUpdateSubCanteen = async () => {
    if (!editingSubCanteen || !editSubName) return;
    try {
      const resp = await fetch(`${API_BASE}/api/subcanteens/${editingSubCanteen.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editSubName, canteenId: editSubCantId })
      });
      const d = await resp.json();
      if (d.success) {
        setEditingSubCanteen(null);
        setScanStatus({ success: true, text: `Counter "${editSubName}" updated successfully` });
        await syncAdminData();
      } else {
        setScanStatus({ success: false, text: d.error || 'Failed to update counter' });
      }
    } catch (e) {
      setScanStatus({ success: false, text: 'Network failure updating counter.' });
    }
  };

  const filteredCanteens = canteens.filter(c => {
    if (isSuperAdmin && selectedCollegeFilter === 'all') return true;
    const targetColId = isSuperAdmin ? selectedCollegeFilter : activeCollegeId;
    return c.collegeId === targetColId;
  });

  // Filter users list
  const filteredUsers = users.filter(usr => {
    if (isSuperAdmin) {
      if (selectedCollegeFilter !== 'all' && usr.collegeId !== selectedCollegeFilter) return false;
      if (userCanteenFilter !== 'all' && usr.canteenId !== userCanteenFilter) return false;
      if (userSubCanteenFilter !== 'all' && usr.subCanteenId !== userSubCanteenFilter) return false;
      return true;
    }
    // For College Admin: only see staff, chef, owner, customer, and only for this college
    return usr.collegeId === activeCollegeId && usr.role !== 'admin' && usr.role !== 'superadmin';
  });

  const completedOrders = orders.filter(o => o.status === 'delivered' || o.status === 'collected');
  const targetCompletedOrders = completedOrders.filter(o => {
    const targetColId = isSuperAdmin ? selectedCollegeFilter : activeCollegeId;
    if (isSuperAdmin && selectedCollegeFilter === 'all') return true;
    const orderCollegeId = o.collegeId || canteens.find(c => c.id === o.canteenId)?.collegeId;
    return orderCollegeId === targetColId;
  });
  const cumulativeIncome = targetCompletedOrders.reduce((sum, o) => sum + o.totalPrice, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-amber-50/40 pb-12">
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-red-100/80 px-4 py-4 md:px-8 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-red-900 to-red-800 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Users className="h-5.5 w-5.5" />
            </div>
            <div>
              <h1 className="font-display font-black text-base md:text-lg text-gray-900 tracking-tight leading-tight">
                {isSuperAdmin ? 'Super Admin Control Center' : 'College Accounts Directory'}
              </h1>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-gray-500 font-sans tracking-wide uppercase font-semibold">
                  {isSuperAdmin ? 'Platform Wide Administration' : `Scoped: ${collegeName}`}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50/50 hover:bg-rose-50 hover:text-rose-700 active:scale-95 transition-all cursor-pointer border border-rose-100/55"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out Control</span>
          </button>
        </div>
      </header>

      {/* TABS (SUPER ADMIN ONLY) */}
      {isSuperAdmin && (
        <div className="max-w-6xl mx-auto px-4 mt-6">
          <div className="flex border-b border-red-100 space-x-2">
            <button
              onClick={() => setActiveTab('canteens')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'canteens' ? 'border-amber-600 text-amber-600 font-black' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <MapPin className="h-4 w-4" />
              <span>Canteens & Counters</span>
            </button>
            <button
              onClick={() => setActiveTab('colleges')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'colleges' ? 'border-amber-600 text-amber-600 font-black' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Globe className="h-4 w-4" />
              <span>Colleges</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'users' ? 'border-amber-600 text-amber-600 font-black' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Users Directory</span>
            </button>
            <button
              onClick={() => setActiveTab('dashboards')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'dashboards' ? 'border-amber-600 text-amber-600 font-black' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Canteen Dashboards</span>
            </button>
            <button
              onClick={() => { setActiveTab('tickets'); fetchSupportTickets(); }}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'tickets' ? 'border-amber-600 text-amber-600 font-black' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <LifeBuoy className="h-4 w-4" />
              <span>Support Tickets {supportTickets.filter(t => t.status === 'open').length > 0 && `(${supportTickets.filter(t => t.status === 'open').length})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* SUPER ADMIN SPECIFIC COLLEGE METRICS & INCOME FILTER */}
      {isSuperAdmin && (
        <div className="max-w-6xl mx-auto px-4 mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-red-100 rounded-3xl p-5 shadow-sm text-left">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Scope Dashboard View</label>
            <select
              value={selectedCollegeFilter}
              onChange={(e) => setSelectedCollegeFilter(e.target.value)}
              className="bg-red-50/55 hover:bg-red-50 focus:bg-white text-xs px-3.5 py-2 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-semibold text-gray-800 cursor-pointer"
            >
              <option value="all">Global (All Colleges)</option>
              {colleges.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-6 flex-wrap text-left">
            <div className="bg-red-50/25 px-4 py-2 border border-red-100/60 rounded-xl min-w-[120px]">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block">Active Canteens</span>
              <span className="block font-display font-extrabold text-base text-amber-600 mt-0.5">{filteredCanteens.length} canteens</span>
            </div>
            <div className="bg-red-50/25 px-4 py-2 border border-red-100/60 rounded-xl min-w-[120px]">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block">Directory Users</span>
              <span className="block font-display font-extrabold text-base text-gray-900 mt-0.5">{filteredUsers.length} profiles</span>
            </div>
            <div className="bg-red-50/25 px-4 py-2 border border-red-200 rounded-xl min-w-[120px]">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block font-semibold text-emerald-800">Total Income</span>
              <span className="block font-display font-extrabold text-base text-emerald-700 mt-0.5">₹{cumulativeIncome.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* CORE WORKSPACE CONTENT */}
      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-6">

        {/* FEEDBACK STATUS BAR */}
        {scanStatus && (
          <div className={`p-4 rounded-2xl text-xs font-sans flex items-start space-x-2.5 border ${
            scanStatus.success 
              ? 'bg-emerald-50/80 border-emerald-200/60 text-emerald-800' 
              : 'bg-rose-50/80 border-rose-200/60 text-rose-800'
          } text-left shadow-xs`}>
            {scanStatus.success ? (
              <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-500" />
            )}
            <div className="flex-1">
              <span className="font-bold block tracking-wide uppercase text-[10px] mb-0.5">
                {scanStatus.success ? 'Success Notification' : 'System Error'}
              </span>
              <p>{scanStatus.text}</p>
            </div>
            <button onClick={() => setScanStatus(null)} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* COLLEGES TAB VIEW */}
        {activeTab === 'colleges' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
            {/* Form */}
            <div className="lg:col-span-4 bg-white border border-red-100/70 rounded-3xl p-5 md:p-6 shadow-sm space-y-5">
              <div>
                <h3 className="font-display font-black text-sm text-gray-900 uppercase tracking-wide">
                  Create College
                </h3>
                <p className="text-[11px] text-gray-400 font-sans mt-0.5">
                  Register a new university/college campus in the network.
                </p>
              </div>
              <form onSubmit={handleCreateCollege} className="space-y-4 text-xs font-sans text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">College Name</label>
                  <input
                    type="text"
                    value={colName}
                    onChange={(e) => setColName(e.target.value)}
                    required
                    placeholder="e.g. Engineering College East"
                    className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Location / Address</label>
                  <input
                    type="text"
                    value={colLoc}
                    onChange={(e) => setColLoc(e.target.value)}
                    required
                    placeholder="e.g. Main Campus Block A"
                    className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">College Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setColLogo(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-xs text-gray-600 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-100 file:text-red-800 hover:file:bg-red-200 cursor-pointer"
                  />
                  {colLogo && <img src={colLogo} alt="Logo preview" className="h-10 w-10 rounded-full object-cover border border-red-100 mt-1" />}
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-white rounded-xl text-xs py-3 font-bold transition-all shadow-md cursor-pointer flex items-center justify-center space-x-1.5 font-display"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create College</span>
                </button>
              </form>
            </div>

            {/* Table */}
            <div className="lg:col-span-8 bg-white rounded-3xl border border-red-100/60 shadow-xs overflow-hidden text-left">
              <div className="p-5 border-b border-red-50/50">
                <h3 className="font-display font-black text-sm text-gray-900 uppercase tracking-wide">
                  Registered Colleges ({colleges.length})
                </h3>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-red-50/50 border-b border-red-100/40 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                      <th className="px-6 py-4.5 text-left">College ID</th>
                      <th className="px-6 py-4.5 text-left">College Name</th>
                      <th className="px-6 py-4.5 text-left">Location</th>
                      <th className="px-6 py-4.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50 font-sans text-slate-700">
                    {colleges.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-xs text-gray-400 p-8 text-center">
                          No colleges registered yet.
                        </td>
                      </tr>
                    ) : (
                      colleges.map(c => (
                        <tr key={c.id}>
                          <td className="px-6 py-4 font-mono font-bold text-gray-500">{c.id}</td>
                          <td className="px-6 py-4 font-bold text-gray-950">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setImageEditorType('logo');
                                  setImageEditorCollegeId(c.id);
                                  setImageEditorInitial(c.logoUrl || '');
                                  setImageEditorOpen(true);
                                }}
                                className="relative group cursor-pointer"
                              >
                                {c.logoUrl ? <img src={c.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover border border-red-100 group-hover:opacity-70 transition" /> : <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-red-500 flex items-center justify-center text-white text-[11px] font-bold group-hover:opacity-70 transition">{c.name.charAt(0)}</div>}
                                <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                  <span className="text-white text-[8px] font-bold">Edit</span>
                                </div>
                              </button>
                              <span>{c.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-500">{c.location}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditCollege(c)}
                                className="text-amber-600 hover:text-amber-800 hover:bg-amber-50/60 p-2 rounded-xl transition cursor-pointer border border-amber-100/25"
                                title="Edit College"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button
                                onClick={() => handleDeleteCollege(c.id)}
                                className="text-rose-600 hover:text-rose-800 hover:bg-rose-50/60 p-2 rounded-xl transition cursor-pointer flex items-center justify-center border border-rose-100/25"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Banner Settings for each college */}
              <div className="bg-white rounded-3xl border border-red-100/60 shadow-xs overflow-hidden text-left">
                <div className="p-5 border-b border-red-50/50">
                  <h3 className="font-display font-black text-sm text-gray-900 uppercase tracking-wide">Banner Settings</h3>
                  <p className="text-[11px] text-gray-400 font-sans mt-0.5">Customize the hero banner for each college.</p>
                </div>
                <div className="p-5 space-y-4">
                  {colleges.map(c => (
                    <div key={c.id} className="border border-red-100 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-red-500 flex items-center justify-center text-white text-[10px] font-bold">{c.name.charAt(0)}</div>
                        <span className="text-xs font-bold text-gray-900">{c.name}</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Banner Image</label>
                        <button
                          onClick={() => {
                            setImageEditorType('banner');
                            setImageEditorCollegeId(c.id);
                            setImageEditorInitial(c.bannerUrl || '');
                            setImageEditorOpen(true);
                          }}
                          className="w-full text-left text-xs text-gray-600 bg-red-50/50 hover:bg-red-100/50 border border-red-100 rounded-lg py-2 px-3 font-semibold transition flex items-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          {c.bannerUrl ? 'Edit Banner Image' : 'Upload Banner Image'}
                        </button>
                        {c.bannerUrl && <img src={c.bannerUrl} alt="Banner" className="w-full h-20 object-cover rounded-lg border border-gray-100 mt-1" />}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Banner Subtitle</label>
                        <input
                          type="text"
                           defaultValue={c.bannerSubtitle || 'Official Esc(Q) Platform'}
                          onBlur={async (e) => {
                            try {
                              await fetch(`${API_BASE}/api/colleges/${c.id}/banner`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bannerSubtitle: e.target.value })
                              });
                              await syncAdminData();
                            } catch (err) { console.error(err); }
                          }}
                          className="w-full bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Feature Badges (comma separated)</label>
                        <input
                          type="text"
                          defaultValue={(c.bannerFeatures || ['Order Faster', 'Skip the Queue', 'Smart Pickup']).join(', ')}
                          onBlur={async (e) => {
                            const features = e.target.value.split(',').map(f => f.trim()).filter(Boolean);
                            try {
                              await fetch(`${API_BASE}/api/colleges/${c.id}/banner`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bannerFeatures: features })
                              });
                              await syncAdminData();
                            } catch (err) { console.error(err); }
                          }}
                          className="w-full bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CANTEENS TAB VIEW */}
        {activeTab === 'canteens' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
            {/* Forms Side */}
            <div className="lg:col-span-4 space-y-6">
              {/* Form Create Canteen */}
              <div className="bg-white border border-red-100/70 rounded-3xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="font-display font-black text-sm text-gray-900 uppercase tracking-wide">
                    Create Canteen
                  </h3>
                  <p className="text-[11px] text-gray-400 font-sans mt-0.5">
                    Add a physical canteen dining node to a college.
                  </p>
                </div>
                <form onSubmit={handleCreateCanteen} className="space-y-3.5 text-xs font-sans text-left">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Canteen Name</label>
                    <input
                      type="text"
                      value={cantName}
                      onChange={(e) => setCantName(e.target.value)}
                      required
                           placeholder="e.g. Esc(Q)"
                      className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Assigned College</label>
                    <select
                      value={cantCol}
                      onChange={(e) => setCantCol(e.target.value)}
                      required
                      className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold cursor-pointer"
                    >
                      <option value="">Select College...</option>
                      {colleges.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Owner Full Name</label>
                    <input
                      type="text"
                      value={cantOwnName}
                      onChange={(e) => setCantOwnName(e.target.value)}
                      required
                      placeholder="e.g. Chef Watson"
                      className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Owner Email (Credentials)</label>
                    <input
                      type="email"
                      value={cantOwnEmail}
                      onChange={(e) => setCantOwnEmail(e.target.value)}
                      required
                      placeholder="e.g. owner@gmail.com"
                      className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Location in Campus</label>
                    <input
                      type="text"
                      value={cantLoc}
                      onChange={(e) => setCantLoc(e.target.value)}
                      placeholder="e.g. Ground Floor, Food Court"
                      className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Canteen Logo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setCantLogo(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full text-xs text-gray-600 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-100 file:text-red-800 hover:file:bg-red-200 cursor-pointer"
                    />
                    {cantLogo && <img src={cantLogo} alt="Logo preview" className="h-10 w-10 rounded-full object-cover border border-red-100 mt-1" />}
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-white rounded-xl text-xs py-3 font-bold transition-all shadow-md cursor-pointer flex items-center justify-center space-x-1.5 font-display"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Canteen</span>
                  </button>
                </form>
              </div>

              {/* Form Create Sub-Canteen */}
              <div className="bg-white border border-red-100/70 rounded-3xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="font-display font-black text-sm text-gray-900 uppercase tracking-wide">
                    Create Counter (Sub-Canteen)
                  </h3>
                  <p className="text-[11px] text-gray-400 font-sans mt-0.5">
                    Add specific kitchen counters / food stalls to an active canteen.
                  </p>
                </div>
                <form onSubmit={handleCreateSubCanteen} className="space-y-3.5 text-xs font-sans text-left">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Counter Name</label>
                    <input
                      type="text"
                      value={subName}
                      onChange={(e) => setSubName(e.target.value)}
                      required
                      placeholder="e.g. Chinese Corner Counter 1"
                      className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Assigned Canteen</label>
                    <select
                      value={subCantId}
                      onChange={(e) => setSubCantId(e.target.value)}
                      required
                      className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold cursor-pointer"
                    >
                      <option value="">Select Canteen...</option>
                      {canteens.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({colleges.find(col => col.id === c.collegeId)?.name || c.collegeId})</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-white rounded-xl text-xs py-3 font-bold transition-all shadow-md cursor-pointer flex items-center justify-center space-x-1.5 font-display"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Counter</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Tables Side */}
            <div className="lg:col-span-8 space-y-6">
              {/* Canteens List */}
              <div className="bg-white rounded-3xl border border-red-100/60 shadow-xs overflow-hidden text-left">
                <div className="p-5 border-b border-red-50/50">
                  <h3 className="font-display font-black text-sm text-gray-900 uppercase tracking-wide">
                    Active Canteens ({canteens.length})
                  </h3>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-red-50/50 border-b border-red-100/40 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                        <th className="px-6 py-4.5 text-left">Canteen Name</th>
                        <th className="px-6 py-4.5 text-left">College Campus</th>
                        <th className="px-6 py-4.5 text-left">Owner</th>
                        <th className="px-6 py-4.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50 font-sans text-slate-700">
                      {filteredCanteens.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-xs text-gray-400 p-8 text-center">No canteens active.</td>
                        </tr>
                      ) : (
                        filteredCanteens.map(c => (
                          <tr key={c.id}>
                            <td className="px-6 py-4 font-bold text-gray-950">
                              <span>{c.name}</span>
                              <span className="block text-[10px] text-gray-400 font-mono font-normal mt-0.5">{c.location}</span>
                            </td>
                            <td className="px-6 py-4 font-semibold text-gray-700">
                              {colleges.find(col => col.id === c.collegeId)?.name || c.collegeId}
                            </td>
                            <td className="px-6 py-4 text-gray-550">
                              <span>{c.ownerName}</span>
                            </td>
                            <td className="px-6 py-4 text-right flex items-center justify-end space-x-2">
                              <button
                                onClick={() => openEditCanteen(c)}
                                className="text-amber-600 hover:text-amber-800 hover:bg-amber-50/60 p-2 rounded-xl transition cursor-pointer border border-amber-100/25"
                                title="Edit Canteen"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveTab('dashboards');
                                  handleLoadCanteenDashboard(c.id);
                                }}
                                className="text-amber-600 hover:text-red-900 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition cursor-pointer font-bold text-[10px] uppercase border border-red-200"
                              >
                                View Dashboard
                              </button>
                              <button
                                onClick={() => handleDeleteCanteen(c.id)}
                                className="text-rose-600 hover:text-rose-800 hover:bg-rose-50/60 p-2 rounded-xl transition cursor-pointer flex items-center justify-center border border-rose-100/25"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sub-Canteens List */}
              <div className="bg-white rounded-3xl border border-red-100/60 shadow-xs overflow-hidden text-left">
                <div className="p-5 border-b border-red-50/50">
                  <h3 className="font-display font-black text-sm text-gray-900 uppercase tracking-wide">
                    Kitchen Counters / Sub-Canteens ({subCanteens.length})
                  </h3>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-red-50/50 border-b border-red-100/40 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                        <th className="px-6 py-4.5 text-left">Counter Name</th>
                        <th className="px-6 py-4.5 text-left">Parent Canteen</th>
                        <th className="px-6 py-4.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50 font-sans text-slate-700">
                      {subCanteens.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-xs text-gray-400 p-8 text-center">No kitchen counters registered yet.</td>
                        </tr>
                      ) : (
                        subCanteens.map(s => (
                          <tr key={s.id}>
                            <td className="px-6 py-4 font-bold text-gray-950">{s.name}</td>
                            <td className="px-6 py-4 font-semibold text-gray-700">
                              {canteens.find(c => c.id === s.canteenId)?.name || s.canteenId}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEditSubCanteen(s)}
                                  className="text-amber-600 hover:text-amber-800 hover:bg-amber-50/60 p-2 rounded-xl transition cursor-pointer border border-amber-100/25"
                                  title="Edit Counter"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteSubCanteen(s.id)}
                                  className="text-rose-600 hover:text-rose-800 hover:bg-rose-50/60 p-2 rounded-xl transition cursor-pointer flex items-center justify-center border border-rose-100/25"
                                >
                                  <Trash2 className="h-4.5 w-4.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB VIEW */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* USER ACCOUNT PROVISION FORM */}
            <div className="lg:col-span-4 bg-white border border-red-100/70 rounded-3xl p-5 md:p-6 shadow-sm space-y-5">
              <div>
                <h3 className="font-display font-black text-sm text-gray-900 uppercase tracking-wide">
                  Provision User Account
                </h3>
                <p className="text-[11px] text-gray-400 font-sans mt-0.5">
                  Create new student, kitchen, or counter staff access profiles.
                </p>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-sans text-left">
                {isSuperAdmin && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Assigned College</label>
                    <select
                      value={usrColId}
                      onChange={(e) => setUsrColId(e.target.value)}
                      required
                      className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold cursor-pointer"
                    >
                      <option value="">Select College...</option>
                      {colleges.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Full Name</label>
                  <input
                    type="text"
                    value={usrName}
                    onChange={(e) => setUsrName(e.target.value)}
                    required
                    placeholder="e.g. Chef Watson"
                    className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Email Address</label>
                  <input
                    type="email"
                    value={usrEmail}
                    onChange={(e) => setUsrEmail(e.target.value)}
                    required
                    placeholder="e.g. chef@gmail.com"
                    className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Access Role</label>
                  <select
                    value={usrRole}
                    onChange={(e) => setUsrRole(e.target.value as any)}
                    required
                    className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold cursor-pointer"
                  >
                    <option value="customer">Customer</option>
                    <option value="chef">Chef</option>
                    <option value="staff">Counter Staff</option>
                    <option value="owner">Canteen Owner</option>
                    {isSuperAdmin && <option value="admin">College Admin</option>}
                    {isSuperAdmin && <option value="superadmin">Super Admin</option>}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Posting / Designation</label>
                  <input
                    type="text"
                    value={usrPosting}
                    onChange={(e) => setUsrPosting(e.target.value)}
                    placeholder="e.g. Counter 1 Manager / North Chef"
                    className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold"
                  />
                </div>

                {/* Scoped Canteen selection */}
                {(usrRole === 'owner' || usrRole === 'chef' || usrRole === 'staff') && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Assigned Canteen</label>
                    <select
                      value={usrCantId}
                      onChange={(e) => setUsrCantId(e.target.value)}
                      required
                      className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold cursor-pointer"
                    >
                      <option value="">Select Canteen...</option>
                      {canteens.filter(c => isSuperAdmin ? c.collegeId === usrColId : c.collegeId === activeCollegeId).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Sub-canteen counter select */}
                {(usrRole === 'chef' || usrRole === 'staff') && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Assigned Sub-Canteen</label>
                    <select
                      value={usrSubId}
                      onChange={(e) => setUsrSubId(e.target.value)}
                      className="w-full bg-red-50/30 hover:bg-red-50/60 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-800 font-semibold cursor-pointer"
                    >
                      <option value="">Select Counter...</option>
                      {subCanteens.filter(s => s.canteenId === usrCantId).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-white rounded-xl text-xs py-3 font-bold transition-all shadow-md cursor-pointer flex items-center justify-center space-x-1.5 font-display"
                >
                  <UserPlus className="h-4.5 w-4.5" />
                  <span>Add User Account</span>
                </button>
              </form>
            </div>

            {/* REGISTERED USERS DIRECTORY */}
            <div className="lg:col-span-8 bg-white rounded-3xl border border-red-100/60 shadow-xs overflow-hidden text-left">
              <div className="p-5 border-b border-red-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-display font-black text-sm text-gray-900 uppercase tracking-wide">
                    Accounts Registry ({filteredUsers.length})
                  </h3>
                  <p className="text-[11px] text-gray-400 font-sans">
                    Active directory of students, kitchen counters, and outlet owners.
                  </p>
                </div>
              </div>

              {/* Superadmin User Filters */}
              {isSuperAdmin && (
                <div className="px-5 py-3 border-b border-red-50/50 flex flex-wrap gap-3 items-center">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filter by:</label>
                  <select
                    value={selectedCollegeFilter}
                    onChange={e => { setSelectedCollegeFilter(e.target.value); setUserCanteenFilter('all'); setUserSubCanteenFilter('all'); }}
                    className="bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 font-semibold cursor-pointer"
                  >
                    <option value="all">All Colleges</option>
                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>

                  <select
                    value={userCanteenFilter}
                    onChange={e => { setUserCanteenFilter(e.target.value); setUserSubCanteenFilter('all'); }}
                    className="bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 font-semibold cursor-pointer"
                  >
                    <option value="all">All Canteens</option>
                    {canteens.filter(c => selectedCollegeFilter === 'all' || c.collegeId === selectedCollegeFilter).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <select
                    value={userSubCanteenFilter}
                    onChange={e => setUserSubCanteenFilter(e.target.value)}
                    className="bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 font-semibold cursor-pointer"
                  >
                    <option value="all">All Counters</option>
                    {subCanteens.filter(s => userCanteenFilter === 'all' || s.canteenId === userCanteenFilter).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>

                  {(selectedCollegeFilter !== 'all' || userCanteenFilter !== 'all' || userSubCanteenFilter !== 'all') && (
                    <button
                      onClick={() => { setSelectedCollegeFilter('all'); setUserCanteenFilter('all'); setUserSubCanteenFilter('all'); }}
                      className="text-[10px] text-red-600 hover:text-red-800 font-bold cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}

              <div className="overflow-x-auto text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-red-50/50 border-b border-red-100/40 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                      <th className="px-6 py-4.5 text-left">User Profile</th>
                      <th className="px-6 py-4.5 text-left">Email Address</th>
                      <th className="px-6 py-4.5 text-left">Role Control</th>
                      <th className="px-6 py-4.5 text-right">Emergency Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50 font-sans text-slate-700">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-xs text-gray-400 p-8 text-center">
                          No registered accounts found.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(usr => (
                        <tr key={usr.email} className="hover:bg-red-50/15">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-red-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-sm">
                                {usr.name ? usr.name.charAt(0).toUpperCase() : '?'}
                              </div>
                              <div>
                                <span className="font-bold text-gray-900 block capitalize">{usr.name}</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {isSuperAdmin && (
                                    <span className="text-[9px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold uppercase border border-slate-200">
                                      {colleges.find(c => c.id === usr.collegeId)?.name || usr.collegeId || 'No College'}
                                    </span>
                                  )}
                                  {usr.canteenId && (
                                    <span className="text-[9px] bg-red-50 text-amber-600 px-2 py-0.5 rounded-full font-bold uppercase border border-red-100/45">
                                      {canteens.find(c => c.id === usr.canteenId)?.name || usr.canteenId}
                                    </span>
                                  )}
                                  {usr.posting && (
                                    <span className="text-[9px] bg-emerald-50 text-emerald-750 px-2 py-0.5 rounded-full font-bold border border-emerald-100/45">
                                      Posting: {usr.posting}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-gray-500 truncate max-w-[160px]">{usr.email}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col space-y-1">
                              <select
                                value={usr.role}
                                onChange={(e) => handleUpdateUserRole(usr.email, e.target.value)}
                                className="bg-red-50/60 border border-red-100 rounded-lg px-2.5 py-1 text-[11px] font-bold text-red-900 outline-none cursor-pointer focus:bg-white"
                              >
                                <option value="customer">Customer</option>
                                <option value="chef">Chef</option>
                                <option value="staff">Counter Staff</option>
                                <option value="owner">Canteen Owner</option>
                                {isSuperAdmin && <option value="admin">College Admin</option>}
                                {isSuperAdmin && <option value="superadmin">Super Admin</option>}
                              </select>
                              <input
                                type="text"
                                defaultValue={usr.posting || ''}
                                placeholder="Enter Posting..."
                                onBlur={(e) => {
                                  if (e.target.value !== (usr.posting || '')) {
                                    handleUpdateUserRole(usr.email, usr.role, e.target.value);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="bg-red-50/35 border border-red-100 rounded-lg px-2 py-0.5 text-[10px] text-gray-700 outline-none focus:bg-white"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditUser(usr)}
                              className="text-amber-600 hover:text-red-900 hover:bg-red-50 p-2 rounded-xl transition cursor-pointer border border-red-100/25"
                              title="Edit User"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button
                              onClick={() => handleDeleteUser(usr.email)}
                              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50/60 p-2 rounded-xl transition cursor-pointer flex items-center justify-center ml-auto border border-rose-100/25"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CANTEEN DASHBOARDS REPLICATOR TAB */}
        {activeTab === 'dashboards' && (
          <div className="space-y-6 animate-fade-in text-left">
            <div className="bg-white border border-red-100 rounded-3xl p-6 shadow-sm">
              <h3 className="font-display font-black text-sm text-gray-900 uppercase tracking-wide mb-2">
                Live Canteen Dashboard Replicator
              </h3>
              <p className="text-xs text-gray-550 mb-4">
                Select any active canteen to view and manage its stock, menu, orders, and sales performance in real-time.
              </p>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label className="text-xs font-bold text-gray-600">Select Canteen:</label>
                <select
                  value={viewingCanteenId || ''}
                  onChange={(e) => {
                    const cid = e.target.value;
                    if (cid) {
                      handleLoadCanteenDashboard(cid);
                    } else {
                      setViewingCanteenId(null);
                      setViewingCanteenData(null);
                    }
                  }}
                  className="bg-red-50/50 hover:bg-red-50 focus:bg-white text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-semibold text-gray-800 cursor-pointer min-w-[200px]"
                >
                  <option value="">Choose a canteen...</option>
                  {canteens.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({colleges.find(col => col.id === c.collegeId)?.name || c.collegeId})</option>
                  ))}
                </select>
              </div>
            </div>

            {viewingCanteenId && (
              <div className="bg-white border border-red-100 rounded-3xl shadow-sm">
                {viewingLoading || !viewingCanteenData ? (
                  <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center">
                    <div className="h-10 w-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-xs font-semibold">Synchronizing Live Canteen Dashboard...</p>
                  </div>
                ) : (
                  <div className="border-t border-red-50">
                    <CanteenAdmin
                      menuItems={viewingCanteenData.items || []}
                      orders={viewingCanteenData.orders || []}
                      reviews={viewingCanteenData.reviews || []}
                      ingredients={viewingCanteenData.ingredients || []}
                      settings={viewingCanteenData.settings}
                      onAddMenuItem={async (payload) => {
                        const resp = await fetch(`${API_BASE}/api/canteen/menu`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ...payload, canteenId: viewingCanteenId })
                        });
                        const d = await resp.json();
                        if (d.success) silentRefreshCanteen(viewingCanteenId);
                        return d;
                      }}
                      onDeleteMenuItem={async (id) => {
                        const resp = await fetch(`${API_BASE}/api/canteen/menu/${id}`, { method: 'DELETE' });
                        const d = await resp.json();
                        if (d.success) silentRefreshCanteen(viewingCanteenId);
                        return d;
                      }}
                      onUpdateOrderStatus={async (id, status) => {
                        const resp = await fetch(`${API_BASE}/api/canteen/order/status`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id, status })
                        });
                        const d = await resp.json();
                        if (d.success) silentRefreshCanteen(viewingCanteenId);
                        return d;
                      }}
                      onFetchCanteen={() => silentRefreshCanteen(viewingCanteenId)}
                      onLogout={() => {
                        setViewingCanteenId(null);
                        setViewingCanteenData(null);
                      }}
                      userRole="owner"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-red-50">
              <div>
                <h3 className="font-display font-black text-sm text-gray-900 uppercase">Edit User Account</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Update profile for {editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Full Name</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-red-50/30 text-xs px-3 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Email Address</label>
                  <input type="email" value={editEmail} disabled className="w-full bg-gray-50 text-xs px-3 py-2.5 border border-gray-200 rounded-xl text-gray-500 font-semibold cursor-not-allowed" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">New Password (leave blank to keep)</label>
                  <input type="text" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Enter new password" className="w-full bg-red-50/30 text-xs px-3 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Access Role</label>
                  <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full bg-red-50/30 text-xs px-3 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold cursor-pointer">
                    <option value="customer">Customer</option>
                    <option value="chef">Chef</option>
                    <option value="staff">Counter Staff</option>
                    <option value="owner">Canteen Owner</option>
                    <option value="admin">College Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">College</label>
                  <select value={editColId} onChange={e => setEditColId(e.target.value)} className="w-full bg-red-50/30 text-xs px-3 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold cursor-pointer">
                    <option value="">Select College</option>
                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Canteen</label>
                  <select value={editCantId} onChange={e => setEditCantId(e.target.value)} className="w-full bg-red-50/30 text-xs px-3 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold cursor-pointer">
                    <option value="">Select Canteen</option>
                    {canteens.filter(c => !editColId || c.collegeId === editColId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Sub-Canteen / Counter</label>
                  <select value={editSubId} onChange={e => setEditSubId(e.target.value)} className="w-full bg-red-50/30 text-xs px-3 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold cursor-pointer">
                    <option value="">Select Counter</option>
                    {subCanteens.filter(s => !editCantId || s.canteenId === editCantId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Posting / Designation</label>
                  <input type="text" value={editPosting} onChange={e => setEditPosting(e.target.value)} placeholder="e.g. Counter 1 Manager" className="w-full bg-red-50/30 text-xs px-3 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingUser(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer">Cancel</button>
                <button onClick={handleUpdateUser} className="flex-1 bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-white rounded-xl py-2.5 text-xs font-bold transition-all shadow-md cursor-pointer">Save Changes</button>
                </div>
              </div>

              {/* FULL BRANDING EDITOR */}
              <div className="bg-white rounded-3xl border border-red-100/60 shadow-xs overflow-hidden text-left">
                <div className="p-5 border-b border-red-50/50">
                  <h3 className="font-display font-black text-sm text-gray-900 uppercase tracking-wide">Customer Page Branding</h3>
                  <p className="text-[11px] text-gray-400 font-sans mt-0.5">Full control over what customers see. Changes reflect immediately.</p>
                </div>
                <div className="p-5 space-y-5">
                  {colleges.map(c => {
                    const b = (c as any).branding || {};
                    const saveBranding = async (field: string, value: any) => {
                      const updated = { ...b, [field]: value };
                      try {
                        await fetch(`${API_BASE}/api/colleges/${c.id}/branding`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(updated),
                        });
                        await syncAdminData();
                      } catch (err) { console.error(err); }
                    };
                    return (
                      <div key={c.id} className="border border-red-100 rounded-xl p-4 space-y-4">
                        <div className="flex items-center gap-2 border-b border-red-50 pb-2">
                          <div className="h-6 w-6 rounded bg-amber-100 flex items-center justify-center text-amber-700 text-[10px] font-bold">{c.name.charAt(0)}</div>
                          <span className="text-xs font-bold text-gray-900">{c.name}</span>
                          <span className="text-[9px] text-gray-400 ml-auto">College ID: {c.id}</span>
                        </div>

                        {/* Hero Section */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Hero Section</label>
                          <input
                             defaultValue={b.heroTitle || 'Esc(Q)'}
                            onBlur={(e) => saveBranding('heroTitle', e.target.value)}
                             placeholder="Hero Title (e.g. Esc(Q))"
                            className="w-full bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                          />
                          <input
                            defaultValue={b.heroSubtitle || `Official ${c.name} Canteen Platform`}
                            onBlur={(e) => saveBranding('heroSubtitle', e.target.value)}
                            placeholder="Subtitle (e.g. Official College Canteen Platform)"
                            className="w-full bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                          />
                          <input
                            defaultValue={b.heroTagline || 'Order Faster · Skip the Queue · Smart Pickup'}
                            onBlur={(e) => saveBranding('heroTagline', e.target.value)}
                            placeholder="Tagline (e.g. Order Faster · Skip the Queue)"
                            className="w-full bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                          />
                        </div>

                        {/* Feature Badges */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Feature Badges (comma separated)</label>
                          <input
                            defaultValue={(b.featureBadges || ['Order Faster', 'Skip the Queue', 'Smart Pickup']).join(', ')}
                            onBlur={(e) => saveBranding('featureBadges', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                            placeholder="Order Faster, Skip the Queue, Smart Pickup"
                            className="w-full bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                          />
                        </div>

                        {/* Menu Section */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Menu Section</label>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              defaultValue={b.menuTitle || "Today's Menu"}
                              onBlur={(e) => saveBranding('menuTitle', e.target.value)}
                              placeholder="Menu Title"
                              className="bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                            />
                            <input
                              defaultValue={b.menuSubtitle || 'Freshly prepared, just for you.'}
                              onBlur={(e) => saveBranding('menuSubtitle', e.target.value)}
                              placeholder="Menu Subtitle"
                              className="bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase block">Grid Columns</label>
                              <select
                                defaultValue={b.menuColumns || 4}
                                onChange={(e) => saveBranding('menuColumns', Number(e.target.value))}
                                className="bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                              >
                                <option value={2}>2 Columns</option>
                                <option value={3}>3 Columns</option>
                                <option value={4}>4 Columns</option>
                              </select>
                            </div>
                            <label className="flex items-center gap-2 text-[10px] font-bold text-gray-600 cursor-pointer mt-4">
                              <input
                                type="checkbox"
                                defaultChecked={b.showCategoryTabs !== false}
                                onChange={(e) => saveBranding('showCategoryTabs', e.target.checked)}
                                className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                              />
                              Show Category Tabs
                            </label>
                          </div>
                        </div>

                        {/* Visibility Toggles */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Visibility</label>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 text-[10px] font-bold text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                defaultChecked={b.showReviews !== false}
                                onChange={(e) => saveBranding('showReviews', e.target.checked)}
                                className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                              />
                              Show Reviews
                            </label>
                            <label className="flex items-center gap-2 text-[10px] font-bold text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                defaultChecked={b.showSentiment !== false}
                                onChange={(e) => saveBranding('showSentiment', e.target.checked)}
                                className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                              />
                              Show Sentiment Log
                            </label>
                          </div>
                        </div>

                        {/* Footer & Contact */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Footer &amp; Contact</label>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              defaultValue={b.contactPhone || '0431 123 4567'}
                              onBlur={(e) => saveBranding('contactPhone', e.target.value)}
                              placeholder="Contact Phone"
                              className="bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                            />
                            <input
                               defaultValue={b.contactEmail || `support@escq.in`}
                              onBlur={(e) => saveBranding('contactEmail', e.target.value)}
                              placeholder="Contact Email"
                              className="bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                            />
                          </div>
                          <input
                            defaultValue={b.contactAddress || 'Trichy, Tamil Nadu, India'}
                            onBlur={(e) => saveBranding('contactAddress', e.target.value)}
                            placeholder="Contact Address"
                            className="w-full bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                          />
                          <input
                            defaultValue={b.footerCopyright || `© 2026 ${c.name}. All Rights Reserved.`}
                            onBlur={(e) => saveBranding('footerCopyright', e.target.value)}
                            placeholder="Copyright Text"
                            className="w-full bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                          />
                          <input
                            defaultValue={(b.footerLinks || [
                              { label: 'Menu & Order', action: 'menu' },
                              { label: 'Order History', action: 'history' },
                              { label: 'My Profile', action: 'profile' },
                              { label: 'Help & Support', action: 'help' }
                            ]).map((l: any) => l.label).join(', ')}
                            onBlur={(e) => {
                              const links = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean).map((label: string) => ({
                                label,
                                action: label.toLowerCase().includes('menu') ? 'menu' : label.toLowerCase().includes('order') ? 'history' : label.toLowerCase().includes('profile') ? 'profile' : 'help'
                              }));
                              saveBranding('footerLinks', links);
                            }}
                            placeholder="Footer Links (comma separated)"
                            className="w-full bg-red-50/30 text-xs px-3 py-2 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                          />
                        </div>

                        {/* ALIGNMENT & LAYOUT CONTROLS */}
                        <div className="space-y-2 border-t border-red-50 pt-3">
                          <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Alignment &amp; Layout</label>

                          {/* Hero Layout */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase block">Hero Layout</label>
                              <select
                                defaultValue={b.heroLayout || 'logo-left'}
                                onChange={(e) => saveBranding('heroLayout', e.target.value)}
                                className="w-full bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                              >
                                <option value="logo-left">Logo Left, Banner Right</option>
                                <option value="logo-right">Logo Right, Banner Left</option>
                                <option value="logo-center">Logo Center, Banner Bottom</option>
                                <option value="banner-left">Banner Left, Logo Right</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase block">Banner Position</label>
                              <select
                                defaultValue={b.heroBannerPosition || 'right'}
                                onChange={(e) => saveBranding('heroBannerPosition', e.target.value)}
                                className="w-full bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                              >
                                <option value="right">Right Side</option>
                                <option value="left">Left Side</option>
                                <option value="background">Full Background</option>
                                <option value="bottom">Below Content</option>
                              </select>
                            </div>
                          </div>

                          {/* Logo Size & Padding */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase block">Logo Size</label>
                              <select
                                defaultValue={b.heroLogoSize || 144}
                                onChange={(e) => saveBranding('heroLogoSize', Number(e.target.value))}
                                className="w-full bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                              >
                                <option value={96}>Small (96px)</option>
                                <option value={120}>Medium (120px)</option>
                                <option value={144}>Large (144px)</option>
                                <option value={176}>X-Large (176px)</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase block">Hero Padding</label>
                              <select
                                defaultValue={b.heroPadding || 'normal'}
                                onChange={(e) => saveBranding('heroPadding', e.target.value)}
                                className="w-full bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                              >
                                <option value="compact">Compact</option>
                                <option value="normal">Normal</option>
                                <option value="spacious">Spacious</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase block">Card Style</label>
                              <select
                                defaultValue={b.headerStyle || 'rounded'}
                                onChange={(e) => saveBranding('headerStyle', e.target.value)}
                                className="w-full bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                              >
                                <option value="rounded">Rounded</option>
                                <option value="flat">Flat</option>
                                <option value="shadow">Shadow</option>
                              </select>
                            </div>
                          </div>

                          {/* Menu Layout */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase block">Menu Card Size</label>
                              <select
                                defaultValue={b.menuCardSize || 'medium'}
                                onChange={(e) => saveBranding('menuCardSize', e.target.value)}
                                className="w-full bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                              >
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase block">Menu Gap</label>
                              <select
                                defaultValue={b.menuGap || 'normal'}
                                onChange={(e) => saveBranding('menuGap', e.target.value)}
                                className="w-full bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                              >
                                <option value="tight">Tight</option>
                                <option value="normal">Normal</option>
                                <option value="loose">Loose</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase block">Menu Alignment</label>
                              <select
                                defaultValue={b.menuAlignment || 'left'}
                                onChange={(e) => saveBranding('menuAlignment', e.target.value)}
                                className="w-full bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="justify">Justify</option>
                              </select>
                            </div>
                          </div>

                          {/* Footer & Section Spacing */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase block">Footer Layout</label>
                              <select
                                defaultValue={b.footerLayout || '3-col'}
                                onChange={(e) => saveBranding('footerLayout', e.target.value)}
                                className="w-full bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                              >
                                <option value="3-col">3 Columns</option>
                                <option value="2-col">2 Columns</option>
                                <option value="1-col">1 Column (Stacked)</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase block">Section Spacing</label>
                              <select
                                defaultValue={b.sectionSpacing || 'normal'}
                                onChange={(e) => saveBranding('sectionSpacing', e.target.value)}
                                className="w-full bg-red-50/30 text-xs px-3 py-1.5 border border-red-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                              >
                                <option value="compact">Compact</option>
                                <option value="normal">Normal</option>
                                <option value="spacious">Spacious</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUPPORT TICKETS TAB VIEW */}
        {activeTab === 'tickets' && (
          <div className="max-w-6xl mx-auto px-4 mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <LifeBuoy className="h-5 w-5 text-amber-600" /> Support Tickets
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Customer help requests and issues</p>
              </div>
              <div className="flex gap-2">
                {['all', 'open', 'in_progress', 'resolved', 'closed'].map(f => (
                  <button key={f} onClick={() => setTicketFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${ticketFilter === f ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                    {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
                    {f === 'open' && supportTickets.filter(t => t.status === 'open').length > 0 && ` (${supportTickets.filter(t => t.status === 'open').length})`}
                  </button>
                ))}
              </div>
            </div>

            {loadingTickets ? (
              <div className="text-center py-12 text-gray-400">
                <div className="h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading tickets...
              </div>
            ) : supportTickets.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <LifeBuoy className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No support tickets yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {supportTickets
                  .filter(t => ticketFilter === 'all' || t.status === ticketFilter)
                  .map((ticket) => {
                    const catEmoji: Record<string, string> = { payment: '💳', refund: '💰', order: '📦', account: '👤', app: '📱', other: '❓' };
                    const statusColors: Record<string, string> = {
                      open: 'bg-amber-50 border-amber-200', in_progress: 'bg-blue-50 border-blue-200',
                      resolved: 'bg-green-50 border-green-200', closed: 'bg-gray-50 border-gray-200',
                    };
                    return (
                      <div key={ticket.id} className={`rounded-2xl border p-5 ${statusColors[ticket.status] || statusColors.open}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-lg">{catEmoji[ticket.category] || '❓'}</span>
                              <span className="text-[10px] font-mono text-gray-400">{ticket.id}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                ticket.status === 'open' ? 'bg-amber-200 text-amber-800' :
                                ticket.status === 'in_progress' ? 'bg-blue-200 text-blue-800' :
                                ticket.status === 'resolved' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'
                              }`}>{ticket.status.replace('_', ' ').toUpperCase()}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                ticket.priority === 'high' ? 'bg-red-200 text-red-800' :
                                ticket.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-600'
                              }`}>{ticket.priority.toUpperCase()}</span>
                            </div>
                            <h3 className="text-sm font-bold text-gray-800">{ticket.subject}</h3>
                            <p className="text-xs text-gray-600 mt-1">{ticket.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
                              <span>👤 {ticket.userName} ({ticket.userEmail})</span>
                              {ticket.orderId && <span className="font-mono">📦 {ticket.orderId}</span>}
                              <span>🕐 {new Date(ticket.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            {ticket.adminReply && (
                              <div className="mt-3 bg-white rounded-xl p-3 border border-purple-200">
                                <p className="text-[10px] font-bold text-purple-600 mb-1">Your Reply:</p>
                                <p className="text-xs text-gray-700">{ticket.adminReply}</p>
                              </div>
                            )}
                            {/* Reply form */}
                            <div className="mt-3 flex gap-2">
                              <select value={ticketStatusUpdate[ticket.id] || ticket.status}
                                onChange={e => setTicketStatusUpdate(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                className="px-2 py-1.5 rounded-lg border border-gray-300 text-xs bg-white">
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                              </select>
                              <input type="text" placeholder="Type your reply..."
                                value={ticketReply[ticket.id] || ''}
                                onChange={e => setTicketReply(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleTicketReply(ticket.id)}
                                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs" />
                              <button onClick={() => handleTicketReply(ticket.id)}
                                className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 disabled:opacity-50"
                                disabled={!ticketReply[ticket.id]?.trim()}>
                                Reply
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

      {imageEditorOpen && (
        <ImageEditor
          initialImage={imageEditorInitial}
          title={imageEditorType === 'logo' ? 'Edit College Logo' : 'Edit Banner Image'}
          aspectRatio={imageEditorType === 'logo' ? '1:1' : '16:9'}
          shape={imageEditorType === 'logo' ? 'circle' : 'rounded'}
          maxWidth={imageEditorType === 'logo' ? 256 : 1200}
          maxHeight={imageEditorType === 'logo' ? 256 : 400}
          onSave={async (dataUrl) => {
            const endpoint = imageEditorType === 'logo'
              ? `${API_BASE}/api/colleges/${imageEditorCollegeId}/logo`
              : `${API_BASE}/api/colleges/${imageEditorCollegeId}/banner`;
            const body = imageEditorType === 'logo'
              ? { logoUrl: dataUrl }
              : { bannerUrl: dataUrl };
            try {
              const resp = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              const result = await resp.json();
              if (result.success) {
                await syncAdminData();
              } else {
                console.error('Image save failed:', result.error);
                alert('Failed to save image: ' + (result.error || 'Unknown error'));
              }
            } catch (err) {
              console.error('Failed to save image', err);
              alert('Network error saving image. Please try again.');
            }
            setImageEditorOpen(false);
          }}
          onCancel={() => setImageEditorOpen(false)}
        />
      )}

      {/* EDIT COLLEGE MODAL */}
      {editingCollege && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-red-50">
              <div>
                <h3 className="font-display font-black text-sm text-gray-900 uppercase">Edit College</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Update details for {editingCollege.name}</p>
              </div>
              <button onClick={() => setEditingCollege(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">College Name</label>
                <input type="text" value={editColName} onChange={e => setEditColName(e.target.value)} className="w-full bg-red-50/30 text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Location / Address</label>
                <input type="text" value={editColLoc} onChange={e => setEditColLoc(e.target.value)} className="w-full bg-red-50/30 text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingCollege(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer">Cancel</button>
                <button onClick={handleUpdateCollege} className="flex-1 bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-white rounded-xl py-2.5 text-xs font-bold transition-all shadow-md cursor-pointer">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CANTEEN MODAL */}
      {editingCanteen && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-red-50">
              <div>
                <h3 className="font-display font-black text-sm text-gray-900 uppercase">Edit Canteen</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Update details for {editingCanteen.name}</p>
              </div>
              <button onClick={() => setEditingCanteen(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Canteen Name</label>
                <input type="text" value={editCantName} onChange={e => setEditCantName(e.target.value)} className="w-full bg-red-50/30 text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">College</label>
                <select value={editCantCol} onChange={e => setEditCantCol(e.target.value)} className="w-full bg-red-50/30 text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold cursor-pointer">
                  <option value="">Select College</option>
                  {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Owner Name</label>
                <input type="text" value={editCantOwnName} onChange={e => setEditCantOwnName(e.target.value)} className="w-full bg-red-50/30 text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Location</label>
                <input type="text" value={editCantLoc} onChange={e => setEditCantLoc(e.target.value)} className="w-full bg-red-50/30 text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingCanteen(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer">Cancel</button>
                <button onClick={handleUpdateCanteen} className="flex-1 bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-white rounded-xl py-2.5 text-xs font-bold transition-all shadow-md cursor-pointer">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SUB-CANTEEN MODAL */}
      {editingSubCanteen && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-red-50">
              <div>
                <h3 className="font-display font-black text-sm text-gray-900 uppercase">Edit Counter / Sub-Canteen</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Update details for {editingSubCanteen.name}</p>
              </div>
              <button onClick={() => setEditingSubCanteen(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Counter Name</label>
                <input type="text" value={editSubName} onChange={e => setEditSubName(e.target.value)} className="w-full bg-red-50/30 text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Parent Canteen</label>
                <select value={editSubCantId} onChange={e => setEditSubCantId(e.target.value)} className="w-full bg-red-50/30 text-xs px-3.5 py-2.5 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold cursor-pointer">
                  <option value="">Select Canteen</option>
                  {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingSubCanteen(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer">Cancel</button>
                <button onClick={handleUpdateSubCanteen} className="flex-1 bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-white rounded-xl py-2.5 text-xs font-bold transition-all shadow-md cursor-pointer">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
