
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User } from '../types';
import { mockCloud } from '../services/mockCloud';
import apiClient from '../services/apiClient';
import { useToast } from '../components/Toast';
import { getApiService } from '../config/apiSwitch';

interface RegisterProps {
  onLogin: (user: User) => void;
}

const Register: React.FC<RegisterProps> = ({ onLogin }) => {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiService, setApiService] = useState<typeof apiClient | typeof mockCloud>(mockCloud);

  useEffect(() => {
    const initService = async () => {
      const service = await getApiService();
      setApiService(service);
    };
    initService();
  }, []);

  const handleRegister = async () => {
    if (!username || !mobile || !password || !confirmPassword) {
      toast.warning('请完整填写昵称、手机号、密码和确认密码');
      return;
    }
    if (password.length < 8) {
      toast.warning('密码长度至少 8 位');
      return;
    }
    if (password !== confirmPassword) {
      toast.warning('两次输入的密码不一致');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(mobile)) {
      toast.warning('请输入有效的中国大陆手机号');
      return;
    }

    setLoading(true);
    try {
      const user = await apiService.register(mobile, password, username);
      toast.success('注册成功！');
      onLogin(user);
    } catch (e: any) {
      const message =
        e?.message ||
        e?.response?.data?.message ||
        (Array.isArray(e?.response?.data?.errors) ? e.response.data.errors[0]?.msg : '') ||
        '注册失败，请重试';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8">
      
      <div className="flex-1 overflow-y-auto">
        <div className="mt-8 mb-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-2xl mb-6 border border-primary/20">
            <span className="material-symbols-outlined text-primary text-4xl">person_add</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">用户注册</h1>
          <p className="text-slate-400 text-sm">创建您的牌局记账账户</p>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/50 p-1 rounded-xl flex">
            <Link to="/login" className="flex-1 py-2 text-sm font-semibold rounded-lg text-slate-400 text-center">
              登录
            </Link>
            <button className="flex-1 py-2 text-sm font-semibold rounded-lg bg-primary shadow-sm text-background-dark">
              注册
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">用户昵称</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none pr-3">
                  <span className="material-icons text-slate-400 text-sm">face</span>
                </div>
                <input 
                  className="w-full bg-slate-900 border-none rounded-xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-primary transition-all" 
                  placeholder="起一个响亮的名字" 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

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
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">设置密码</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none pr-3">
                  <span className="material-icons text-slate-400 text-sm">lock_open</span>
                </div>
                <input 
                  className="w-full bg-slate-900 border-none rounded-xl py-4 pl-12 pr-12 text-white focus:ring-2 focus:ring-primary transition-all" 
                  placeholder="至少8位字符" 
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

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">确认密码</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none pr-3">
                  <span className="material-icons text-slate-400 text-sm">lock</span>
                </div>
                <input 
                  className="w-full bg-slate-900 border-none rounded-xl py-4 pl-12 pr-12 text-white focus:ring-2 focus:ring-primary transition-all" 
                  placeholder="请再次输入密码" 
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-primary transition-colors"
                  aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
                >
                  <span className="material-icons text-sm">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <button 
              onClick={handleRegister}
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-background-dark font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? <div className="w-5 h-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin"></div> : <span>注册并登录</span>}
              {!loading && <span className="material-icons text-sm">arrow_forward</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="py-6 text-center">
        <p className="text-[10px] text-slate-600 leading-relaxed">
          点击“注册并登录”即表示您同意我们的 <a className="underline" href="#">服务条款</a> 和 <a className="underline" href="#">隐私政策</a>。请理性娱乐。
        </p>
      </div>
    </div>
  );
};

export default Register;
