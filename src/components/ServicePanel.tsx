/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users, Trash2, LogOut, CheckCircle, AlertTriangle, UserPlus, Sparkles, X, Globe, MapPin, Plus, TrendingUp
} from 'lucide-react';
import { Order, MenuItem } from '../types';
import { API_BASE } from '../config';
import CanteenAdmin from './CanteenAdmin';

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

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const [activeTab, setActiveTab] = useState<'users' | 'colleges' | 'canteens'>(isSuperAdmin ? 'canteens' : 'users');
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
                  {colLogo && <img src={colLogo} alt="Logo preview" className="h-10 w-10 rounded-lg object-cover border border-red-100 mt-1" />}
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
                              <label className="relative cursor-pointer group">
                                {c.logoUrl ? <img src={c.logoUrl} alt="" className="h-7 w-7 rounded-lg object-cover border border-red-100 group-hover:opacity-70 transition" /> : <div className="h-7 w-7 rounded-lg bg-red-100 flex items-center justify-center text-amber-600 text-[10px] font-bold group-hover:bg-red-200 transition">{c.name.charAt(0)}</div>}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onloadend = async () => {
                                      const logoData = reader.result as string;
                                      try {
                                        const resp = await fetch(`${API_BASE}/api/colleges/${c.id}/logo`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ logoUrl: logoData })
                                        });
                                        const d = await resp.json();
                                        if (d.success) {
                                          await syncAdminData();
                                        }
                                      } catch (err) {
                                        console.error('Failed to upload logo', err);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                />
                              </label>
                              <span>{c.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-500">{c.location}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDeleteCollege(c.id)}
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
                        <div className="h-6 w-6 rounded bg-red-100 flex items-center justify-center text-red-700 text-[10px] font-bold">{c.name.charAt(0)}</div>
                        <span className="text-xs font-bold text-gray-900">{c.name}</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Banner Image</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              try {
                                await fetch(`${API_BASE}/api/colleges/${c.id}/banner`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ bannerUrl: reader.result as string })
                                });
                                await syncAdminData();
                              } catch (err) { console.error(err); }
                            };
                            reader.readAsDataURL(file);
                          }}
                          className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-100 file:text-red-700 hover:file:bg-red-200 cursor-pointer"
                        />
                        {c.bannerUrl && <img src={c.bannerUrl} alt="Banner" className="w-full h-20 object-cover rounded-lg border border-gray-100 mt-1" />}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Banner Subtitle</label>
                        <input
                          type="text"
                          defaultValue={c.bannerSubtitle || 'Official SkipQ Platform'}
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
                      placeholder="e.g. Violet Bites"
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
                    {cantLogo && <img src={cantLogo} alt="Logo preview" className="h-10 w-10 rounded-lg object-cover border border-red-100 mt-1" />}
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
                              <button
                                onClick={() => handleDeleteSubCanteen(s.id)}
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
              <div className="bg-white border border-red-100 rounded-3xl shadow-sm overflow-hidden">
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
                        if (d.success) handleLoadCanteenDashboard(viewingCanteenId);
                        return d;
                      }}
                      onDeleteMenuItem={async (id) => {
                        const resp = await fetch(`${API_BASE}/api/canteen/menu/${id}`, { method: 'DELETE' });
                        const d = await resp.json();
                        if (d.success) handleLoadCanteenDashboard(viewingCanteenId);
                        return d;
                      }}
                      onUpdateOrderStatus={async (id, status) => {
                        const resp = await fetch(`${API_BASE}/api/canteen/order/status`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id, status })
                        });
                        const d = await resp.json();
                        if (d.success) handleLoadCanteenDashboard(viewingCanteenId);
                        return d;
                      }}
                      onFetchCanteen={() => handleLoadCanteenDashboard(viewingCanteenId)}
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
          </div>
        </div>
      )}
    </div>
  );
}
