import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import apiClient from '../services/apiClient';
import { mockCloud } from '../services/mockCloud';
import { useToast } from '../components/Toast';
import { getApiService } from '../config/apiSwitch';

interface GameHistoryProps {
  user: User;
  onLogout: () => void;
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

const GameHistory: React.FC<GameHistoryProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [games, setGames] = useState<RecentGame[]>([]);
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

    const fetchGames = async () => {
      try {
        setLoading(true);
        const gamesData = await apiService.getRecentGames(user.id);
        setGames(gamesData);
      } catch (error) {
        console.error('获取对局历史失败:', error);
        toast.error('加载对局历史失败');
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [apiService, user.id]);

  return (
    <div className="flex-1 flex flex-col">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-background-dark/80 ios-blur px-6 pt-12 pb-4 border-b border-primary/5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-primary font-semibold"
          >
            <span className="material-icons">arrow_back</span>
            返回
          </button>
          <h1 className="text-xl font-bold">对局历史</h1>
          <div className="w-8"></div>
        </div>
      </header>

      {/* 内容区域 */}
      <main className="flex-1 px-6 py-6 pb-32 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : games.length > 0 ? (
          <div className="space-y-3">
            <div className="text-sm text-slate-400 px-1 mb-4">
              共 {games.length} 场对局
            </div>
            {games.map(game => (
              <div
                key={game.id}
                className={`border border-white/10 p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-all cursor-pointer ${
                  game.userIsWinner
                    ? "bg-primary/20"
                    : "bg-red-400/20"
                }`}
                onClick={() => {
                  // 跳转到房间对局详情历史页面
                  navigate(`/room-history/${game.roomCode}`);
                }}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                    game.userIsWinner
                      ? "bg-primary/20"
                      : "bg-red-400/20"
                  }`}>
                    {game.userIsWinner ? "🏆" : "×"}
                  </div>
                  <div className="flex-1">
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
                  <p className={`font-bold whitespace-nowrap ${game.profit >= 0 ? 'text-primary' : 'text-red-400'}`}>
                    {game.profit >= 0 ? '+' : ''}¥{game.profit.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-icons text-5xl text-slate-400 mb-4">history</span>
            <p className="text-slate-400 text-center">暂无对局记录</p>
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
        <button className="flex flex-col items-center gap-1 text-primary">
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
        <button
          onClick={() => navigate('/statistics')}
          className="flex flex-col items-center gap-1 text-slate-500 hover:text-primary transition-colors"
        >
          <span className="material-icons">leaderboard</span>
          <span className="text-[10px] font-bold tracking-widest">统计</span>
        </button>
        <button
          onClick={() => {
            navigate('/home');
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

export default GameHistory;
