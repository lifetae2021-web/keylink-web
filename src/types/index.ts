// Types for Keylink application

export type Gender = 'male' | 'female';
export type EventStatus = 'upcoming' | 'open' | 'closed' | 'completed';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
export type MatchStatus = 'pending' | 'matched' | 'unmatched';
export type Region = 'busan' | 'changwon';

export interface UserProfile {
  uid: string;
  name: string;
  gender: Gender;
  birthYear: number;
  age: number;
  job: string;
  phone: string;
  kakaoId?: string;
  photoUrl?: string;
  isAdmin: boolean;
  createdAt: Date;
}

export interface KeylinkEvent {
  id: string;
  title: string;
  region: Region;
  venue: string;
  venueAddress: string;
  date: Date;
  time: string;
  maxMale: number;
  maxFemale: number;
  currentMale: number;
  currentFemale: number;
  price: number;
  status: EventStatus;
  description: string;
  thumbnail?: string;
  rankingOpen: boolean;
  matchingOpen: boolean;
  episode: number; // 몇 기
  createdAt: Date;
}

export interface Booking {
  id: string;
  userId: string;
  eventId: string;
  userName: string;
  userGender: Gender;
  status: BookingStatus;
  price: number;
  participantNumber?: number; // 행사 참여 번호 (매칭에서 사용)
  createdAt: Date;
}

export interface Ranking {
  id: string;
  userId: string;
  eventId: string;
  rank1: string; // participantNumber
  rank2: string;
  rank3: string;
  submittedAt: Date;
}

export interface Match {
  id: string;
  eventId: string;
  user1Id: string;
  user2Id: string;
  user1Name: string;
  user2Name: string;
  user1Phone?: string;
  user2Phone?: string;
  user1KakaoId?: string;
  user2KakaoId?: string;
  openChatUrl?: string;
  status: MatchStatus;
  createdAt: Date;
}
