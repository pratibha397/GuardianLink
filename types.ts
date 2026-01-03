
export interface User {
  id: string;
  phone: string;
  name: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  isRegisteredUser: boolean;
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
  ALERT_HISTORY = 'ALERT_HISTORY'
}

export interface AlertLog {
  id: string;
  senderPhone: string;
  timestamp: number;
  location: { lat: number; lng: number } | null;
  message: string;
  isLive: boolean;
  recipients: string[];
}
