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
              <div className="flex items-center justify-center p-1 rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                <img src="/escq-logo.png" alt="Esc(Q)" className="h-8 w-8 object-contain" />
              </div>
            )}
            <div>
              <div className="flex items-center space-x-1.5">
                {collegeName ? (
                  <span className="font-display font-bold text-base sm:text-lg tracking-tight text-gray-900">{collegeName}</span>
                ) : (
                   <span className="font-display font-bold text-xl tracking-tight text-gray-900">Esc(Q)</span>
                )}
              </div>
              <p className="hidden sm:block text-[10px] text-gray-400 font-sans tracking-wide uppercase">
                Esc(Q) Platform
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
              <div className="h-8 w-8 rounded-full bg-red-900 text-white flex items-center justify-center font-bold text-xs">
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
