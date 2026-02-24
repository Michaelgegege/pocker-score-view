
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { mockCloud } from '../services/mockCloud';
import apiClient from '../services/apiClient';
import { useToast } from '../components/Toast';
import { getApiService } from '../config/apiSwitch';

interface HomeProps {
  user: User;
  onLogout: () => void;
}

interface UserStats {
  winRate: number;
  totalProfit: number;
}

interface RecentGame {
  id: string;
  roomCode: string;
  date: string;
  profit: number;
  playerCount?: number;        
  winner?: string;             
  userIsWinner?: boolean;      
}

const Home: React.FC<HomeProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [apiService, setApiService] = useState<typeof apiClient | typeof mockCloud | null>(null);
  const [stats, setStats] = useState<UserStats>({ winRate: 0, totalProfit: 0 });
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const initService = async () => {
      const service = await getApiService();
      setApiService(service);
    };
    initService();
  }, []);

  // 获取用户统计数据和最近对局
  useEffect(() => {
    if (!apiService || !user.id) return;
    
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        // 并行请求两个API，提高加载速度
        const [statsData, gamesData] = await Promise.all([
          apiService.getUserStats(user.id),
          apiService.getRecentGames(user.id)
        ]);
        setStats(statsData);
        setRecentGames(gamesData);
      } catch (error) {
        console.error('获取统计数据失败:', error);
        // 保持默认值，不中断用户操作
      } finally {
        setStatsLoading(false);
      }
    };
    
    fetchStats();
  }, [apiService, user.id]);

  const handleCreateRoom = async () => {
    if (!apiService) {
      toast.info('服务初始化中，请稍候…');
      return;
    }
    setLoading(true);
    try {
      const room = await apiService.createRoom(user);
      toast.success('房间创建成功！');
      navigate(`/room/${room.id}`);
    } catch (e) {
      toast.error('创建失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!apiService) {
      toast.info('服务初始化中，请稍候…');
      return;
    }
    const code = roomCode.join('');
    if (code.length < 6) {
      toast.warning('请输入完整的 6 位房间号');
      return;
    }
    setLoading(true);
    try {
      const room = await apiService.joinRoom(user, code);
      toast.success('加入房间成功！');
      navigate(`/room/${room.id}`);
    } catch (e: any) {
      // 如果用户已经在房间内，直接导航到该房间
      if (e.message && e.message.includes('已在该房间内')) {
        try {
          const room = await apiService.getRoom(code);
          if (room) {
            toast.info('您已在该房间内，正在进入...');
            navigate(`/room/${room.id}`);
            return;
          }
        } catch (getRoomError) {
          console.error('获取房间信息失败:', getRoomError);
        }
      }
      toast.error(e.message || '加入失败，请检查房间号');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const newCode = [...roomCode];
    newCode[index] = val.slice(-1);
    setRoomCode(newCode);
    
    if (val && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-50 bg-background-dark/80 ios-blur px-6 pt-12 pb-4 border-b border-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={user.avatar} className="w-12 h-12 rounded-full border-2 border-primary object-cover" alt="Avatar" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-background-dark"></div>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">欢迎回来</p>
              <h1 className="text-xl font-bold tracking-tight">{user.username}</h1>
            </div>
          </div>
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="material-icons">notifications</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 pt-6 pb-32 overflow-y-auto scrollbar-hide">
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
            <p className="text-xs text-slate-400 font-medium">胜率</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-primary">{statsLoading ? '-' : `${stats.winRate}%`}</span>
              <span className="text-[10px] text-primary bg-primary/10 px-1 rounded uppercase">{statsLoading ? '' : stats.winRate > 50 ? '+' : ''}{statsLoading ? '' : (stats.winRate - 50)}%</span>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
            <p className="text-xs text-slate-400 font-medium">总盈利</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-primary' : 'text-red-400'}`}>
                {statsLoading ? '-' : `¥${stats.totalProfit.toFixed(0)}`}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <button 
            onClick={handleCreateRoom}
            disabled={loading || !apiService}
            className="w-full group relative overflow-hidden bg-primary p-6 rounded-2xl flex flex-col items-start justify-end h-44 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <span className="material-icons text-7xl text-black">add_circle</span>
            </div>
            <div className="relative z-10 text-left">
              <div className="w-10 h-10 bg-black/10 rounded-lg flex items-center justify-center mb-3">
                <span className="material-icons text-black">style</span>
              </div>
              <h2 className="text-xl font-bold text-black">创建新房间</h2>
              <p className="text-black/70 text-sm">开设新对局并邀请好友加入</p>
            </div>
          </button>

          <button 
            onClick={() => setShowJoinModal(true)}
            className="w-full group relative overflow-hidden bg-white/5 border-2 border-primary/30 p-6 rounded-2xl flex flex-col items-start justify-end h-44 transition-transform active:scale-[0.98]"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-icons text-7xl text-primary">login</span>
            </div>
            <div className="relative z-10 text-left">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mb-3">
                <span className="material-icons text-primary">dialpad</span>
              </div>
              <h2 className="text-xl font-bold">通过编号加入</h2>
              <p className="text-slate-400 text-sm">输入6位房间代码进入对局</p>
            </div>
          </button>
        </div>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">最近对局</h3>
            {recentGames.length > 3 && (
              <button
                onClick={() => navigate('/game-history')}
                className="text-primary text-sm font-semibold hover:text-primary/80 transition-colors"
              >
                查看全部
              </button>
            )}
          </div>
          <div className="space-y-3">
            {statsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : recentGames.length > 0 ? (
              recentGames.slice(0, 3).map(game => (
                <div key={game.id} className={`border border-white/10 p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-all cursor-pointer ${
                  game.userIsWinner
                    ? "bg-primary/20"
                    : "bg-red-400/20"
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                      game.userIsWinner
                        ? "bg-primary/20"
                        : "bg-red-400/20"
                    }`}>
                      {game.userIsWinner ? "🏆" : "×"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold">房间号 {game.roomCode}</h4>
                        {game.playerCount && (
                          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded">
                            {game.playerCount}人
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{game.date}</p>
                      {game.winner && (
                        <p className="text-xs text-slate-400">赢家: {game.winner}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${game.profit >= 0 ? 'text-primary' : 'text-red-400'}`}>
                      {game.profit >= 0 ? '+' : ''}¥{game.profit.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p>暂无对局记录</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-background-dark/80 ios-blur border-t border-white/10 px-8 pt-3 pb-8 flex justify-between items-center z-50">
        <button
          onClick={() => navigate('/home')}
          className="flex flex-col items-center gap-1 text-primary"
        >
          <span className="material-icons">dashboard</span>
          <span className="text-[10px] font-bold tracking-widest">首页</span>
        </button>
        <button
          onClick={() => navigate('/game-history')}
          className="flex flex-col items-center gap-1 text-slate-500 hover:text-primary transition-colors"
        >
          <span className="material-icons">history_edu</span>
          <span className="text-[10px] font-bold tracking-widest">历史</span>
        </button>
        <div className="relative -top-8">
          <button 
            onClick={handleCreateRoom}
            disabled={loading || !apiService}
            className="w-14 h-14 bg-primary text-black rounded-full shadow-lg shadow-primary/20 flex items-center justify-center ring-4 ring-background-dark"
          >
            <span className="material-icons text-3xl font-bold">add</span>
          </button>
        </div>
        <button
          onClick={() => navigate('/statistics')}
          className="flex flex-col items-center gap-1 text-slate-500 hover:text-primary transition-colors"
        >
          <span className="material-icons">leaderboard</span>
          <span className="text-[10px] font-bold tracking-widest">统计</span>
        </button>
        <button onClick={() => setShowLogoutConfirm(true)} className="flex flex-col items-center gap-1 text-slate-500 hover:text-red-400 transition-colors">
          <span className="material-icons">logout</span>
          <span className="text-[10px] font-bold tracking-widest">退出</span>
        </button>
      </nav>

      {showJoinModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowJoinModal(false)}></div>
          <div className="relative w-full max-w-md bg-background-dark border border-white/10 rounded-2xl p-8 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-1 bg-white/10 rounded-full mb-8"></div>
              <h3 className="text-2xl font-bold mb-2">通过编号加入</h3>
              <p className="text-slate-400 mb-8">请输入房主分享的6位房间代码</p>
              <div className="flex gap-2 mb-8">
                {roomCode.map((digit, idx) => (
                  <input 
                    key={idx}
                    id={`code-${idx}`}
                    className="w-10 h-14 text-center text-2xl font-bold bg-white/5 border-2 border-white/10 rounded-xl focus:border-primary focus:ring-0 outline-none" 
                    maxLength={1}
                    type="text"
                    value={digit}
                    onChange={(e) => handleCodeChange(idx, e.target.value)}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 w-full">
                <button 
                  onClick={() => setShowJoinModal(false)}
                  className="py-4 bg-white/5 text-slate-400 font-bold rounded-xl"
                >
                  取消
                </button>
                <button 
                  onClick={handleJoinRoom}
                  disabled={loading || !apiService || roomCode.join('').length < 6}
                  className="py-4 bg-primary text-black font-bold rounded-xl disabled:opacity-50"
                >
                  {loading ? '加入中...' : '立即加入'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)}></div>
          <div className="relative w-full bg-[#1c1c1e]/95 ios-blur rounded-[20px] overflow-hidden flex flex-col shadow-2xl border border-white/10">
            <div className="p-8 text-center">
              <h2 className="text-[17px] font-semibold text-white mb-2">确认退出登录</h2>
              <p className="text-[13px] text-white/70 leading-relaxed">
                您将退出当前账户。确定吗？
              </p>
            </div>
            <div className="flex border-t border-white/10">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-4 text-[17px] font-normal text-blue-500 border-r border-white/10 active:bg-white/5"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                  toast.info('已退出登录');
                }}
                className="flex-1 py-4 text-[17px] font-semibold text-red-400 active:bg-white/5"
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
