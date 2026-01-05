
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface GuardianCoords {
  lat: number;
  lng: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  text: string;
  timestamp: number;
  type?: 'text' | 'location';
  lat?: number;
  lng?: number;
}

export interface EmergencyContact {
  id: string;
  name: string;
  email: string;
  isRegisteredUser: boolean;
}

export interface AppSettings {
  triggerPhrase: string;
  checkInDuration: number; // minutes
  contacts: EmergencyContact[];
  isListening: boolean;
}

export interface SafeSpot {
  name: string;
  uri: string;
  distance?: string;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  MESSENGER = 'MESSENGER',
  SETTINGS = 'SETTINGS'
}

export interface AlertLog {
  id: string;
  senderEmail: string;
  senderName: string;
  timestamp: number;
  location: GuardianCoords | null;
  message: string;
  isLive: boolean;
  recipients: string[];
  updates?: Record<string, ChatMessage>;
}
