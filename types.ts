
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

export interface AppSettings {
  triggerPhrase: string;
  messageTemplate: string;
  contacts: EmergencyContact[];
  isListening: boolean;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  SETTINGS = 'SETTINGS',
  GUARDIAN_LINK = 'GUARDIAN_LINK' // Renamed from ALERT_HISTORY
}

export interface AlertLog {
  id: string;
  senderPhone: string;
  senderName: string;
  timestamp: number;
  location: { lat: number; lng: number } | null;
  message: string;
  isLive: boolean;
  recipients: string[]; // List of registered guardian phone numbers
}
