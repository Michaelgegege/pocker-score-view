
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User } from '../types';
import { mockCloud } from '../services/mockCloud';
import apiClient from '../services/apiClient';
import { useToast } from '../components/Toast';
import { getApiService } from '../config/apiSwitch';
import { getApiBaseUrl } from '../config/env';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const toast = useToast();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiService, setApiService] = useState<typeof apiClient | typeof mockCloud>(mockCloud);

  useEffect(() => {
    const initService = async () => {
      const service = await getApiService();
      setApiService(service);
    };
    initService();
  }, []);

  const handleLogin = async () => {
    if (!mobile || !password) {
      toast.warning('请输入手机号和密码');
      return;
    }
    setLoading(true);
    try {
      const user = await apiService.login(mobile, password);
      toast.success('登录成功！');
      onLogin(user);
    } catch (e: any) {
      const message =
        e?.message ||
        e?.response?.data?.message ||
        (Array.isArray(e?.response?.data?.errors) ? e.response.data.errors[0]?.msg : '') ||
        '登录失败，请重试';
      toast.error(`${message}（API: ${getApiBaseUrl()}）`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8">
      <div className="flex-1 overflow-y-auto">
        <div className="mt-8 mb-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-2xl mb-6 border border-primary/20">
            <span className="material-icons text-primary text-4xl">style</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">牌局记账</h1>
          <p className="text-slate-400 text-sm">欢迎回来</p>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/50 p-1 rounded-xl flex">
            <button className="flex-1 py-2 text-sm font-semibold rounded-lg bg-primary shadow-sm text-background-dark">
              登录
            </button>
            <Link to="/register" className="flex-1 py-2 text-sm font-semibold rounded-lg text-slate-400 text-center">
              注册
            </Link>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">手机号</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none border-r border-slate-800 pr-3 my-3">
                  <span className="text-sm font-medium text-slate-300">+86</span>
                </div>
                <input 
                  className="w-full bg-slate-900 border-none rounded-xl py-4 pl-16 pr-4 text-white focus:ring-2 focus:ring-primary transition-all" 
                  placeholder="请输入手机号" 
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">密码</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none pr-3 my-3">
                  <span className="material-icons text-slate-400 text-sm">lock</span>
                </div>
                <input 
                  className="w-full bg-slate-900 border-none rounded-xl py-4 pl-12 pr-12 text-white focus:ring-2 focus:ring-primary transition-all" 
                  placeholder="请输入密码" 
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-primary transition-colors"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  <span className="material-icons text-sm">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <button 
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-background-dark font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <div className="w-5 h-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin"></div> : <span>登录</span>}
              {!loading && <span className="material-icons text-sm">arrow_forward</span>}
            </button>
          </div>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background-dark px-4 text-slate-500 font-medium">其他方式登录</span>
            </div>
          </div>
          
        </div>
      </div>

      <div className="py-6 text-center">
        <p className="text-[10px] text-slate-600 leading-relaxed">
          点击“登录”即表示您同意我们的 <a className="underline" href="#">服务条款</a> 和 <a className="underline" href="#">隐私政策</a>。请理性娱乐。
        </p>
      </div>
    </div>
  );
};

export default Login;
