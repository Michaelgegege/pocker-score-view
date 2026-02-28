import { User, Room, RoomStatus, Player, Round } from '../types';
import { ENV_CONFIG } from '../config/env';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

// 后端 API 基础 URL（根据实际情况调整）
let API_BASE_URL = ENV_CONFIG.API_BASE_URL; // 使用 let 以支持动态修改

interface ApiResponse<T> {
  code: number;
  message: string;
  data?: T;
  [key: string]: any;
}

const getStatusFallbackMessage = (status: number, fallback: string): string => {
  switch (status) {
    case 401:
      return '登录状态已过期，请重新登录';
    case 403:
      return '暂无权限执行该操作';
    case 404:
      return '请求的资源不存在';
    case 408:
      return '请求超时，请稍后重试';
    case 429:
      return '请求过于频繁，请稍后再试';
    case 500:
      return '服务暂时异常，请稍后重试';
    case 502:
    case 503:
    case 504:
      return '服务暂时不可用，请稍后重试';
    default:
      return fallback;
  }
};

const isHtmlLike = (text: string): boolean => {
  const normalized = text.trim().toLowerCase();
  return (
    normalized.startsWith('<!doctype html') ||
    normalized.startsWith('<html') ||
    /<\s*html[\s>]/i.test(normalized) ||
    /<\s*body[\s>]/i.test(normalized)
  );
};

const normalizeErrorText = (text: string, fallback: string, status?: number): string => {
  const raw = (text || '').trim();
  if (!raw) {
    return typeof status === 'number' ? getStatusFallbackMessage(status, fallback) : fallback;
  }

  const lowerRaw = raw.toLowerCase();
  if (
    isHtmlLike(raw) ||
    lowerRaw.includes('bad gateway') ||
    lowerRaw.includes('nginx/') ||
    lowerRaw.includes('<center>')
  ) {
    return typeof status === 'number' ? getStatusFallbackMessage(status, fallback) : fallback;
  }

  const plainText = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plainText) {
    return typeof status === 'number' ? getStatusFallbackMessage(status, fallback) : fallback;
  }

  if (plainText.length > 120) {
    return typeof status === 'number' ? getStatusFallbackMessage(status, fallback) : fallback;
  }

  return plainText;
};

const getBackendErrorMessage = (payload: any, fallback: string): string => {
  if (payload?.message) return normalizeErrorText(String(payload.message), fallback);
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    return normalizeErrorText(String(payload.errors[0]?.msg || ''), fallback);
  }
  return fallback;
};

const getErrorMessageFromResponse = async (response: Response, fallback: string): Promise<string> => {
  const fallbackByStatus = getStatusFallbackMessage(response.status, fallback);
  try {
    const text = await response.text();
    if (!text) return fallbackByStatus;
    try {
      const parsed = JSON.parse(text);
      return getBackendErrorMessage(parsed, fallbackByStatus);
    } catch {
      return normalizeErrorText(text, fallbackByStatus, response.status);
    }
  } catch {
    return fallbackByStatus;
  }
};

const mapUser = (raw: any): User => ({
  id: raw?.id || raw?._id || '',
  username: raw?.nickname || raw?.username || '',
  mobile: raw?.phone || raw?.mobile || '',
  avatar: raw?.avatar || ''
});

const mapRoomStatus = (rawStatus: string | undefined, currentRound?: number, started?: boolean): RoomStatus => {
  if (rawStatus === 'closed') return RoomStatus.FINISHED;
  if (started) return RoomStatus.PLAYING;
  if ((currentRound ?? 0) > 0) return RoomStatus.PLAYING;
  return RoomStatus.WAITING;
};

const mapRounds = (rawRounds: any[]): Round[] => (rawRounds || []).map((r: any) => {
  const scores: Record<string, number> = {};
  (r?.scores || []).forEach((s: any) => {
    const userId = s?.user?.id || s?.user_id?._id || '';
    if (userId) scores[userId] = s?.score ?? 0;
  });

  return {
    roundNumber: r?.round || r?.roundNumber || 0,
    scores,
    winnerId: r?.winner?.id || r?.winner_id || ''
  };
});

const mapRoom = (raw: any, rounds: Round[] = []): Room => {
  const hostId = raw?.creator?.id || raw?.creator_id || raw?.hostId || '';
  return {
  id: raw?.room_code || raw?.roomCode || raw?.id || '',
  roomCode: raw?.room_code || raw?.roomCode || raw?.id || '',
  hostId,
  status: mapRoomStatus(raw?.status, raw?.current_round, raw?.is_started),
  members: (raw?.members || []).map((m: any) => ({
    userId: m?.id || m?.user_id?._id || m?.userId || '',
    username: m?.nickname || m?.user_name || m?.username || '',
    avatar: m?.avatar || '',
    totalScore: m?.total_score ?? m?.totalScore ?? 0,
    isHost: m?.isHost ?? ((m?.id || m?.user_id?._id || m?.userId || '') === hostId),
    isReady: m?.isReady ?? false
  })),
  rounds,
  started: raw?.is_started ?? false,
  currentRound: raw?.current_round ?? 0,
  createdAt: raw?.create_time || raw?.createdAt || Date.now()
  };
};

const isNativeCapacitorRuntime = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const buildNativeHttpData = (body: BodyInit | null | undefined): any => {
  if (body == null) return undefined;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body as any;
};

const createResponseLike = (nativeResponse: any): Response => {
  const textPayload = typeof nativeResponse?.data === 'string'
    ? nativeResponse.data
    : JSON.stringify(nativeResponse?.data ?? {});

  return {
    ok: nativeResponse.status >= 200 && nativeResponse.status < 300,
    status: nativeResponse.status,
    statusText: '',
    headers: new Headers(nativeResponse.headers || {}),
    url: nativeResponse.url || '',
    redirected: false,
    type: 'basic',
    body: null,
    bodyUsed: false,
    clone() {
      return createResponseLike(nativeResponse);
    },
    async arrayBuffer() {
      return new TextEncoder().encode(textPayload).buffer;
    },
    async blob() {
      return new Blob([textPayload]);
    },
    async formData() {
      return new FormData();
    },
    async json() {
      if (typeof nativeResponse?.data === 'string') {
        return JSON.parse(nativeResponse.data || '{}');
      }
      return nativeResponse?.data;
    },
    async text() {
      return textPayload;
    },
  } as Response;
};

// 智能 fetch 包装器 - 自动处理 CORS 问题
const smartFetch = async (url: string, options: RequestInit = {}) => {
  try {
    if (isNativeCapacitorRuntime()) {
      const nativeResponse = await CapacitorHttp.request({
        url,
        method: (options.method || 'GET').toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers as Record<string, string> | undefined),
        },
        data: buildNativeHttpData(options.body),
        connectTimeout: ENV_CONFIG.API_TIMEOUT,
        readTimeout: ENV_CONFIG.API_TIMEOUT,
      });

      return createResponseLike(nativeResponse);
    }

    // 首先尝试标准请求
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    return response;
  } catch (error: any) {
    // 如果是 CORS 错误或网络错误，打印诊断信息
    if (error.message?.includes('CORS') || error.message?.includes('blocked')) {
      console.warn('🔧 CORS 错误检测，请确保后端配置正确：');
      console.warn('后端应该配置 CORS 如下：');
      console.warn(`
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: false  // 或根据需要设为 true
}));
      `);
    }
    throw error;
  }
};

// 错误处理辅助函数
const handleApiError = (error: any) => {
  const networkFallback = '网络异常，请检查网络后重试';
  const defaultFallback = '请求失败，请稍后重试';

  if (
    error?.message?.includes?.('Failed to fetch') ||
    error?.message?.includes?.('NetworkError') ||
    error?.name === 'TypeError'
  ) {
    throw new Error(networkFallback);
  }

  if (error.response?.data?.message) {
    throw new Error(normalizeErrorText(String(error.response.data.message), defaultFallback));
  }

  const normalized = normalizeErrorText(String(error?.message || ''), defaultFallback);
  throw new Error(normalized || defaultFallback);
};

export const apiClient = {
  // ============== 认证相关 ==============
  
  async register(mobile: string, password: string, username?: string): Promise<User> {
    try {
      const response = await smartFetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({
          phone: mobile,        // 后端期望 phone，前端用 mobile 表示
          password,
          nickname: username,   // 后端期望 nickname，前端用 username 表示
        }),
      });

      if (!response.ok) {
        const message = await getErrorMessageFromResponse(response, '注册失败');
        throw new Error(message);
      }

      const result = await response.json() as ApiResponse<any>;
      if (result.data?.token) {
        localStorage.setItem('poker_token', result.data.token);
      }
      if (result.data?.user) {
        const user = mapUser(result.data.user);
        localStorage.setItem('poker_user', JSON.stringify(user));
        return user;
      }
      throw new Error('注册失败：无效的响应');
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  async login(mobile: string, password: string): Promise<User> {
    try {
      const response = await smartFetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ 
          phone: mobile,  // 后端期望 phone
          password 
        }),
      });

      if (!response.ok) {
        const message = await getErrorMessageFromResponse(response, '登录失败');
        throw new Error(message);
      }

      const result = await response.json() as ApiResponse<any>;
      if (result.data?.token) {
        localStorage.setItem('poker_token', result.data.token);
      }
      if (result.data?.user) {
        const user = mapUser(result.data.user);
        localStorage.setItem('poker_user', JSON.stringify(user));
        return user;
      }
      throw new Error('登录失败：无效的响应');
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const userStr = localStorage.getItem('poker_user');
      if (!userStr) return null;

      const response = await smartFetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('poker_token')}`,
        },
      });

      if (!response.ok) {
        // 如果服务器返回 401，清除本地缓存
        if (response.status === 401) {
          localStorage.removeItem('poker_user');
          localStorage.removeItem('poker_token');
        }
        return null;
      }

      const result = await response.json() as ApiResponse<any>;
      return result.data ? mapUser(result.data) : null;
    } catch (error) {
      // 如果网络错误，返回本地缓存的用户信息
      const userStr = localStorage.getItem('poker_user');
      return userStr ? JSON.parse(userStr) : null;
    }
  },

  // ============== 房间相关 ==============

  async createRoom(host: User): Promise<Room> {
    try {
      const response = await smartFetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('poker_token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '创建房间失败');
      }

      const result = await response.json() as ApiResponse<any>;
      if (result.data) return mapRoom(result.data);
      throw new Error('创建房间失败：无效的响应');
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  async startRoom(roomId: string): Promise<Room> {
    try {
      const response = await smartFetch(`${API_BASE_URL}/rooms/${roomId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('poker_token')}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '开始本局失败');
      }

      const result = await response.json() as ApiResponse<any>;
      if (result.data) return mapRoom(result.data);
      throw new Error('开始本局失败：无效的响应');
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  async joinRoom(user: User, roomCode: string): Promise<Room> {
    try {
      const response = await smartFetch(`${API_BASE_URL}/rooms/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('poker_token')}`,
        },
        body: JSON.stringify({
          room_code: roomCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '加入房间失败');
      }

      const result = await response.json() as ApiResponse<any>;
      if (result.data) return mapRoom(result.data);
      throw new Error('加入房间失败：无效的响应');
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  async getRoom(roomId: string): Promise<Room | null> {
    try {
      const response = await smartFetch(`${API_BASE_URL}/rooms/${roomId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('poker_token')}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('获取房间失败');
      }

      const result = await response.json() as ApiResponse<any>;

      if (!result.data) return null;

      // 拉取历史回合（对齐后端 /games 路由）
      let rounds: Round[] = [];
      try {
        const roundsRes = await smartFetch(`${API_BASE_URL}/games/${roomId}/rounds`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('poker_token')}`,
          },
        });
        if (roundsRes.ok) {
          const roundsJson = await roundsRes.json();
          rounds = mapRounds(roundsJson?.data?.rounds || []);
        }
      } catch {
        // 忽略回合历史失败，保证房间信息可用
      }

      return mapRoom(result.data, rounds);
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  async leaveRoom(roomId: string, _userId: string): Promise<void> {
    try {
      // 后端暂未提供退出房间接口，保持前端流程不报错
      console.warn('后端未提供退出房间接口，已在前端忽略该请求');
      return;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  // ============== 对局相关 ==============

  async submitRound(roomId: string, winnerId: string, negativeScores: Record<string, number>): Promise<Room> {
    try {
      const currentUserId = JSON.parse(localStorage.getItem('poker_user') || '{}')?.id;
      const myScore = currentUserId ? negativeScores[currentUserId] : undefined;

      if (typeof myScore !== 'number') {
        throw new Error('请先填写自己的分数');
      }

      const response = await smartFetch(`${API_BASE_URL}/games/${roomId}/round`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('poker_token')}`,
        },
        body: JSON.stringify({
          score: myScore,
          // 后端字段为 winner_id，胜利者提交时带上
          winner_id: winnerId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '提交分数失败');
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '提交分数失败');
      }

      // 提交成功后刷新房间信息
      const updatedRoom = await this.getRoom(roomId);
      if (updatedRoom) return updatedRoom;
      throw new Error('提交分数成功但获取房间信息失败');
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  async finishGame(roomId: string): Promise<Room> {
    try {
      const response = await smartFetch(`${API_BASE_URL}/games/${roomId}/finish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('poker_token')}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '结束房间失败');
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '结束房间失败');
      }

      const updatedRoom = await this.getRoom(roomId);
      if (updatedRoom) return updatedRoom;
      throw new Error('结算成功但获取房间信息失败');
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  async undoLastRound(roomId: string): Promise<Room> {
    try {
      const response = await smartFetch(`${API_BASE_URL}/games/${roomId}/undo-last-round`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('poker_token')}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '撤回上一局失败');
      }

      const updatedRoom = await this.getRoom(roomId);
      if (updatedRoom) return updatedRoom;
      throw new Error('撤回成功但获取房间信息失败');
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  // ============== 工具方法 ==============

  setApiBaseUrl(url: string) {
    // 允许动态设置 API 基础 URL（用于不同环境）
    const protocol = url.startsWith('http') ? '' : 'http://';
    API_BASE_URL = protocol + url;
    ENV_CONFIG.API_BASE_URL = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;
    API_BASE_URL = ENV_CONFIG.API_BASE_URL;
    return API_BASE_URL;
  },

  getAuthToken(): string | null {
    return localStorage.getItem('poker_token');
  },

  clearAuth(): void {
    localStorage.removeItem('poker_token');
    localStorage.removeItem('poker_user');
  },

  async getUserStats(userId: string): Promise<{ 
    winRate: number; 
    totalProfit: number;
    gamesPlayed: number;
    wins: number;
  }> {
    try {
      // 从房间聚合数据计算统计，保持与 getRecentGames 一致
      const allGames = await this.getRecentGames(userId, 100);
      
      let totalProfit = 0;
      let wins = 0;
      
      if (allGames && Array.isArray(allGames)) {
        totalProfit = allGames.reduce((sum, game) => sum + (game.profit || 0), 0);
        wins = allGames.filter(game => game.userIsWinner).length;
      }
      
      const gamesPlayed = allGames?.length || 0;
      const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
      
      return {
        winRate,
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        gamesPlayed,
        wins,
      };
    } catch (error) {
      console.error('获取统计数据异常:', error);
      return { winRate: 0, totalProfit: 0, gamesPlayed: 0, wins: 0 };
    }
  },

  async getRecentGames(userId: string, limit: number = 10): Promise<Array<{ id: string; roomCode: string; date: string; profit: number; playerCount?: number; winner?: string; userIsWinner?: boolean }>> {
    try {
      const response = await smartFetch(`${API_BASE_URL}/users/${userId}/recent-games?limit=${limit * 3}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('poker_token')}`,
        },
      });

      if (!response.ok) {
        console.warn('获取最近对局失败，使用默认值');
        return [];
      }

      const result = await response.json() as ApiResponse<any>;
      const allGames = (result.data?.games ?? []).map((g: any) => {
        const createdAt = new Date(g.created_at || g.create_time || Date.now()).getTime();
        const formattedDateTime = new Date(createdAt).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        return {
          id: g.id || g._id,
          roomCode: g.room_code || g.roomCode || 'N/A',
          date: formattedDateTime,
          createdAt,
          profit: g.profit || 0,
          playerCount: g.player_count || g.playerCount,
          winner: g.winner || g.winner_name,
          userIsWinner: g.is_winner || g.isWinner || g.profit > 0,
        };
      });

      // 按房间聚合数据
      const roomMap: { [key: string]: { totalProfit: number; lastDate: string; lastTimestamp: number; playerCount?: number; winner?: string } } = {};

      allGames.forEach(game => {
        if (!roomMap[game.roomCode]) {
          roomMap[game.roomCode] = {
            totalProfit: 0,
            lastDate: game.date,
            lastTimestamp: game.createdAt,
            playerCount: game.playerCount,
            winner: game.winner,
          };
        }

        roomMap[game.roomCode].totalProfit += game.profit;

        // 保留最新时间
        if (game.createdAt > roomMap[game.roomCode].lastTimestamp) {
          roomMap[game.roomCode].lastTimestamp = game.createdAt;
          roomMap[game.roomCode].lastDate = game.date;
          roomMap[game.roomCode].playerCount = game.playerCount;
          roomMap[game.roomCode].winner = game.winner;
        }
      });

      // 转换为数组并按时间倒序排序
      const aggregatedGames = Object.entries(roomMap)
        .map(([roomCode, data]) => ({
          id: `room_${roomCode}`,
          roomCode,
          date: data.lastDate,
          profit: parseFloat(data.totalProfit.toFixed(2)),
          playerCount: data.playerCount,
          winner: data.winner,
          userIsWinner: data.totalProfit > 0,
          timestamp: data.lastTimestamp,
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
      
      return aggregatedGames;
    } catch (error) {
      console.error('获取最近对局异常:', error);
      return [];
    }
  },
};

export default apiClient;
