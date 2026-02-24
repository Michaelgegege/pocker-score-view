
import { User, Room, RoomStatus, Player, Round } from '../types';

const STORAGE_KEYS = {
  USER: 'poker_user',
  ROOMS: 'poker_rooms',
};

// Simulated latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockCloud = {
  async getCurrentUser(): Promise<User | null> {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  async login(mobile: string, password: string): Promise<User> {
    await delay(800);
    const user: User = {
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      username: '用户_' + mobile.slice(-4),
      mobile,
      avatar: `https://picsum.photos/seed/${mobile}/100/100`,
    };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return user;
  },

  async register(mobile: string, password: string, username?: string): Promise<User> {
    await delay(800);
    const user: User = {
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      username: username && username.trim().length > 0 ? username.trim() : '用户_' + mobile.slice(-4),
      mobile,
      avatar: `https://picsum.photos/seed/${mobile}/100/100`,
    };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return user;
  },

  async createRoom(host: User): Promise<Room> {
    await delay(1000);
    const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newRoom: Room = {
      id: 'room_' + Date.now(),
      roomCode,
      hostId: host.id,
      status: RoomStatus.WAITING,
      members: [{
        userId: host.id,
        username: host.username,
        avatar: host.avatar,
        totalScore: 0,
        isHost: true,
        isReady: true
      }],
      rounds: [],
      createdAt: Date.now()
    };
    
    const rooms = this._getAllRooms();
    rooms.push(newRoom);
    this._saveRooms(rooms);
    return newRoom;
  },

  async startRoom(roomId: string): Promise<Room> {
    const rooms = this._getRooms();
    const room = rooms.find(r => r.id === roomId);
    if (!room) {
      throw new Error('房间不存在');
    }
    const updated: Room = { ...room, status: RoomStatus.PLAYING, started: true } as Room;
    this._updateRoom(updated);
    return updated;
  },

  async joinRoom(user: User, roomCode: string): Promise<Room> {
    await delay(1000);
    const rooms = this._getAllRooms();
    const room = rooms.find(r => r.roomCode === roomCode);
    
    if (!room) throw new Error('房间号不存在');
    if (room.status === RoomStatus.FINISHED) throw new Error('该房间已结算');
    
    const isAlreadyIn = room.members.find(m => m.userId === user.id);
    if (!isAlreadyIn) {
      room.members.push({
        userId: user.id,
        username: user.username,
        avatar: user.avatar,
        totalScore: 0,
        isHost: false,
        isReady: true
      });
      this._updateRoom(room);
    }
    
    return room;
  },

  async submitRound(roomId: string, winnerId: string, negativeScores: Record<string, number>): Promise<Room> {
    await delay(500);
    const room = this._getRoom(roomId);
    if (!room) throw new Error('Room not found');

    // Get the current round (last round if exists, or create new one)
    let currentRound = room.rounds.length > 0 ? room.rounds[room.rounds.length - 1] : null;
    
    // If current round doesn't exist or is already complete, create a new one
    if (!currentRound || (currentRound as any).scoreCalculated) {
      currentRound = {
        roundNumber: room.rounds.length + 1,
        scores: {},
        winnerId: '',
        scoreCalculated: false
      };
      room.rounds.push(currentRound);
    }

    // Always set winnerId as soon as we get it
    if (!currentRound.winnerId) {
      currentRound.winnerId = winnerId;
    }

    // Add the submitted scores to the current round
    currentRound.scores = { ...currentRound.scores, ...negativeScores };

    // Get the list of all player IDs who have submitted scores so far
    const submittedPlayerIds = Object.keys(currentRound.scores);
    
    // Check if all players have submitted (including winner)
    const allPlayersSubmitted = room.members.every(m => submittedPlayerIds.includes(m.userId));

    console.log(`[submitRound] Round ${currentRound.roundNumber}: ${submittedPlayerIds.length}/${room.members.length} submitted, allSubmitted=${allPlayersSubmitted}`);

    // Only calculate when ALL players have submitted
    if (allPlayersSubmitted && !(currentRound as any).scoreCalculated) {
      // Sum of absolute values of all loser scores (everyone except winner)
      const totalNegative = room.members
        .filter(m => m.userId !== winnerId)
        .reduce((sum, m) => {
          const score = currentRound.scores[m.userId] || 0;
          return sum + Math.abs(score);
        }, 0);
      
      // Set winner's score to the sum of all loser losses
      currentRound.scores[winnerId] = totalNegative;

      // Update total scores for all players
      room.members = room.members.map(m => ({
        ...m,
        totalScore: m.totalScore + (currentRound.scores[m.userId] || 0)
      }));

      // Mark that scores have been calculated
      (currentRound as any).scoreCalculated = true;
      console.log(`[submitRound] Round ${currentRound.roundNumber} completed! scoreCalculated=${(currentRound as any).scoreCalculated}`);
    }

    this._updateRoom(room);
    return room;
  },

  async finishGame(roomId: string): Promise<Room> {
    await delay(800);
    const room = this._getRoom(roomId);
    if (!room) throw new Error('Room not found');
    room.status = RoomStatus.FINISHED;
    this._updateRoom(room);
    return room;
  },

  async undoLastRound(roomId: string): Promise<Room> {
    await delay(500);
    const room = this._getRoom(roomId);
    if (!room) throw new Error('Room not found');

    const lastRound = room.rounds[room.rounds.length - 1];
    if (!lastRound) {
      throw new Error('暂无可撤回的对局');
    }

    room.members = room.members.map(member => ({
      ...member,
      totalScore: member.totalScore - (lastRound.scores[member.userId] || 0)
    }));

    room.rounds = room.rounds.slice(0, -1);
    this._updateRoom(room);
    return room;
  },

  async getRoom(roomId: string): Promise<Room | null> {
    return this._getRoom(roomId);
  },

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const room = this._getRoom(roomId);
    if (!room) throw new Error('Room not found');
    room.members = room.members.filter(m => m.userId !== userId);
    this._updateRoom(room);
  },

  _getAllRooms(): Room[] {
    const data = localStorage.getItem(STORAGE_KEYS.ROOMS);
    return data ? JSON.parse(data) : [];
  },

  _getRoom(id: string): Room | null {
    return this._getAllRooms().find(r => r.id === id) || null;
  },

  _saveRooms(rooms: Room[]) {
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
  },

  _updateRoom(room: Room) {
    const rooms = this._getAllRooms();
    const idx = rooms.findIndex(r => r.id === room.id);
    if (idx !== -1) {
      rooms[idx] = room;
      this._saveRooms(rooms);
    }
  },

  async getUserStats(userId: string): Promise<{ winRate: number; totalProfit: number; gamesPlayed: number; wins: number }> {
    await delay(500);
    // 基于 getRecentGames 的实际数据动态计算统计
    const recentGames = await this.getRecentGames(userId, 100);
    
    let totalProfit = 0;
    let wins = 0;
    
    if (recentGames && Array.isArray(recentGames)) {
      totalProfit = recentGames.reduce((sum, game) => sum + (game.profit || 0), 0);
      wins = recentGames.filter(game => game.userIsWinner).length;
    }
    
    const gamesPlayed = recentGames?.length || 0;
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
    
    return {
      winRate,
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      gamesPlayed,
      wins,
    };
  },

  async getRecentGames(userId: string, limit: number = 10): Promise<Array<{ id: string; roomCode: string; date: string; profit: number; playerCount?: number; winner?: string; userIsWinner?: boolean }>> {
    await delay(500);
    // 模拟最近对局 - 房间维度统计
    const roomMap: { [key: string]: { totalProfit: number; gamesCount: number; lastDate: string; playerCount: number; winner: string } } = {};
    const now = new Date();
    const totalGames = 20; // 生成更多对局数据用于聚合
    const winners = ['张三', '李四', '王五', '赵六', '周七', '吴八', '郑九', '韩十'];
    const rooms = ['100001', '100002', '100003', '100004', '100005'];
    
    for (let i = 0; i < totalGames; i++) {
      const date = new Date(now.getTime() - i * 86400000);
      const profit = (Math.random() - 0.5) * 1000;
      const roomCode = rooms[Math.floor(Math.random() * rooms.length)];
      
      if (!roomMap[roomCode]) {
        roomMap[roomCode] = {
          totalProfit: 0,
          gamesCount: 0,
          lastDate: date.toLocaleDateString('zh-CN'),
          playerCount: 3 + Math.floor(Math.random() * 2),
          winner: winners[Math.floor(Math.random() * winners.length)],
        };
      }
      
      roomMap[roomCode].totalProfit += profit;
      roomMap[roomCode].gamesCount += 1;
      if (i === 0) roomMap[roomCode].lastDate = date.toLocaleDateString('zh-CN');
    }
    
    // 转换为数组格式，按日期倒序排序
    const result = Object.entries(roomMap)
      .map(([roomCode, data]) => ({
        id: `room_${roomCode}`,
        roomCode,
        date: data.lastDate,
        profit: parseFloat(data.totalProfit.toFixed(2)),
        playerCount: data.playerCount,
        winner: data.winner,
        userIsWinner: data.totalProfit > 0,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
    
    return result;
  },
};
