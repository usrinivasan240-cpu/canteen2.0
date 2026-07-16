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
}

export default function AppHeader({ currentRole, onChangeRole, userEmail, onLogout }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-violet-100 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* App Brand */}
          <div className="flex items-center space-x-3 text-left">
            <div className="flex items-center justify-center p-2.5 rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-200">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-display font-bold text-xl tracking-tight text-gray-900">Violet Bites</span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-600 rounded">AI-Powered</span>
              </div>
              <p className="hidden xs:block text-xs text-gray-500 font-sans tracking-wide">Your campus canteen, just a click away.</p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center space-x-4">

            {/* Profile Status Badge */}
            <div className="hidden md:flex items-center space-x-3 pl-3 border-l border-gray-100 text-left">
              <div className="text-right">
                <p className="text-xs font-bold text-gray-800 tracking-tight leading-none">
                  {currentRole === 'customer' ? 'Raju Watson' : 'Chef Watson'}
                </p>
                <span className="text-[10px] text-gray-400 font-mono">
                  {currentRole === 'customer' ? userEmail : 'admin@violetbites.campus'}
                </span>
              </div>
              <div className="h-8 w-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                {currentRole === 'customer' ? 'RW' : 'CW'}
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
