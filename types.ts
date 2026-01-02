
export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
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
  timestamp: number;
  location: { lat: number; lng: number } | null;
  message: string;
  recipients: string[];
}
