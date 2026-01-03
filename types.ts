
export interface User {
  id: string;
  phone: string;
  name: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  isRegisteredUser: boolean; // Must be true to receive Guardian Link messages
}

export interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
  location?: { lat: number; lng: number }; // Optional: location attachment in chat
}

export interface AppSettings {
  triggerPhrase: string;
  messageTemplate: string;
  contacts: EmergencyContact[];
  isListening: boolean;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  SETTINGS = 'SETTINGS',
  GUARDIAN_LINK = 'GUARDIAN_LINK'
}

export interface AlertLog {
  id: string;
  senderPhone: string;
  senderName: string;
  timestamp: number;
  location: { lat: number; lng: number } | null;
  message: string;
  updates: ChatMessage[];
  isLive: boolean;
  recipients: string[]; // List of registered guardian phone numbers
}
