/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LogOut } from 'lucide-react';

interface AppHeaderProps {
  currentRole: 'customer' | 'owner';
  onChangeRole: (role: 'customer' | 'owner') => void;
  userEmail: string;
  onLogout: () => void;
  collegeName?: string;
  collegeLogo?: string;
}

export default function AppHeader({ currentRole, onChangeRole, userEmail, onLogout, collegeName, collegeLogo }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* App Brand */}
          <div className="flex items-center space-x-3 text-left">
            {collegeLogo ? (
              <img src={collegeLogo} alt={collegeName || 'College'} className="h-10 w-10 rounded-xl object-cover border border-gray-200 shadow-sm" />
            ) : (
              <div className="flex items-center justify-center p-2 rounded-xl bg-blue-900 text-white shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
              </div>
            )}
            <div>
              <div className="flex items-center space-x-1.5">
                {collegeName ? (
                  <span className="font-display font-bold text-base sm:text-lg tracking-tight text-gray-900">{collegeName}</span>
                ) : (
                  <span className="font-display font-bold text-xl tracking-tight text-gray-900">Violet Bites</span>
                )}
              </div>
              <p className="hidden sm:block text-[10px] text-gray-400 font-sans tracking-wide uppercase">
                Smart Canteen Platform
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center space-x-4">
            {/* Profile Status Badge */}
            <div className="hidden md:flex items-center space-x-3 pl-3 border-l border-gray-100 text-left">
              <div className="text-right">
                <p className="text-xs font-bold text-gray-800 tracking-tight leading-none">
                  {currentRole === 'customer' ? 'Student' : 'Admin'}
                </p>
                <span className="text-[10px] text-gray-400 font-mono">
                  {userEmail}
                </span>
              </div>
              <div className="h-8 w-8 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-xs">
                {userEmail?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              title="Logout"
              aria-label="Logout"
              className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
