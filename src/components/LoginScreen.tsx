import React, { useState, useEffect } from 'react';
import { ChefHat, Eye, EyeOff, LogIn, UserPlus, AlertCircle, GraduationCap, Phone, Hash, Mail, Lock, User } from 'lucide-react';
import { API_BASE } from '../config';
import { College } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: { id: string; email: string; name: string; role: 'customer' | 'owner' | 'superadmin' | 'admin' | 'chef' | 'staff'; collegeId?: string; canteenId?: string; subCanteenId?: string }) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [colleges, setColleges] = useState<College[]>([]);

  // OTP verification state for superadmin
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [pendingSuperadminUser, setPendingSuperadminUser] = useState<any>(null);

  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [registerNumberInput, setRegisterNumberInput] = useState('');
  const [selectedCollegeId, setSelectedCollegeId] = useState('');

  useEffect(() => {
    const fetchColleges = async () => {
      const fallbackColleges: College[] = [
        { id: 'college_001', name: 'Engineering College East', location: 'Main Campus', status: 'active' },
        { id: 'college_002', name: 'Science University West', location: 'Tech Campus', status: 'active' }
      ];
      try {
        const resp = await fetch(`${API_BASE}/api/colleges`);
        const data = await resp.json();
        if (data.success && data.colleges && data.colleges.length > 0) {
          setColleges(data.colleges.filter((c: College) => c.status === 'active'));
        } else {
          setColleges(fallbackColleges);
        }
      } catch (e) {
        console.error('Failed to fetch colleges, using defaults', e);
        setColleges(fallbackColleges);
      }
    };
    fetchColleges();
  }, []);

  const resetForm = () => {
    setNameInput('');
    setEmailInput('');
    setPasswordInput('');
    setPhoneInput('');
    setRegisterNumberInput('');
    setSelectedCollegeId('');
    setError('');
  };

  const handleVerifyOtp = async () => {
    if (!otpInput.trim() || otpInput.trim().length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const resp = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim(), otp: otpInput.trim() })
      });
      const data = await resp.json();
      if (data.success) {
        setShowOtpModal(false);
        setPendingSuperadminUser(null);
        setOtpInput('');
        onLoginSuccess({ ...pendingSuperadminUser, role: pendingSuperadminUser.role });
      } else {
        setOtpError(data.error || 'Invalid OTP. Please try again.');
      }
    } catch {
      setOtpError('Network error verifying OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError('');
    setOtpSent(false);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/generate-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() })
      });
      const data = await resp.json();
      if (data.success) {
        setOtpSent(true);
      } else {
        setOtpError(data.error || 'Failed to resend OTP');
      }
    } catch {
      setOtpError('Network error sending OTP.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        if (!nameInput.trim() || !emailInput.trim() || !passwordInput.trim() || !phoneInput.trim() || !registerNumberInput.trim() || !selectedCollegeId) {
          setError('All fields are required for registration.');
          setLoading(false);
          return;
        }
        const resp = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nameInput.trim(),
            email: emailInput.trim(),
            password: passwordInput,
            role: 'customer',
            phone: phoneInput.trim(),
            registerNumber: registerNumberInput.trim(),
            collegeId: selectedCollegeId
          })
        });
        const data = await resp.json();
        if (data.success && data.user) {
          onLoginSuccess({ ...data.user, role: 'customer' });
        } else {
          setError(data.error || 'Failed to create account.');
        }
      } else {
        const resp = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailInput.trim(),
            password: passwordInput
          })
        });
        const data = await resp.json();
        if (data.success && data.user) {
          // Check if superadmin — require OTP verification
          if (data.user.role === 'superadmin') {
            setPendingSuperadminUser(data.user);
            setShowOtpModal(true);
            // Auto-generate OTP
            try {
              const otpResp = await fetch(`${API_BASE}/api/auth/generate-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailInput.trim() })
              });
              const otpData = await otpResp.json();
              if (otpData.success) {
                setOtpSent(true);
              } else {
                setOtpError(otpData.error || 'Failed to send OTP');
              }
            } catch {
              setOtpError('Failed to send OTP. Please try again.');
            }
          } else {
            onLoginSuccess({ ...data.user, role: data.user.role });
          }
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
    <>
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden p-8 border border-red-100 transition-all">
        <div className="flex flex-col items-center text-center space-y-2 mb-6">
          <div className="h-14 w-14 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <ChefHat className="h-8 w-8" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-gray-900 tracking-tight">Bite &amp; Byte</h1>
            <p className="text-xs font-semibold text-amber-600 font-sans tracking-wide">Your campus canteen, just a click away.</p>
          </div>
        </div>

        <div className="flex bg-red-50 p-1.5 rounded-2xl border border-red-100/50 mb-6">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); resetForm(); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              !isSignUp ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-950'
            }`}
          >
            <LogIn className="h-3.5 w-3.5 inline mr-1.5" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); resetForm(); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isSignUp ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-950'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5 inline mr-1.5" />
            Sign Up
          </button>
        </div>

        <div className="space-y-1 mb-5">
          <h2 className="text-lg font-display font-semibold text-gray-900">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-gray-500 font-sans">
            {isSignUp
              ? 'Register as a student to start ordering meals.'
              : 'Enter your credentials to access your account.'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 mb-4 flex items-center space-x-2 text-rose-800 text-xs font-sans">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isSignUp && (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Full Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                  className="w-full bg-red-50/50 hover:bg-red-50 focus:bg-white text-xs px-4 py-3 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium text-gray-800"
                  placeholder="e.g. Raju Srinivasan"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="h-3 w-3" /> Register Number
                </label>
                <input
                  type="text"
                  value={registerNumberInput}
                  onChange={(e) => setRegisterNumberInput(e.target.value)}
                  required
                  className="w-full bg-red-50/50 hover:bg-red-50 focus:bg-white text-xs px-4 py-3 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium text-gray-800"
                  placeholder="e.g. 21CS001"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  required
                  pattern="[0-9]{10}"
                  className="w-full bg-red-50/50 hover:bg-red-50 focus:bg-white text-xs px-4 py-3 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium text-gray-800"
                  placeholder="e.g. 9940918442"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="h-3 w-3" /> Select College
                </label>
                <select
                  value={selectedCollegeId}
                  onChange={(e) => setSelectedCollegeId(e.target.value)}
                  required
                  className="w-full bg-red-50/50 hover:bg-red-50 focus:bg-white text-xs px-4 py-3 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-semibold text-gray-800 cursor-pointer"
                >
                  <option value="">-- Choose your college --</option>
                  {colleges.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> Email Address
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
              className="w-full bg-red-50/50 hover:bg-red-50 focus:bg-white text-xs px-4 py-3 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium text-gray-800"
              placeholder="e.g. rajus@gmail.com"
            />
          </div>

          <div className="space-y-1.5 relative">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                className="w-full bg-red-50/50 hover:bg-red-50 focus:bg-white text-xs px-4 py-3 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono text-gray-800 pr-10"
                placeholder={isSignUp ? "Create a password" : "Enter your password"}
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
            className="w-full mt-5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs py-3.5 font-semibold transition-all shadow-md flex items-center justify-center space-x-2 disabled:bg-amber-400/80 cursor-pointer font-display"
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
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {!isSignUp && (
          <div className="mt-5 border-t border-red-50 pt-4 text-center">
            <span className="text-[10px] text-gray-450 font-medium">
              Demo: watson777@gmail.com / password123
            </span>
          </div>
        )}
      </div>
    </div>

    {/* SUPERADMIN OTP VERIFICATION MODAL */}
    {showOtpModal && (
      <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
          <div className="bg-gradient-to-br from-amber-600 to-red-700 p-6 text-center text-white">
            <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 className="font-display font-bold text-xl">Superadmin Verification</h2>
            <p className="text-white/80 text-xs mt-1">OTP sent to usrinivasan240@gmail.com</p>
          </div>
          <div className="p-6 space-y-4">
            {otpError && (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-rose-800 text-xs font-sans">{otpError}</div>
            )}
            {otpSent && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-emerald-800 text-xs font-sans">
                OTP sent successfully. Check your phone.
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Enter 6-Digit OTP</label>
              <input
                type="text"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full bg-red-50/30 text-center text-2xl font-mono font-bold tracking-[0.3em] px-4 py-4 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                autoFocus
              />
            </div>
            <button
              onClick={handleVerifyOtp}
              disabled={otpLoading || otpInput.length !== 6}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400/60 text-white rounded-xl py-3 text-sm font-semibold transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer font-display"
            >
              {otpLoading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Verify OTP</span>
              )}
            </button>
            <button
              onClick={handleResendOtp}
              className="w-full text-amber-600 hover:text-red-900 text-xs font-semibold py-2 transition cursor-pointer"
            >
              Resend OTP
            </button>
            <button
              onClick={() => { setShowOtpModal(false); setPendingSuperadminUser(null); setOtpInput(''); setOtpError(''); }}
              className="w-full text-gray-400 hover:text-gray-600 text-xs py-2 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
