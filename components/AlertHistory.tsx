
import { Clock, ExternalLink, MapPin, Radio, ShieldAlert } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AlertLog } from '../types';

interface AlertHistoryProps {
  logs: AlertLog[];
  clearLogs: () => void;
}

const AlertHistory: React.FC<AlertHistoryProps> = ({ logs, clearLogs }) => {
  const [incomingAlerts, setIncomingAlerts] = useState<AlertLog[]>([]);

  // Simulation: Checking "Guardian Link Global Server" for alerts from other users
  useEffect(() => {
    const fetchGlobal = () => {
      const GLOBAL_KEY = 'guardian_voice_global_alerts';
      const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_KEY) || '[]');
      // For demo, we show everything except our own alerts
      setIncomingAlerts(all);
    };
    fetchGlobal();
    const interval = setInterval(fetchGlobal, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <Radio size={12} className="text-blue-500 animate-pulse" /> Live Guardian Feed
        </h3>
        {incomingAlerts.length > 0 && (
          <button onClick={() => { localStorage.setItem('guardian_voice_global_alerts', '[]'); setIncomingAlerts([]); }} className="text-[10px] text-red-400 hover:text-red-300 font-black uppercase tracking-widest">
            Flush Feed
          </button>
        )}
      </div>

      <div className="space-y-4">
        {incomingAlerts.map((log: AlertLog) => (
          <div key={log.id} className="bg-slate-800/60 rounded-[2rem] border border-blue-500/20 p-6 space-y-4 relative overflow-hidden group hover:border-blue-500/50 transition-all">
            <div className="absolute top-0 right-0 p-3">
               <ShieldAlert size={16} className="text-blue-500 opacity-20 group-hover:opacity-100 transition-opacity" />
            </div>
            
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white">{log.senderName || 'Anonymous User'}</h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                  <Clock size={10} />
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <div className="bg-blue-600/10 text-blue-400 px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter border border-blue-500/20">
                LIVE STATUS
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="text-sm text-slate-300 bg-slate-900/80 p-4 rounded-2xl border border-slate-700/50 italic leading-relaxed w-full">
                  "{log.message}"
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex gap-2">
                  <MapPin size={14} className="text-blue-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Broadcasting Location</span>
                </div>
                {log.location && (
                  <a 
                    href={`https://www.google.com/maps?q=${log.location.lat},${log.location.lng}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] font-black text-blue-400 bg-blue-400/10 px-3 py-1.5 rounded-full hover:bg-blue-400 hover:text-white transition-all uppercase tracking-widest flex items-center gap-1"
                  >
                    Open Link <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}

        {incomingAlerts.length === 0 && (
          <div className="py-24 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto border border-slate-700/50">
              <Radio size={32} className="text-slate-700" />
            </div>
            <div>
              <p className="font-black text-slate-400 uppercase tracking-widest text-xs">No active alerts</p>
              <p className="text-[10px] text-slate-600 mt-2 max-w-[180px] mx-auto font-medium">Guardian Link will display real-time safety updates from your network here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertHistory;
