export interface User {
  id: string; // Firebase Auth uid
  telegramId: string;
  username: string;
  displayName: string;
  points: number;
  referralCode: string;
  referredBy?: string;
  referralCount: number;
  createdAt: string;
  updatedAt: string;
  isAdmin: boolean;
}

export interface Video {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: string;
  views: number;
  likes: number;
  isLocked: boolean;
  requiredPoints: number;
  category: string;
  externalUnlockLink: string; // The link that opens when bought/unlocked
  reLockDurationMinutes: number; // e.g. 10
  createdAt: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  category: 'info' | 'update' | 'warning' | 'promotion';
  isPinned: boolean;
  link?: string;
  isPopup: boolean;
  publishDate: string;
  expiryDate: string;
  createdAt: string;
}

export interface PointHistory {
  id: string;
  userId: string;
  type: 'earn_ad' | 'spend_unlock' | 'referral_bonus' | 'admin_adjust';
  points: number;
  description: string;
  createdAt: string;
}

export interface UnlockedVideo {
  id: string; // userId_videoId
  userId: string;
  videoId: string;
  unlockedAt: string;
  expiresAt: string;
}

export interface Referral {
  id: string;
  referrerId: string;
  referredId: string;
  pointsAwarded: number;
  createdAt: string;
}

export interface SystemSettings {
  joinBonus: number;
  referralReward: number;
  adWatchTimer: number; // in seconds
  adWatchReward: number; // points
}
