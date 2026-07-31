'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiFetch, getApproverEmails } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('returnUrl');
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      setReturnUrl(decodeURIComponent(url));
    } else {
      setReturnUrl(null);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API_BASE}/login`, {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          remember_me: rememberMe,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Login gagal');
        setLoading(false);
        return;
      }

      localStorage.clear();
      sessionStorage.clear();
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('user_id', data.data.user.id.toString());
      storage.setItem('fullName', data.data.user.full_name);
      storage.setItem('department', data.data.user.department_name || 'Staff');
      storage.setItem('department_id', data.data.user.department_id);
      storage.setItem('roles', JSON.stringify(data.data.user.roles));
      storage.setItem('isSupervisor', data.data.user.is_supervisor.toString());
      storage.setItem('permissions', JSON.stringify(data.data.permissions));
      storage.setItem('menus', JSON.stringify(data.data.menus));
      storage.setItem('mustChangePassword', data.data.user.must_change_password.toString());

      if (data.data.user.must_change_password) {
        window.location.href = '/dashboard/profile/change-password';
      } else {
        const redirectTo = returnUrl && returnUrl.trim() !== '' ? returnUrl : '/dashboard';
        window.location.href = redirectTo;
      }
    } catch (err) {
      setError('Terjadi kesalahan koneksi. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_EMAIL_EMERTRACK || '';
  

  const handleContactAdmin = async () => {
    const ccList = await getApproverEmails();

    console.log("admin Email : ", ADMIN_EMAIL);

    const subject = encodeURIComponent('Bantuan Akses EMERTRACK');
    const body = encodeURIComponent(
      'Halo Admin,\n\nSaya memerlukan bantuan untuk mengakses sistem EMERTRACK.\n\n'
    );
    const cc = ccList.length > 0 ? `&cc=${encodeURIComponent(ccList.join(','))}` : '';

    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}${cc}&body=${body}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#eef1f5] to-[#f8f9fa] relative font-sans">
      {/* Background abstract element - responsif */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-full h-full sm:w-1/2 bg-white/40 transform sm:skew-x-12 sm:translate-x-32"></div>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 z-10">
        {/* Header & Logo - responsif */}
        <div className="flex flex-col items-center mb-6 sm:mb-8 md:mb-10">
          <img 
            src="/images/logo-kch.png" 
            alt="PT Kalbe Consumer Health" 
            className="w-36 sm:w-44 md:w-48 h-auto mb-4 sm:mb-5 object-contain"
          />
          <h1 className="text-2xl sm:text-3xl md:text-[28px] font-bold text-[#003d7a] tracking-wide text-center">
            EMERTRACK
          </h1>
          <p className="text-[10px] sm:text-[11px] font-semibold text-gray-500 tracking-[0.2em] mt-1 text-center">
            EMERGENCY TRACKING
          </p>
        </div>

        {/* Login Card - responsif */}
        <div className="bg-white rounded-xl shadow-[0_10px_40px_rgb(0,0,0,0.06)] w-full max-w-sm sm:max-w-md md:max-w-md lg:max-w-md p-6 sm:p-8 md:p-10">
          <h2 className="text-xl sm:text-2xl md:text-[22px] text-center font-bold text-gray-900 mb-2">Welcome Back</h2>
          <p className="text-xs sm:text-sm text-center text-gray-500 mb-6 sm:mb-8 leading-relaxed">
            Please enter your email and password to access the system.
          </p>

          <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-600 text-xs sm:text-sm p-2 sm:p-3 rounded-md border border-red-100 text-center">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1 sm:space-y-2">
              <label className="block text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                Email
              </label>
              <input
                type="text"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter your email"
                className="w-full bg-[#e8ebed] text-gray-800 text-xs sm:text-sm rounded-md px-3 sm:px-4 py-2.5 sm:py-3.5 focus:outline-none focus:ring-2 focus:ring-[#003d7a] transition-all placeholder:text-gray-400"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => router.push('/login/forgot-password')}
                  className="text-[9px] sm:text-[10px] font-black text-[#003d7a] hover:underline tracking-wide"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-[#e8ebed] text-gray-800 text-xs sm:text-sm rounded-md px-3 sm:px-4 py-2.5 sm:py-3.5 focus:outline-none focus:ring-2 focus:ring-[#003d7a] transition-all pr-10 sm:pr-12 placeholder:text-gray-400 placeholder:tracking-widest"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Checkbox */}
            <div className="flex items-center pt-1">
              <div className="relative flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer h-4 w-4 appearance-none rounded-sm border-2 border-gray-300 bg-[#e8ebed] checked:bg-[#003d7a] checked:border-[#003d7a] focus:ring-2 focus:ring-[#003d7a] focus:ring-offset-1 transition-all cursor-pointer"
                />
                <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-0 peer-checked:opacity-100 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <label htmlFor="remember" className="ml-2 block text-xs sm:text-sm text-gray-600 cursor-pointer select-none">
                Keep me signed in
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center bg-[#003d7a] hover:bg-[#002d5c] disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm sm:text-[15px] font-medium py-2.5 sm:py-3.5 rounded-md transition-colors mt-4"
            >
              {loading ? 'Signing In...' : 'Sign In'}
              {!loading && (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 ml-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              )}
            </button>
          </form>

          {/* Contact Administrator */}
          <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-gray-100 text-center">
            <p className="text-xs sm:text-[13px] text-gray-600">
              Need help to access the system?{' '}
              <button
                type="button"
                onClick={handleContactAdmin}
                className="font-bold text-[#003d7a] hover:underline"
              >
                Contact Administrator
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Footer - responsif */}
      <footer className="pb-6 sm:pb-8 pt-3 sm:pt-4 text-center z-10 w-full px-4">
        <p className="text-[9px] sm:text-[10px] font-medium text-gray-400 tracking-[0.1em] uppercase">
          © 2026 EMERTRACK. ALL RIGHTS RESERVED. PT BINTANG TOEDJOE.
        </p>
      </footer>
    </div>
  );
}