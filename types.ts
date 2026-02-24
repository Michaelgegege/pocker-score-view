
export enum RoomStatus {
  WAITING = 'waiting',
  PLAYING = 'playing',
  FINISHED = 'finished'
}

export interface User {
  id: string;
  username: string;
  mobile: string;
  avatar: string;
}

export interface Player {
  userId: string;
  username: string;
  avatar: string;
  totalScore: number;
  isHost: boolean;
  isReady: boolean;
}

export interface Round {
  roundNumber: number;
  scores: Record<string, number>; // userId -> score
  winnerId: string;
  scoreCalculated?: boolean; // 分数是否已计算（所有玩家都提交）
}

export interface Room {
  id: string;
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  members: Player[];
  rounds: Round[];
  started?: boolean;
  currentRound?: number;
  createdAt: number;
}
