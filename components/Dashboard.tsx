
import React, { useState, useEffect, useRef } from 'react';
import { Power, Mic, MicOff, MapPin, AlertTriangle, ShieldCheck, Users, Info, AlertCircle } from 'lucide-react';
import { AppSettings, AlertLog } from '../types';
import { GeminiVoiceMonitor } from '../services/geminiService';

interface DashboardProps {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  onAlertTriggered: (log: AlertLog) => void;
  isEmergency: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ settings, updateSettings, onAlertTriggered, isEmergency }) => {
  const [lastLocation, setLastLocation] = useState<{lat: number, lng: number} | null>(null);
  const monitorRef = useRef<GeminiVoiceMonitor | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Trigger alert logic
  const triggerAlert = async () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLastLocation({ lat: latitude, lng: longitude });
        executeAlert(latitude, longitude);
      },
      (err) => {
        console.error("Location access denied", err);
        executeAlert(null, null);
      }
    );
  };

  const executeAlert = (lat: number | null, lng: number | null) => {
    const locationStr = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : 'Unavailable';
    const message = settings.messageTemplate.replace('{location}', locationStr);
    
    const newLog: AlertLog = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      location: lat && lng ? { lat, lng } : null,
      message,
      recipients: settings.contacts.map(c => `${c.name} (${c.phone})`)
    };

    onAlertTriggered(newLog);

    // Simulate sending messages
    console.log(`Sending Emergency Alert to ${settings.contacts.length} contacts:`, message);
    
    // Web Share simulation if mobile
    if (navigator.share) {
       navigator.share({
         title: 'EMERGENCY ALERT',
         text: message,
       }).catch(() => {});
    }
  };

  const toggleListening = async () => {
    if (settings.isListening) {
      if (monitorRef.current) {
        await monitorRef.current.stop();
        monitorRef.current = null;
      }
      updateSettings({ isListening: false });
    } else {
      setError(null);
      
      const monitor = new GeminiVoiceMonitor({
        triggerPhrase: settings.triggerPhrase,
        onAlert: (phrase) => {
          console.log(`Alert triggered by phrase: ${phrase}`);
          triggerAlert();
        },
        onError: (err) => {
          setError(err);
          updateSettings({ isListening: false });
        }
      });

      await monitor.start();
      monitorRef.current = monitor;
      updateSettings({ isListening: true });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (monitorRef.current) {
        monitorRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Activation Status Card */}
      <div className={`p-8 rounded-3xl flex flex-col items-center justify-center transition-all duration-500 border-2 ${
        settings.isListening 
          ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_50px_-12px_rgba(59,130,246,0.5)]' 
          : 'bg-slate-800/50 border-slate-700/50'
      }`}>
        <button 
          onClick={toggleListening}
          className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-transform active:scale-95 group ${
            settings.isListening ? 'bg-blue-600 shadow-lg shadow-blue-500/40' : 'bg-slate-700'
          }`}
        >
          {settings.isListening ? (
            <div className="absolute inset-0 rounded-full animate-ping bg-blue-400/30" />
          ) : null}
          <Power size={40} className={settings.isListening ? 'text-white' : 'text-slate-400'} />
        </button>
        
        <div className="mt-6 text-center">
          <h2 className="text-2xl font-bold">{settings.isListening ? 'Monitor Active' : 'Monitor Inactive'}</h2>
          <p className="text-slate-400 text-sm mt-1">
            {settings.isListening 
              ? `Listening for: "${settings.triggerPhrase}"` 
              : 'Tap button to start protection'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-500 text-sm flex items-start gap-3">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Stats / Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Users size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Contacts</span>
          </div>
          <div className="text-xl font-bold">{settings.contacts.length} Saved</div>
        </div>
        <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <ShieldCheck size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Status</span>
          </div>
          <div className={`text-xl font-bold ${settings.isListening ? 'text-blue-400' : 'text-slate-500'}`}>
            {settings.isListening ? 'Secured' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Safety Tips Card */}
      {!isEmergency && (
        <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden">
          <div className="flex gap-4 items-start relative z-10">
            <div className="bg-blue-600/20 p-2 rounded-lg text-blue-400">
              <Info size={20} />
            </div>
            <div>
              <h4 className="font-semibold text-sm">How it works</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                When active, GuardianVoice uses advanced AI to detect your custom trigger phrase. If detected, it immediately broadcasts your GPS location and emergency message to your contacts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Alert Visual for Emergency */}
      {isEmergency && (
        <div className="bg-red-600 p-5 rounded-2xl flex items-center gap-4 animate-bounce">
          <AlertCircle size={32} className="text-white" />
          <div>
            <h4 className="font-bold text-lg text-white">Emergency Triggered!</h4>
            <p className="text-xs text-red-100">Location and messages dispatched.</p>
          </div>
        </div>
      )}
      
      {/* Test Trigger Button */}
      <button 
        onClick={triggerAlert}
        className="w-full py-4 border-2 border-dashed border-slate-700 rounded-2xl text-slate-500 text-sm font-medium hover:border-slate-500 hover:text-slate-400 transition-colors flex items-center justify-center gap-2"
      >
        <MapPin size={16} />
        Send manual emergency test
      </button>
    </div>
  );
};

export default Dashboard;
