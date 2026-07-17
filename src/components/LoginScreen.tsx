/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChefHat, Eye, EyeOff, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { API_BASE } from '../config';

interface LoginScreenProps {
  onLoginSuccess: (user: { id: string; email: string; name: string; role: 'customer' | 'owner' | 'superadmin' | 'admin' | 'chef' | 'staff'; collegeId?: string; canteenId?: string; subCanteenId?: string }) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'customer' | 'owner' | 'chef' | 'staff' | 'admin'>('customer');
  const [isSignUp, setIsSignUp] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('watson777@gmail.com');
  const [passwordInput, setPasswordInput] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        // Register new user
        const resp = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nameInput,
            email: emailInput,
            password: passwordInput,
            role: activeTab
          })
        });
        const data = await resp.json();
        if (data.success && data.user) {
          onLoginSuccess({ ...data.user, role: activeTab });
        } else {
          setError(data.error || 'Failed to create account.');
        }
      } else {
        // Authenticate existing user
        const resp = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailInput,
            password: passwordInput,
            role: activeTab
          })
        });
        const data = await resp.json();
        if (data.success && data.user) {
          onLoginSuccess({ ...data.user, role: activeTab });
        } else {
          setError(data.error || 'Invalid email or password.');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Connection failure to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e8e4f5] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden p-8 border border-violet-100 transition-all">
        {/* BRAND BADGE */}
        <div className="flex flex-col items-center text-center space-y-2 mb-6">
          <div className="h-14 w-14 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
            <ChefHat className="h-8 w-8" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-gray-900 tracking-tight">Violet Bites</h1>
            <p className="text-xs font-semibold text-violet-600 font-sans tracking-wide">Your campus canteen, just a click away.</p>
          </div>
        </div>

        {/* ROLE BAR PILLS */}
        <div className="grid grid-cols-3 gap-2 bg-violet-50 p-2 rounded-2xl border border-violet-100/50 mb-6">
          {(['customer', 'chef', 'staff', 'owner', 'admin'] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => {
                setActiveTab(role);
                setError('');
                if (role === 'owner') {
                  setEmailInput('canteen_owner@gmail.com');
                } else if (role === 'admin') {
                  setEmailInput('college_admin@gmail.com');
                } else if (role === 'chef') {
                  setEmailInput('chef@gmail.com');
                } else if (role === 'staff') {
                  setEmailInput('staff@gmail.com');
                } else {
                  setEmailInput('watson777@gmail.com');
                }
                if (role !== 'customer') {
                  setIsSignUp(false); // Sign up is only for customers
                }
              }}
              className={`text-center py-2 rounded-xl text-[10px] font-bold transition-all capitalize cursor-pointer ${
                activeTab === role
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-950'
              }`}
            >
              {role === 'owner' ? 'Owner' : role === 'admin' ? 'Colg Admin' : role === 'staff' ? 'Staff' : role}
            </button>
          ))}
        </div>

        {/* DETAILS SECTION */}
        <div className="space-y-1 mb-6">
          <h2 className="text-lg font-display font-semibold text-gray-900">
            {isSignUp ? 'Create Account' : activeTab === 'customer' ? 'Customer Login' : activeTab === 'owner' ? 'Canteen Owner Login' : activeTab === 'chef' ? 'Chef Login' : activeTab === 'staff' ? 'Counter Staff Login' : 'College Admin Login'}
          </h2>
          <p className="text-xs text-gray-500 font-sans">
            {isSignUp 
              ? 'Join Violet Bites today to order meals instantly.' 
              : activeTab === 'customer' 
              ? 'Enter your credentials to order your meal.' 
              : activeTab === 'owner' 
              ? 'Access the canteen owner management dashboard.' 
              : activeTab === 'chef'
              ? 'Access the kitchen order status queue.'
              : activeTab === 'staff'
              ? 'Verify live customer ticket pickups.'
              : activeTab === 'admin'
              ? 'Manage college-level canteen allocations.'
              : 'Access the global multi-canteen platform console.'}
          </p>
        </div>

        {/* ERROR BOX */}
        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 mb-4 flex items-center space-x-2 text-rose-800 text-xs font-sans">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* AUTH FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Full Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
                className="w-full bg-violet-50/50 hover:bg-violet-50 focus:bg-white text-xs px-4 py-3.5 border border-violet-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all font-medium text-gray-800"
                placeholder="e.g. Raju Srinivasan"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Email Address</label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
              className="w-full bg-violet-50/50 hover:bg-violet-50 focus:bg-white text-xs px-4 py-3.5 border border-violet-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all font-medium text-gray-800"
              placeholder="e.g. watson777@gmail.com"
            />
          </div>

          <div className="space-y-1.5 relative">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Password</label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                className="w-full bg-violet-50/50 hover:bg-violet-50 focus:bg-white text-xs px-4 py-3.5 border border-violet-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all font-mono text-gray-800 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-violet-600 hover:bg-violet-750 active:bg-violet-800 text-white rounded-xl text-xs py-3.5 font-semibold transition-all shadow-md flex items-center justify-center space-x-2 disabled:bg-violet-400/80 cursor-pointer font-display"
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isSignUp ? (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Create Account</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Login</span>
              </>
            )}
          </button>
        </form>

        {/* TOGGLE SIGN IN / SIGN UP */}
        {activeTab === 'customer' && (
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setNameInput('');
              }}
              className="text-xs text-violet-700 hover:text-violet-900 font-bold hover:underline cursor-pointer font-sans"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        )}

        {/* DEMO ACCOUNTS HELPER */}
        {!isSignUp && (
          <div className="mt-6 border-t border-violet-50 pt-5 text-center">
            <span className="text-[10px] text-gray-450 font-medium">
              Demo credentials are fully pre-filled. Press Login to explore.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
