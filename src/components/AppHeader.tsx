/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChefHat, LogOut } from 'lucide-react';

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
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-violet-100 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* App Brand */}
          <div className="flex items-center space-x-3 text-left">
            {collegeLogo ? (
              <img src={collegeLogo} alt={collegeName || 'College'} className="h-10 w-10 rounded-2xl object-cover border border-violet-100 shadow-sm" />
            ) : (
              <div className="flex items-center justify-center p-2.5 rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-200">
                <ChefHat className="h-6 w-6" />
              </div>
            )}
            <div>
              <div className="flex items-center space-x-1.5">
                {collegeName ? (
                  <span className="font-display font-bold text-base sm:text-lg tracking-tight text-gray-900">{collegeName}</span>
                ) : (
                  <>
                    <span className="font-display font-bold text-xl tracking-tight text-gray-900">Violet Bites</span>
                    <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-600 rounded">AI-Powered</span>
                  </>
                )}
              </div>
              <p className="hidden xs:block text-xs text-gray-500 font-sans tracking-wide">
                {collegeName ? 'Your campus canteen' : 'Your campus canteen, just a click away.'}
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
              <div className="h-8 w-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                {userEmail?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>

            {/* Logout Switch Icon Trigger */}
            <button
              onClick={onLogout}
              title="Logout Session"
              aria-label="Logout"
              className="p-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-600 hover:text-violet-800 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
