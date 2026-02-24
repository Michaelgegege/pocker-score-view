import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Room } from '../types';
import apiClient from '../services/apiClient';
import { mockCloud } from '../services/mockCloud';
import { useToast } from '../components/Toast';
import { getApiService } from '../config/apiSwitch';

interface RoomDetailHistoryProps {
  user: User;
}

const RoomDetailHistory: React.FC<RoomDetailHistoryProps> = ({ user }) => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [room, setRoom] = useState<Room | null>(null);
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
    if (!roomCode || !apiService) return;
    
    const fetchRoomDetail = async () => {
      try {
        setLoading(true);
        const roomData = await apiService.getRoom(roomCode);
        if (roomData) {
          setRoom(roomData);
        } else {
          toast.error('房间不存在');
          navigate('/game-history');
        }
      } catch (error) {
        console.error('获取房间详情失败:', error);
        toast.error('加载失败，请重试');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomDetail();
  }, [roomCode, apiService]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark">
        <div className="text-center">
          <p className="text-slate-400 mb-4">房间不存在</p>
          <button 
            onClick={() => navigate('/game-history')}
            className="bg-primary text-black px-6 py-2 rounded-xl font-bold"
          >
            返回历史
          </button>
        </div>
      </div>
    );
  }

  // 计算当前用户在该房间的统计数据
  const currentMember = room.members.find(m => m.userId === user.id);
  const userRounds = room.rounds.filter(round => 
    round.scores.hasOwnProperty(user.id)
  );
  const userWins = userRounds.filter(round => {
    const userScore = round.scores[user.id];
    return userScore > 0;
  }).length;

  return (
    <div className="flex-1 flex flex-col bg-background-dark text-white min-h-screen">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-background-dark/80 ios-blur px-6 pt-12 pb-4 border-b border-primary/5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/game-history')}
            className="flex items-center gap-2 text-primary font-semibold"
          >
            <span className="material-icons">arrow_back</span>
            返回
          </button>
          <h1 className="text-xl font-bold">对局详情</h1>
          <div className="w-16"></div>
        </div>

        {/* 房间信息卡片 */}
        <div className="bg-gradient-to-r from-primary/20 to-emerald-500/20 rounded-2xl p-4 border border-primary/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400 mb-1">房间号</p>
              <p className="text-2xl font-bold tracking-wider">
                {room.roomCode.slice(0, 3)} {room.roomCode.slice(3)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 mb-1">总局数</p>
              <p className="text-2xl font-bold text-primary">{room.rounds.length}</p>
            </div>
          </div>
          
          {currentMember && (
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <img src={currentMember.avatar} className="w-10 h-10 rounded-full border-2 border-primary" alt="avatar" />
                <div>
                  <p className="text-sm font-bold">我的战绩</p>
                  <p className="text-xs text-slate-400">{userWins} 胜 / {userRounds.length} 局</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">总计得分</p>
                <p className={`text-2xl font-bold ${currentMember.totalScore >= 0 ? 'text-primary' : 'text-red-400'}`}>
                  {currentMember.totalScore >= 0 ? '+' : ''}{currentMember.totalScore}
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 对局列表 */}
      <main className="flex-1 px-6 py-6 pb-32 overflow-y-auto">
        {room.rounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-icons text-5xl text-slate-400 mb-4">casino</span>
            <p className="text-slate-400 text-center">该房间暂无对局记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1 mb-4">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                对局列表
              </h2>
              <span className="text-xs text-slate-500">共 {room.rounds.length} 局</span>
            </div>

            {room.rounds.map((round) => {
              // 找出本局获胜者
              const winnerEntry = Object.entries(round.scores).find(([, score]) => (score as number) > 0);
              const winnerId = winnerEntry ? winnerEntry[0] : round.winnerId;
              const winnerMember = room.members.find(m => m.userId === winnerId);
              const isUserWinner = winnerId === user.id;
              const userScore = round.scores[user.id] ?? 0;

              return (
                <div 
                  key={round.roundNumber} 
                  className={`rounded-xl border p-4 transition-all ${
                    isUserWinner 
                      ? 'bg-primary/10 border-primary/30' 
                      : userScore < 0 
                        ? 'bg-red-400/10 border-red-400/30'
                        : 'bg-white/5 border-white/10'
                  }`}
                >
                  {/* 局号和获胜者 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                        isUserWinner ? 'bg-primary/20 text-primary' : 'bg-white/10 text-slate-400'
                      }`}>
                        {round.roundNumber}
                      </div>
                      <span className="text-sm font-bold text-slate-300">第 {round.roundNumber} 局</span>
                    </div>
                    {winnerMember && (
                      <div className="flex items-center gap-1.5 bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20">
                        <span className="material-icons text-yellow-500" style={{fontSize: '16px'}}>emoji_events</span>
                        <span className="text-xs font-bold text-yellow-500">
                          {winnerMember.userId === user.id ? '我' : winnerMember.username}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 我的得分高亮 */}
                  <div className="bg-white/5 rounded-lg p-3 mb-3 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src={user.avatar} className="w-8 h-8 rounded-full border-2 border-primary" alt="my avatar" />
                        <div>
                          <p className="text-sm font-bold text-primary">我的得分</p>
                          <p className="text-xs text-slate-400">{user.username}</p>
                        </div>
                      </div>
                      <p className={`text-2xl font-bold ${userScore > 0 ? 'text-primary' : userScore < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {userScore > 0 ? '+' : ''}{userScore}
                      </p>
                    </div>
                  </div>

                  {/* 其他玩家得分 */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 mb-2">其他玩家</p>
                    <div className="grid grid-cols-2 gap-2">
                      {room.members
                        .filter(m => m.userId !== user.id)
                        .map(m => {
                          const score = round.scores[m.userId] ?? 0;
                          const isMemberWinner = m.userId === winnerId;
                          return (
                            <div 
                              key={m.userId} 
                              className={`flex items-center justify-between p-2 rounded-lg ${
                                isMemberWinner ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                {isMemberWinner && (
                                  <span className="material-icons text-yellow-500" style={{fontSize: '12px'}}>star</span>
                                )}
                                <span className={`text-xs ${isMemberWinner ? 'text-yellow-500 font-bold' : 'text-slate-300'}`}>
                                  {m.username.slice(0, 6)}
                                </span>
                              </div>
                              <span className={`text-sm font-bold ${score > 0 ? 'text-primary' : score < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                {score > 0 ? '+' : ''}{score}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              );
            })}
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
          className="flex flex-col items-center gap-1 text-primary"
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
        <button
          onClick={() => navigate('/statistics')}
          className="flex flex-col items-center gap-1 text-slate-500 hover:text-primary transition-colors"
        >
          <span className="material-icons">leaderboard</span>
          <span className="text-[10px] font-bold tracking-widest">统计</span>
        </button>
        <button
          onClick={() => navigate('/home')}
          className="flex flex-col items-center gap-1 text-slate-500 hover:text-red-400 transition-colors"
        >
          <span className="material-icons">logout</span>
          <span className="text-[10px] font-bold tracking-widest">退出</span>
        </button>
      </nav>
    </div>
  );
};

export default RoomDetailHistory;
