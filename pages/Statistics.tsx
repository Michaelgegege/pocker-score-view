import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import apiClient from '../services/apiClient';
import { mockCloud } from '../services/mockCloud';
import { useToast } from '../components/Toast';
import { getApiService } from '../config/apiSwitch';

interface StatisticsProps {
  user: User;
  onLogout: () => void;
}

interface UserStats {
  winRate: number;
  totalProfit: number;
  gamesPlayed: number;
  wins: number;
}

interface GameRecord {
  id: string;
  roomCode: string;
  date: string;
  profit: number;
  isWinner: boolean;
  round?: number;
}

interface DetailedStats extends UserStats {
  maxProfit: number;
  minProfit: number;
  avgProfit: number;
}

const Statistics: React.FC<StatisticsProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [stats, setStats] = useState<DetailedStats>({ 
    winRate: 0, 
    totalProfit: 0,
    gamesPlayed: 0,
    wins: 0,
    maxProfit: 0,
    minProfit: 0,
    avgProfit: 0
  });
  const [loading, setLoading] = useState(true);
  const [apiService, setApiService] = useState<typeof apiClient | typeof mockCloud | null>(null);

  useEffect(() => {
    const initService = async () => {
      const service = await getApiService();
      setApiService(service);
    };
    initService();
  }, []);

  useEffect(() => {
    if (!apiService || !user.id) return;

    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // 并行获取统计数据和游戏记录
        const [statsData, gamesData] = await Promise.all([
          apiService.getUserStats(user.id),
          apiService.getRecentGames(user.id, 100) // 获取更多游戏记录用于计算详细数据
        ]);

        // 计算详细统计数据
        let maxProfit = 0;
        let minProfit = 0;
        let profits: number[] = [];

        if (gamesData && Array.isArray(gamesData)) {
          profits = gamesData.map((game: any) => game.profit || 0);
          if (profits.length > 0) {
            maxProfit = Math.max(...profits);
            minProfit = Math.min(...profits);
          }
        }

        const avgProfit = statsData.gamesPlayed > 0 
          ? statsData.totalProfit / statsData.gamesPlayed 
          : 0;

        const detailedStats: DetailedStats = {
          ...statsData,
          maxProfit,
          minProfit,
          avgProfit
        };

        setStats(detailedStats);
      } catch (error) {
        console.error('获取统计数据失败:', error);
        toast.error('加载统计数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [apiService, user.id]);

  return (
    <div className="flex-1 flex flex-col">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-background-dark/80 ios-blur px-6 pt-12 pb-4 border-b border-primary/5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex-1 text-center">我的统计</h1>
          <div className="w-8"></div>
        </div>
      </header>

      {/* 内容区域 */}
      <main className="flex-1 px-4 py-4 pb-32 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 总体统计卡片 */}
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 p-4 rounded-xl">
              <h2 className="text-sm text-slate-400 font-medium mb-3">总体表现</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-400 text-xs mb-1">总对局数</p>
                  <p className="text-3xl font-bold text-primary">{stats.gamesPlayed}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">总胜利数</p>
                  <p className="text-3xl font-bold text-primary">{stats.wins}</p>
                </div>
              </div>
            </div>

            {/* 胜率卡片 */}
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold">胜率</h3>
                <span className="text-4xl font-bold text-primary">{stats.winRate}%</span>
              </div>
              
              {/* 进度条 */}
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-primary to-primary/60 h-full transition-all duration-500"
                  style={{ width: `${Math.min(stats.winRate, 100)}%` }}
                ></div>
              </div>
              
              {/* 对标 */}
              <div className="flex justify-between mt-2 text-xs text-slate-400">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>

              {/* 评价 */}
              <div className="mt-3 p-2 bg-white/5 rounded-lg">
                <p className="text-sm text-slate-300">
                  {stats.winRate >= 60
                    ? '✨ 表现出色！'
                    : stats.winRate >= 50
                    ? '✓ 表现良好'
                    : stats.winRate > 0
                    ? '💪 继续加油'
                    : '开始游戏吧'}
                </p>
              </div>
            </div>

            {/* 盈利统计 */}
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
              <h3 className="text-base font-bold mb-3">总盈亏</h3>
              <div className="flex items-end gap-3">
                <div>
                  <p className="text-slate-400 text-sm mb-1">累计</p>
                  <p
                    className={`text-3xl font-bold ${
                      stats.totalProfit >= 0 ? 'text-primary' : 'text-red-400'
                    }`}
                  >
                    {stats.totalProfit >= 0 ? '+' : ''}¥{stats.totalProfit.toFixed(2)}
                  </p>
                </div>
                <div className="flex-1 h-10 bg-white/10 rounded-lg flex items-end justify-center p-2">
                  <div
                    className={`w-1 rounded-t transition-all duration-500 ${
                      stats.totalProfit >= 0
                        ? 'bg-primary'
                        : 'bg-red-400'
                    }`}
                    style={{
                      height: `${Math.min(Math.abs(stats.totalProfit / 100), 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* 详细统计 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-center">
                <p className="text-slate-400 text-xs mb-1">单局最高</p>
                <p className={`text-xl font-bold ${stats.maxProfit > 0 ? 'text-primary' : 'text-slate-400'}`}>
                  {stats.maxProfit > 0 ? `+¥${stats.maxProfit.toFixed(0)}` : '—'}
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-center">
                <p className="text-slate-400 text-xs mb-1">单局最低</p>
                <p className={`text-xl font-bold ${stats.minProfit < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {stats.minProfit < 0 ? `-¥${Math.abs(stats.minProfit).toFixed(0)}` : '—'}
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-center">
                <p className="text-slate-400 text-xs mb-1">平均盈亏</p>
                <p className={`text-xl font-bold ${
                  stats.avgProfit > 0 ? 'text-primary' : stats.avgProfit < 0 ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {stats.gamesPlayed > 0
                    ? `${stats.avgProfit >= 0 ? '+' : ''}¥${stats.avgProfit.toFixed(0)}`
                    : '—'}
                </p>
              </div>
            </div>

            {/* 提示信息 */}
            {stats.gamesPlayed > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                <p className="text-sm text-blue-300">
                  💡 根据您的 <span className="font-bold">{stats.gamesPlayed}</span> 场对局数据生成
                </p>
              </div>
            )}

            {stats.gamesPlayed === 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                <p className="text-sm text-amber-300">
                  📊 还没有任何游戏记录，开始游戏吧！
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background-dark/80 ios-blur border-t border-white/10 px-8 pt-3 pb-8 flex justify-between items-center z-50">
        <button
          onClick={() => navigate('/home')}
          className="flex flex-col items-center gap-1 text-slate-500 hover:text-primary transition-colors"
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
            onClick={() => navigate('/home')}
            className="w-14 h-14 bg-primary text-black rounded-full shadow-lg shadow-primary/20 flex items-center justify-center ring-4 ring-background-dark"
          >
            <span className="material-icons text-3xl font-bold">add</span>
          </button>
        </div>
        <button className="flex flex-col items-center gap-1 text-primary">
          <span className="material-icons">leaderboard</span>
          <span className="text-[10px] font-bold tracking-widest">统计</span>
        </button>
        <button
          onClick={() => {
            onLogout();
            navigate('/login');
            toast.info('已退出登录');
          }}
          className="flex flex-col items-center gap-1 text-slate-500 hover:text-red-400 transition-colors"
        >
          <span className="material-icons">logout</span>
          <span className="text-[10px] font-bold tracking-widest">退出</span>
        </button>
      </nav>
    </div>
  );
};

export default Statistics;
