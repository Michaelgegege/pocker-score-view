
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Room, RoomStatus } from '../types';
import { mockCloud } from '../services/mockCloud';
import apiClient from '../services/apiClient';
import { useToast } from '../components/Toast';
import { getApiService } from '../config/apiSwitch';

interface RoomViewProps {
  user: User;
}

const RoomView: React.FC<RoomViewProps> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [roomStarted, setRoomStarted] = useState(false);
  
  // Round management state
  const [winnerId, setWinnerId] = useState<string>('');
  const [myScore, setMyScore] = useState<string>('');
  const [isMyWinning, setIsMyWinning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRoundNumber, setSubmittedRoundNumber] = useState<number | null>(null);
  const [prevRoundCount, setPrevRoundCount] = useState<number>(0);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const [showConfirmUndo, setShowConfirmUndo] = useState(false);
  const [showRoundHistory, setShowRoundHistory] = useState(false);
  const [apiService, setApiService] = useState<typeof apiClient | typeof mockCloud | null>(null);
  const [isHistoryView, setIsHistoryView] = useState(false); // 标记是否从历史页面进入

  useEffect(() => {
    const initService = async () => {
      const service = await getApiService();
      setApiService(service);
    };
    initService();
  }, []);

  useEffect(() => {
    if (!id) return;
    const key = `poker_room_started_${id}`;
    setRoomStarted(localStorage.getItem(key) === '1');
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        setRoomStarted(e.newValue === '1');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [id]);

  useEffect(() => {
    if (!apiService) return;
    fetchRoom();
    const timer = setInterval(fetchRoom, 5000);
    return () => clearInterval(timer);
  }, [id, apiService, submitted, submittedRoundNumber, prevRoundCount]);

  const fetchRoom = async () => {
    if (!id || !apiService) return;
    try {
      setLoadError('');
      const data = await apiService.getRoom(id);
      console.log(`[fetchRoom] State: submitted=${submitted}, submittedRoundNumber=${submittedRoundNumber}, myScore=${myScore}, isMyWinning=${isMyWinning}`);
      console.log(`[fetchRoom] Room status: ${data?.status}`);
      if (data) {
        setRoom(data);
        
        // 如果是已结算的房间，标记为历史查看模式
        if (data.status === RoomStatus.FINISHED) {
          setIsHistoryView(true);
          setShowRoundHistory(true); // 自动展开对局记录
        }
        
        if (data.started && id) {
          localStorage.setItem(`poker_room_started_${id}`, '1');
          setRoomStarted(true);
        }
        if (winnerId === '' && data.members.length > 0) {
          // Default winner is host if first time
          setWinnerId(data.members[0].userId);
        }

        // 计算已完成的局数
        const completedRoundCount = data.rounds.length;
        const hasNewRound = completedRoundCount > prevRoundCount;
        
        console.log(`[fetchRoom] Data: completedRoundCount=${completedRoundCount}, prevRoundCount=${prevRoundCount}, hasNewRound=${hasNewRound}`);
        
        if (hasNewRound) {
          console.log(`[fetchRoom] New round completed! prevRoundCount: ${prevRoundCount} -> ${completedRoundCount}`);
        }

        // 核心清空逻辑：只要提交的那一局已完成，就清空状态
        if (submitted && submittedRoundNumber !== null && completedRoundCount >= submittedRoundNumber) {
          console.log(`[fetchRoom] ✅ Clearing state: submitted=${submitted}, submittedRound=${submittedRoundNumber}, completedCount=${completedRoundCount}`);
          setMyScore('');
          setIsMyWinning(false);
          setSubmitted(false);
          setWinnerId(data.members[0]?.userId || '');
          setSubmittedRoundNumber(null);
        } else {
          console.log(`[fetchRoom] Condition not met: submitted=${submitted}, submittedRoundNumber=${submittedRoundNumber}, check=${completedRoundCount >= (submittedRoundNumber ?? -1)}`);
        }

        // 更新 prevRoundCount（必须在最后，避免影响上面的判断）
        if (hasNewRound) {
          setPrevRoundCount(completedRoundCount);
        }
      } else {
        setLoadError('房间不存在或已被关闭');
      }
    } catch (e) {
      const message = (e as Error)?.message || '加载房间失败';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRound = async () => {
    if (!room) return;

    const winnerIdToSend = isMyWinning ? user.id : '';
    if (isMyWinning && !winnerIdToSend) {
      toast.warning('请先选择本局获胜者');
      return;
    }

    const numericScores: Record<string, number> = {};
    
    if (isMyWinning) {
      // 如果我是获胜者，分数自动计算为 0（获胜）
      numericScores[user.id] = 0;
    } else {
      // 如果我不是获胜者，必须填写自己的负分
      const raw = myScore;
      const num = Number(raw);
      if (!raw || isNaN(num) || num <= 0) {
        toast.warning('请填写自己本局的负分（输入正数）');
        return;
      }
      numericScores[user.id] = -Math.abs(Math.floor(num));
    }

    try {
      // 在提交前记录当前进行的局号（这样即使该局被加入rounds，我们也用正确的局号）
      const currentRoundNumberBefore = (room?.rounds?.length ?? 0) + 1;
      
      const updatedRoom = await apiService.submitRound(room.id, winnerIdToSend, numericScores);
      setRoom(updatedRoom);
      // 只标记为已提交，不清除输入框
      // 等待其他玩家提交，fetchRoom 中会在所有玩家都提交后自动清除输入框
      setSubmitted(true);
      setSubmittedRoundNumber(currentRoundNumberBefore);
      console.log(`[handleSubmitRound] Submitted round ${currentRoundNumberBefore}`);
      toast.success('本局提交成功！');
    } catch (e) {
      toast.error('提交失败，请重试');
    }
  };

  const handleFinishGame = async () => {
    if (!room) return;
    try {
      console.log(`[handleFinishGame] Calling finishGame...`);
      await apiService.finishGame(room.id);
      console.log(`[handleFinishGame] finishGame completed, updating room status to FINISHED`);
      
      // 直接更新room为FINISHED状态，不依赖后端返回
      setRoom({
        ...room,
        status: RoomStatus.FINISHED
      });
      
      if (id) {
        localStorage.removeItem(`poker_room_started_${id}`);
        setRoomStarted(false);
      }
      setShowConfirmFinish(false);
      toast.success('结算完成！');
    } catch (e) {
      console.error('[handleFinishGame] Error:', e);
      toast.error('结算失败，请重试');
    }
  };

  const handleUndoLastRound = async () => {
    if (!room) return;

    const currentUser = room.members.find(m => m.userId === user.id);
    const isHost = currentUser?.isHost || room.hostId === user.id;

    if (!isHost) {
      toast.warning('只有房主可以撤回上一局');
      return;
    }

    if ((room.rounds?.length || 0) === 0) {
      toast.warning('暂无可撤回的对局');
      return;
    }

    try {
      const updatedRoom = await apiService.undoLastRound(room.id);
      setRoom(updatedRoom);

      setMyScore('');
      setIsMyWinning(false);
      setSubmitted(false);
      setSubmittedRoundNumber(null);
      setPrevRoundCount(updatedRoom.rounds.length);
      setWinnerId(updatedRoom.members[0]?.userId || '');
      setShowConfirmUndo(false);

      toast.success('已撤回上一局分数');
    } catch (e) {
      const message = (e as Error)?.message || '撤回失败，请重试';
      toast.error(message);
    }
  };

  const handleCopyRoomCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.roomCode).then(() => {
      toast.success('房间号已复制');
    }).catch(() => {
      toast.error('复制失败');
    });
  };

  const handleShareRoom = () => {
    if (!room) return;
    const text = `快来和我一起玩牌吧！房间号：${room.roomCode.slice(0, 3)} ${room.roomCode.slice(3)}`;
    if (navigator.share) {
      navigator.share({
        title: '牌局邀请',
        text: text,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.info('邀请文本已复制');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="bg-card-bg border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="text-lg font-bold text-white mb-2">加载失败</div>
          <div className="text-sm text-slate-400 mb-4">{loadError}</div>
          <button onClick={() => navigate('/')} className="w-full bg-primary text-black font-bold py-3 rounded-xl">返回首页</button>
        </div>
      </div>
    );
  }

  if (!room) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">房间不存在</div>;
  }

  // 优先使用后端返回的状态，localStorage 只作为辅助判断
  const effectiveStatus = room.status === RoomStatus.FINISHED 
    ? RoomStatus.FINISHED 
    : (room.status === RoomStatus.PLAYING || room.started || roomStarted) 
      ? RoomStatus.PLAYING 
      : RoomStatus.WAITING;

  // Waiting screen
  if (effectiveStatus === RoomStatus.WAITING) {
    return (
      <div className="flex-1 flex flex-col">
        <header className="px-6 pt-12 pb-6 flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-8">
            <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-icons text-lg">arrow_back_ios_new</span>
            </button>
            <div className="px-3 py-1 bg-primary/20 rounded-full border border-primary/30">
              <span className="text-[10px] font-bold tracking-wider text-primary flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary status-pulse"></span>
                等待中
              </span>
            </div>
            <button onClick={handleShareRoom} className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-icons">share</span>
            </button>
          </div>
          <p className="text-xs font-medium text-primary/60 tracking-wider mb-2 uppercase">房间号</p>
          <div className="flex items-center gap-3 bg-slate-900/50 p-4 rounded-2xl border border-primary/20 shadow-lg">
            <span className="text-4xl font-extrabold tracking-[0.1em] text-white pl-2">
              {room.roomCode.slice(0, 3)} {room.roomCode.slice(3)}
            </span>
            <button onClick={handleCopyRoomCode} className="text-primary p-2 hover:bg-primary/10 rounded-lg">
              <span className="material-icons">content_copy</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-6 overflow-y-auto pb-32">
          <div className="bg-gradient-to-r from-primary to-emerald-500 rounded-2xl p-4 mb-8 shadow-lg shadow-primary/20">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-white font-bold text-xl">第 1 局</h2>
                <p className="text-white/80 text-sm">等待其他玩家加入...</p>
              </div>
              <div className="bg-white/20 backdrop-blur-md p-3 rounded-xl border border-white/30">
                <span className="material-icons text-white text-3xl">style</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end mb-4 px-1">
            <h3 className="text-lg font-bold">房间成员</h3>
            <span className="text-xs font-medium text-primary/70">{room.members.length} 人已加入</span>
          </div>

          <div className="space-y-1.5">
            {room.members.map(member => (
              <div key={member.userId} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 border border-primary/10">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full border-2 ${member.userId === user.id ? 'border-primary' : 'border-transparent'} overflow-hidden relative`}>
                    <img src={member.avatar} className="w-full h-full object-cover" alt="avatar" />
                    {member.userId === user.id && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary border border-background-dark rounded-full"></div>}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{member.userId === user.id ? '我' : member.username}</p>
                    <p className="text-xs text-primary/60">{member.isHost ? '房主 • ' : ''}已就绪</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">总计</p>
                  <p className="text-lg font-bold text-primary">0</p>
                </div>
              </div>
            ))}
          </div>
        </main>

        <footer className="absolute bottom-0 left-0 w-full p-6 pb-10 bg-gradient-to-t from-background-dark via-background-dark/95 to-transparent">
          <div className="flex flex-col gap-3">
            <button 
              onClick={async () => {
                if (room.hostId !== user.id) {
                  toast.warning('只有房主可以开始本局');
                  return;
                }
                try {
                  const updatedRoom = await apiService.startRoom(room.id);
                  setRoom(updatedRoom);
                } catch (e) {
                  if (id) {
                    localStorage.setItem(`poker_room_started_${id}`, '1');
                    setRoomStarted(true);
                  }
                }
                toast.success('本局已开始');
              }}
              disabled={room.hostId !== user.id}
              className="w-full bg-primary hover:bg-primary/90 text-background-dark font-extrabold py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-primary/20 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-icons">play_circle</span>
              开始本局
            </button>
            <button onClick={async () => {
              await apiService.leaveRoom(room.id, user.id);
              if (id) {
                localStorage.removeItem(`poker_room_started_${id}`);
                setRoomStarted(false);
              }
              toast.info('已退出房间');
              navigate('/');
            }} className="w-full text-red-400 font-bold py-2 rounded-xl text-sm hover:bg-red-500/10 transition-all">
              解散/退出
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // Active Game Screen
  if (effectiveStatus === RoomStatus.PLAYING) {
    return (
      <div className="flex-1 flex flex-col bg-background-dark text-slate-100">
        <header className="px-6 py-4 bg-background-dark/80 ios-blur sticky top-0 z-40 border-b border-primary/10">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(18,226,88,0.6)]"></span>
                <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-primary">实时对局中</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight">房间号: <span className="text-primary">{room.roomCode.slice(0,3)}-{room.roomCode.slice(3)}</span></h1>
            </div>
            <button onClick={handleShareRoom} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
              <span className="material-symbols-outlined text-[20px] text-primary">share</span>
            </button>
          </div>
        </header>

        <main className="flex-grow pb-64 overflow-y-auto scrollbar-hide">
          {/* 计分提交模块 - 固定在顶部 */}
          <section className="sticky top-0 z-30 bg-gradient-to-b from-background-dark via-background-dark to-background-dark/80 px-6 py-2.5 border-b border-primary/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold">计分提交</h3>
            </div>

            <div>
              {(() => {
                const currentUser = room.members.find(m => m.userId === user.id);
                if (!currentUser) return null;
                
                return (
                  <div className={`bg-card-bg border border-white/10 rounded-lg p-3 transition-all`}>
                    {/* 用户信息 - 水平布局 */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="relative">
                        <img src={currentUser.avatar} className="w-10 h-10 rounded-full border-2 border-primary object-cover" alt="avatar" />
                        <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-black text-[7px] font-bold px-1 rounded-full">ME</span>
                        {currentUser.isHost && <span className="absolute -top-0.5 -left-0.5 bg-yellow-500 text-black text-[6px] font-bold px-0.5 rounded">BOSS</span>}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-xs">{currentUser.username}</div>
                          <div className="text-sm font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">
                            第 {room.rounds.length + 1} 局
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-500">总分: {currentUser.totalScore}</div>
                      </div>
                    </div>
                    
                    {/* 操作区域 - 紧凑布局 */}
                    <div className="flex flex-col gap-2 w-full">
                      {/* 获胜按钮和分数输入 - 横向布局 */}
                      {!submitted && (
                        <div className="flex items-stretch gap-2 w-full">
                          {/* "是否获胜"按钮 */}
                          <button 
                            onClick={() => {
                              setIsMyWinning(!isMyWinning);
                              if (!isMyWinning) {
                                // 选择获胜：设置当前用户为胜利者
                                setWinnerId(user.id);
                              } else {
                                // 取消获胜：重置胜利者
                                setWinnerId(room?.members[0]?.userId || '');
                              }
                            }}
                            className={`px-4 rounded-md font-semibold text-sm transition-all active:scale-95 whitespace-nowrap flex items-center justify-center ${
                              isMyWinning 
                                ? 'bg-primary text-black shadow-lg shadow-primary/20' 
                                : 'bg-white/10 text-slate-300 border border-white/20 hover:bg-white/15'
                            }`}
                          >
                            {isMyWinning ? '✓ 获胜' : '本局获胜'}
                          </button>

                          {/* 分数输入框或自动计算提示 */}
                          {isMyWinning ? (
                            <div className="flex-1 min-w-0 flex items-center justify-center bg-primary/10 rounded-md px-3 py-2.5 border border-primary/30">
                              <span className="text-primary text-sm font-bold">提交后分数自动计算</span>
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0 flex items-center bg-black/50 rounded-md px-3 py-2.5 border border-white/10 gap-2">
                              <span className="text-slate-400 text-sm font-semibold whitespace-nowrap">负分</span>
                              <input 
                                className="bg-transparent border-none text-right text-lg font-black text-red-500 flex-1 focus:ring-0 p-0 w-full min-w-0" 
                                placeholder="0"
                                type="number"
                                value={myScore}
                                onChange={(e) => setMyScore(e.target.value)}
                              />
                              <span className="text-slate-400 font-bold text-sm whitespace-nowrap">分</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 已提交状态 */}
                      {submitted && (
                        <div className="text-slate-400 font-black text-xs px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-center">
                          ✓ 已提交
                        </div>
                      )}
                      
                      {/* 提交按钮 */}
                      <button 
                        onClick={handleSubmitRound}
                        disabled={submitted}
                        className={`font-black py-2 rounded-md text-xs flex items-center justify-center gap-1 transition-all ${
                          submitted 
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                            : 'bg-primary text-black shadow-[0_8px_16px_rgba(18,226,88,0.2)] active:scale-[0.98]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">send</span>
                        {submitted ? '等待其他玩家提交...' : '提交得分'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>

          {/* 局数列表 */}
          <div className="w-full overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[375px]">
              <thead>
                <tr className="bg-white/5 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  <th className="py-4 px-4">局数</th>
                  {room.members.map(m => (
                    <th key={m.userId} className="py-4 px-2 text-center">
                      <div className="flex flex-col items-center">
                        <div className="relative mb-1">
                          <img src={m.avatar} className={`w-8 h-8 rounded-full border ${m.userId === user.id ? 'border-primary' : 'border-white/10'}`} alt="avatar" />
                          {m.isHost && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[7px] font-bold px-1 rounded">BOSS</span>}
                        </div>
                        <span className={m.userId === user.id ? 'text-primary' : ''}>{m.username.slice(0, 4)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {room.rounds.map((round, idx) => (
                  <tr key={idx} className="bg-white/2">
                    <td className="py-4 px-4 text-xs font-medium text-slate-500">第{round.roundNumber}局</td>
                    {room.members.map(m => (
                      <td key={m.userId} className={`py-4 px-2 text-center text-sm font-bold ${round.scores[m.userId] > 0 ? 'text-primary' : round.scores[m.userId] < 0 ? 'text-red-500' : ''}`}>
                        {round.scores[m.userId] !== undefined && round.scores[m.userId] !== null ? (round.scores[m.userId] > 0 ? `+${round.scores[m.userId]}` : round.scores[m.userId]) : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-primary/5 border-l-4 border-l-primary">
                  <td className="py-4 px-4 text-xs font-bold text-primary italic">第{room.rounds.length + 1}局</td>
                  {room.members.map(m => (
                    <td key={m.userId} className="py-4 px-2 text-center">
                      <div className="h-8 w-16 mx-auto rounded bg-white/5 border border-white/10 animate-pulse flex items-center justify-center text-[8px] text-slate-500">
                        {winnerId === m.userId ? '获胜' : '计分中'}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <section className="px-6 mt-0 pb-64">
          </section>
        </main>

        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="bg-black text-white p-4 ios-blur border-t border-white/10">
            <div className="flex items-center">
              <div className="w-16 text-[9px] font-black tracking-tighter opacity-40 leading-tight border-r border-white/10 mr-4 py-1 uppercase">
                实时汇总<br/>TOTAL
              </div>
              <div className="flex flex-grow justify-around items-end">
                {room.members.map(m => (
                  <div key={m.userId} className="flex flex-col items-center">
                    <div className="relative">
                      <span className={`text-[8px] mb-1 ${m.userId === user.id ? 'text-primary font-bold' : 'opacity-40'}`}>{m.username.slice(0, 3)}</span>
                      {m.isHost && <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[6px] font-bold px-0.5 rounded">BOSS</span>}
                    </div>
                    <span className={`text-lg font-bold ${m.userId === user.id ? 'text-primary' : 'opacity-80'}`}>{m.totalScore}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-background-dark p-6 pt-4 border-t border-primary/10">
            <div className="flex gap-4">
              {(() => {
                const currentUser = room.members.find(m => m.userId === user.id);
                const isHost = currentUser?.isHost || false;
                
                // 检查所有玩家是否都已提交分数（当前轮次）
                const lastRound = room.rounds[room.rounds.length - 1];
                const allSubmitted = lastRound && room.members.every(m => 
                  lastRound.scores.hasOwnProperty(m.userId) && lastRound.scores[m.userId] !== null && lastRound.scores[m.userId] !== undefined
                );
                
                // 检查所有玩家是否都未提交分数（当前轮次）
                const allNotSubmitted = !lastRound || room.members.every(m => 
                  !lastRound.scores?.hasOwnProperty(m.userId) || lastRound.scores[m.userId] === null || lastRound.scores[m.userId] === undefined
                );
                
                // 房主可以在：所有玩家都提交 或 所有玩家都未提交 时结算
                const canFinish = isHost && (allSubmitted || allNotSubmitted);
                const canUndo = isHost && room.rounds.length > 0;
                
                return (
                  <>
                    <button 
                      onClick={() => setShowConfirmFinish(true)}
                      disabled={!canFinish}
                      className={`flex-1 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 ${
                        canFinish
                          ? 'bg-primary text-black active:scale-95 shadow-[0_8px_16px_rgba(18,226,88,0.15)]'
                          : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                      }`}
                      title={!isHost ? '只有房主可以结算' : !allSubmitted ? '等待所有玩家提交分数' : ''}
                    >
                      <span className="material-symbols-outlined text-[24px]">check_circle</span>
                      结束并结算整场
                    </button>

                    <button
                      onClick={() => setShowConfirmUndo(true)}
                      disabled={!canUndo}
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all ${
                        canUndo
                          ? 'bg-white/5 text-slate-300 border-white/10 hover:text-primary hover:border-primary/30'
                          : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                      }`}
                      title={!isHost ? '只有房主可以撤回' : room.rounds.length === 0 ? '暂无可撤回对局' : '撤回上一局'}
                    >
                      <span className="material-symbols-outlined text-[24px]">undo</span>
                    </button>
                  </>
                );
              })()}
              <button className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 border border-white/10 hover:text-primary hover:border-primary/30 transition-all" onClick={() => setShowRoundHistory(true)}>
                <span className="material-symbols-outlined text-[28px]">history</span>
              </button>
            </div>
          </div>
        </div>

        {showConfirmFinish && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirmFinish(false)}></div>
            <div className="relative w-full bg-[#1c1c1e]/95 ios-blur rounded-[20px] overflow-hidden flex flex-col shadow-2xl border border-white/10">
              <div className="p-8 text-center">
                <h2 className="text-[17px] font-semibold text-white mb-2">结束结算确认</h2>
                <p className="text-[13px] text-white/70 leading-relaxed px-4">
                  确定要结束本场牌局吗？结算后所有分数将被锁定，不可再进行修改，并生成最终战绩清单。
                </p>
              </div>
              <div className="flex border-t border-white/10">
                <button 
                  onClick={() => setShowConfirmFinish(false)}
                  className="flex-1 py-4 text-[17px] font-normal text-blue-500 border-r border-white/10 active:bg-white/5"
                >
                  取消
                </button>
                <button 
                  onClick={handleFinishGame}
                  className="flex-1 py-4 text-[17px] font-semibold text-primary active:bg-white/5"
                >
                  确认结算
                </button>
              </div>
            </div>
          </div>
        )}

        {showConfirmUndo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirmUndo(false)}></div>
            <div className="relative w-full bg-[#1c1c1e]/95 ios-blur rounded-[20px] overflow-hidden flex flex-col shadow-2xl border border-white/10">
              <div className="p-8 text-center">
                <h2 className="text-[17px] font-semibold text-white mb-2">撤回上一局确认</h2>
                <p className="text-[13px] text-white/70 leading-relaxed px-4">
                  确定要撤回上一局分数吗？撤回后将恢复到上一局开始前的总分状态。
                </p>
              </div>
              <div className="flex border-t border-white/10">
                <button
                  onClick={() => setShowConfirmUndo(false)}
                  className="flex-1 py-4 text-[17px] font-normal text-blue-500 border-r border-white/10 active:bg-white/5"
                >
                  取消
                </button>
                <button
                  onClick={handleUndoLastRound}
                  className="flex-1 py-4 text-[17px] font-semibold text-red-400 active:bg-white/5"
                >
                  确认撤回
                </button>
              </div>
            </div>
          </div>
        )}

        {showRoundHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRoundHistory(false)}></div>
            <div className="relative w-full max-h-[80vh] bg-[#1c1c1e]/95 ios-blur rounded-[20px] overflow-hidden flex flex-col shadow-2xl border border-white/10">
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-[17px] font-semibold text-white">对局详情</h2>
                  <p className="text-xs text-slate-400 mt-1">房间号: {room.roomCode} • 共 {room.rounds.length} 局</p>
                </div>
                <button onClick={() => setShowRoundHistory(false)} className="text-slate-400 hover:text-white">
                  <span className="material-icons">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {room.rounds.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">暂无对局记录</p>
                ) : (
                  <div className="space-y-3">
                    {room.rounds.map((round) => {
                      // 找出本局获胜者
                      const winnerEntry = Object.entries(round.scores).find(([userId, score]) => (score as number) > 0);
                      const winnerId = winnerEntry ? winnerEntry[0] : round.winnerId;
                      const winnerMember = room.members.find(m => m.userId === winnerId);
                      
                      return (
                        <div key={round.roundNumber} className="bg-white/5 p-4 rounded-lg border border-white/10">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-bold text-primary">第 {round.roundNumber} 局</p>
                            {winnerMember && (
                              <div className="flex items-center gap-1 text-xs">
                                <span className="material-icons text-yellow-500" style={{fontSize: '14px'}}>emoji_events</span>
                                <span className="text-yellow-500 font-bold">{winnerMember.username}</span>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {room.members.map(m => {
                              const score = round.scores[m.userId] ?? 0;
                              const isWinner = m.userId === winnerId;
                              return (
                                <div key={m.userId} className={`flex justify-between items-center p-2 rounded ${isWinner ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-transparent'}`}>
                                  <div className="flex items-center gap-1">
                                    {isWinner && <span className="material-icons text-yellow-500" style={{fontSize: '12px'}}>star</span>}
                                    <span className={isWinner ? 'text-yellow-500 font-bold' : 'text-slate-300'}>{m.username.slice(0, 6)}</span>
                                  </div>
                                  <span className={`font-bold ${score > 0 ? 'text-primary' : score < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                    {score > 0 ? '+' : ''}{score}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {isHistoryView && (
                <div className="p-4 border-t border-white/10">
                  <button 
                    onClick={() => {
                      setShowRoundHistory(false);
                      navigate('/game-history');
                    }}
                    className="w-full bg-primary/10 text-primary font-bold py-3 rounded-xl hover:bg-primary/20 transition-all"
                  >
                    返回历史列表
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Final Settlement Screen
  if (room.status === RoomStatus.FINISHED) {
    const sortedMembers = [...room.members].sort((a, b) => b.totalScore - a.totalScore);
    const winner = sortedMembers[0];

    return (
      <div className="flex-1 flex flex-col bg-background-dark">
        <header className="px-6 py-12 flex flex-col items-center text-center">
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-2 border border-primary/20">房间号: {room.roomCode}</span>
          <h1 className="text-3xl font-extrabold tracking-tight">牌局结算清单</h1>
          <p className="text-slate-500 text-sm mt-1">共 {room.rounds.length} 局 • 最终统计</p>
        </header>

        <main className="flex-1 overflow-y-auto px-6 pb-40">
          <div className="relative mt-12 mb-16">
            <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-full opacity-50 animate-pulse"></div>
            <div className="relative bg-slate-900/40 border-2 border-primary/50 rounded-2xl p-6 text-center backdrop-blur-md">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                <div className="relative">
                  <img src={winner.avatar} className="w-24 h-24 rounded-full border-4 border-primary object-cover shadow-2xl" alt="winner" />
                  <div className="absolute -bottom-1 -right-1 bg-primary text-background-dark p-1.5 rounded-full border-2 border-background-dark">
                    <span className="material-icons text-md block">emoji_events</span>
                  </div>
                </div>
              </div>
              <div className="mt-14">
                <span className="bg-primary text-background-dark px-4 py-0.5 rounded-full text-[12px] font-black uppercase tracking-widest">大赢家</span>
                <h2 className="text-2xl font-bold mt-2">{winner.username}</h2>
                <div className="flex flex-col items-center mt-3">
                  <span className="text-5xl font-black text-primary">+{winner.totalScore}</span>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">最终总分</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end mb-4 px-1">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">总排名榜</h3>
            <div className="flex gap-12 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <span>玩家</span>
              <span>得分</span>
            </div>
          </div>

          <div className="space-y-3">
            {sortedMembers.map((m, idx) => (
              <div key={m.userId} className={`flex items-center bg-white/5 p-4 rounded-xl border border-white/5 ${idx === 0 ? 'border-primary/30' : ''}`}>
                <div className={`w-6 h-6 flex items-center justify-center font-black text-sm ${idx === 0 ? 'text-primary' : 'text-slate-500'}`}>{idx + 1}</div>
                <img src={m.avatar} className="w-10 h-10 rounded-lg object-cover ml-3" alt="avatar" />
                <div className="ml-4 flex-1">
                  <p className="font-bold text-md">{m.username}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-lg ${m.totalScore > 0 ? 'text-primary' : m.totalScore < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    {m.totalScore > 0 ? `+${m.totalScore}` : m.totalScore}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </main>

        <footer className="fixed bottom-0 left-0 right-0 px-6 py-10 bg-gradient-to-t from-background-dark via-background-dark to-transparent">
          <div className="space-y-3">
            <button className="w-full bg-primary text-black font-black py-4 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all">
              <span className="material-icons">ios_share</span>
              生成战绩海报
            </button>
            <button onClick={() => navigate('/')} className="w-full bg-slate-800/50 text-slate-300 font-bold py-4 rounded-xl border border-white/5 flex items-center justify-center gap-2 active:scale-95 transition-all">
              <span className="material-icons">home</span>
              返回首页
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return null;
};

export default RoomView;
