
import React, { useState } from 'react';
import { loginWithEmail } from '../services/authService';
import { UserContext } from '../types';
import { LogIn, AlertCircle, Loader2, Lock } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: UserContext) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setError('');
    
    try {
      const user = await loginWithEmail(email, password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              FinancePro
            </h1>
            <p className="text-gray-500 mt-2">Hệ thống Quản trị Tài chính Xây dựng</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-100 p-4 rounded-lg flex items-start text-red-700 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={20} className="mr-3 flex-shrink-0 mt-0.5" />
              <div>
                  <p className="font-bold">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Công Ty
              </label>
              <input
                type="email"
                required
                autoFocus
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                placeholder="ten.ho@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                  <input
                    type="password"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2" /> Đang xác thực...
                </>
              ) : (
                <>
                  Đăng Nhập <LogIn className="ml-2" size={20} />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-gray-400">Phiên bản Production 1.6 - Secured</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
