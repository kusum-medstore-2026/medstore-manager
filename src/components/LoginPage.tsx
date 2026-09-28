import React, { useState } from 'react';
import {
  Pill,
  Lock,
  Mail,
  User as UserIcon,
  ShieldCheck,
  Eye,
  EyeOff,
  Building,
  Phone,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Stethoscope,
  Briefcase
} from 'lucide-react';
import { User, AuthResponse } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('pharmacist@medstore.com');
  const [loginPassword, setLoginPassword] = useState('pharma123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<'pharmacist' | 'admin' | 'cashier'>('pharmacist');
  const [regStoreName, setRegStoreName] = useState('MedStore Healthcare Pharmacy');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Quick Demo Login helper
  const handleQuickLogin = async (email: string, pass: string) => {
    setLoginEmail(email);
    setLoginPassword(pass);
    await performLogin(email, pass);
  };

  const performLogin = async (email: string, pass: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });

      const data: AuthResponse = await res.json();

      if (!res.ok || !data.success || !data.user) {
        throw new Error(data.error || 'Authentication failed. Please verify credentials.');
      }

      setSuccessMessage(data.message || `Welcome back, ${data.user.name}!`);

      if (rememberMe) {
        localStorage.setItem('medstore_user', JSON.stringify(data.user));
        if (data.token) {
          localStorage.setItem('medstore_token', data.token);
        }
      }

      setTimeout(() => {
        onLoginSuccess(data.user!, data.token || 'medstore_token');
      }, 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    performLogin(loginEmail, loginPassword);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!regName.trim()) {
      setErrorMessage('Please provide your full name.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (regPassword.length < 4) {
      setErrorMessage('Password must be at least 4 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          role: regRole,
          storeName: regStoreName,
          phone: regPhone
        })
      });

      const data: AuthResponse = await res.json();

      if (!res.ok || !data.success || !data.user) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccessMessage(`Account registered for ${data.user.name}! Logging in...`);

      localStorage.setItem('medstore_user', JSON.stringify(data.user));
      if (data.token) {
        localStorage.setItem('medstore_token', data.token);
      }

      setTimeout(() => {
        onLoginSuccess(data.user!, data.token || 'medstore_token');
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-emerald-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Background ambient medical glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card */}
      <div className="w-full max-w-xl z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 mb-4 ring-4 ring-emerald-500/20">
            <Pill className="w-9 h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <span>MedStore Manager</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              v2.4
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1.5 max-w-sm mx-auto">
            Pharmacy Inventory & Automated Billing System • Secure Staff Portal
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-white/95 backdrop-blur-xl text-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20">
          {/* Tab Selector */}
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
            <button
              type="button"
              id="tab-btn-login"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                activeTab === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In (लॉगिन)
            </button>
            <button
              type="button"
              id="tab-btn-register"
              onClick={() => {
                setActiveTab('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                activeTab === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Register Staff (नया खाता)
            </button>
          </div>

          {/* Alerts Banner */}
          {errorMessage && (
            <div
              id="auth-error-alert"
              className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-start gap-2.5 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div
              id="auth-success-alert"
              className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-start gap-2.5 animate-in fade-in"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {activeTab === 'login' ? (
            /* ================= LOGIN TAB ================= */
            <div>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Staff Email / Store ID
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      id="input-login-email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. pharmacist@medstore.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 rounded-xl text-sm transition-all outline-hidden text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <span className="text-[11px] text-emerald-600 font-medium cursor-default">
                      Default: pharma123 / admin123
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="input-login-password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 rounded-xl text-sm transition-all outline-hidden text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span>Remember login session</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('pharmacist@medstore.com', 'pharma123')}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                  >
                    Reset to Demo
                  </button>
                </div>

                <button
                  type="submit"
                  id="btn-submit-login"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* 1-Click Instant Demo Login Options */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Instant 1-Click Demo Logins:</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal">Click to login</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    id="btn-quick-pharmacist"
                    onClick={() => handleQuickLogin('pharmacist@medstore.com', 'pharma123')}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/60 text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-800">
                        Pharmacist
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">Priya Sharma</div>
                    <div className="text-[10px] text-emerald-600 font-mono">pharma123</div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-admin"
                    onClick={() => handleQuickLogin('admin@medstore.com', 'admin123')}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/60 text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-xs font-bold text-slate-800 group-hover:text-amber-800">
                        Store Admin
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">Dr. Ramesh Gupta</div>
                    <div className="text-[10px] text-amber-600 font-mono">admin123</div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-cashier"
                    onClick={() => handleQuickLogin('cashier@medstore.com', 'cashier123')}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/60 text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-xs font-bold text-slate-800 group-hover:text-blue-800">
                        Cashier / POS
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">Rahul Verma</div>
                    <div className="text-[10px] text-blue-600 font-mono">cashier123</div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ================= REGISTER TAB ================= */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name (पूरा नाम) *
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Dr. Anita Deshmukh"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 rounded-xl text-sm transition-all outline-hidden text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@pharmacy.com"
                      className="w-full pl-10 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 rounded-xl text-xs sm:text-sm transition-all outline-hidden text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Staff Role (पद) *
                  </label>
                  <select
                    value={regRole}
                    onChange={(e: any) => setRegRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 rounded-xl text-xs sm:text-sm transition-all outline-hidden text-slate-900 font-medium"
                  >
                    <option value="pharmacist">👨‍⚕️ Pharmacist (Full Inventory)</option>
                    <option value="admin">👑 Store Admin / Owner</option>
                    <option value="cashier">🏷️ Cashier (Billing & Sales)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Store / Pharmacy Name
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regStoreName}
                      onChange={(e) => setRegStoreName(e.target.value)}
                      placeholder="MedStore Pharmacy"
                      className="w-full pl-10 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 rounded-xl text-xs sm:text-sm transition-all outline-hidden text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+91 98765..."
                      className="w-full pl-10 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 rounded-xl text-xs sm:text-sm transition-all outline-hidden text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 4 chars"
                      className="w-full pl-10 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 rounded-xl text-xs sm:text-sm transition-all outline-hidden text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-10 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 rounded-xl text-xs sm:text-sm transition-all outline-hidden text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                id="btn-submit-register"
                disabled={isLoading}
                className="w-full mt-3 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Staff Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info badge */}
        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Secured with Firebase Admin & Role-Based Access Control</span>
        </div>
      </div>
    </div>
  );
}
