
import { Clock, ExternalLink, MapPin, Radio, Send, ShieldAlert } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AlertLog } from '../types';

interface AlertHistoryProps {
  logs: AlertLog[];
  clearLogs: () => void;
}

const AlertHistory: React.FC<AlertHistoryProps> = ({ logs, clearLogs }) => {
  const [incomingAlerts, setIncomingAlerts] = useState<AlertLog[]>([]);
  const [responseMsg, setResponseMsg] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchGlobal = () => {
      const GLOBAL_KEY = 'guardian_voice_global_alerts';
      const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_KEY) || '[]');
      setIncomingAlerts(all);
    };
    fetchGlobal();
    const interval = setInterval(fetchGlobal, 3000);
    return () => clearInterval(interval);
  }, []);

  const sendResponse = (log: AlertLog) => {
    const msg = responseMsg[log.id];
    if (!msg?.trim()) return;

    const GLOBAL_KEY = 'guardian_voice_global_alerts';
    const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_KEY) || '[]');
    const idx = all.findIndex(a => a.id === log.id);
    
    if (idx !== -1) {
      const responseEntry = `[Guardian Response]: ${msg}`;
      all[idx].message = `${all[idx].message}\n\n${responseEntry}`;
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(all));
      setResponseMsg({ ...responseMsg, [log.id]: '' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <Radio size={12} className="text-blue-500 animate-pulse" /> Active Link Feed
        </h3>
      </div>

      <div className="space-y-6">
        {incomingAlerts.map((log: AlertLog) => (
          <div key={log.id} className="bg-slate-900/60 rounded-[2.5rem] border border-blue-500/20 p-6 space-y-4 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-4">
               <ShieldAlert size={20} className="text-blue-500/30" />
            </div>
            
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-sm font-black text-white">{log.senderName}</h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold mt-1">
                  <Clock size={10} /> {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <div className="bg-blue-600/10 text-blue-400 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-blue-500/20">
                LINK SECURED
              </div>
            </div>

            <div className="bg-slate-950/80 p-5 rounded-3xl border border-slate-800 text-xs text-slate-300 italic leading-relaxed whitespace-pre-line">
              {log.message}
            </div>

            {log.location && (
              <div className="flex items-center justify-between bg-blue-600/5 p-4 rounded-2xl border border-blue-500/10">
                <div className="flex gap-2">
                  <MapPin size={14} className="text-blue-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Location App Link</span>
                </div>
                <a 
                  href={`https://www.google.com/maps?q=${log.location.lat},${log.location.lng}`} 
                  target="_blank" rel="noopener noreferrer"
                  className="text-[9px] font-black text-white bg-blue-600 px-4 py-2 rounded-xl hover:bg-blue-500 transition-all uppercase tracking-widest flex items-center gap-1 shadow-lg shadow-blue-900/40"
                >
                  View Map <ExternalLink size={10} />
                </a>
              </div>
            )}

            <div className="relative mt-2">
              <input 
                type="text" 
                value={responseMsg[log.id] || ''}
                onChange={(e) => setResponseMsg({ ...responseMsg, [log.id]: e.target.value })}
                placeholder="Acknowledge alert & reply..."
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 pl-4 pr-12 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                onKeyDown={(e) => e.key === 'Enter' && sendResponse(log)}
              />
              <button 
                onClick={() => sendResponse(log)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:scale-105"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        ))}

        {incomingAlerts.length === 0 && (
          <div className="py-32 text-center opacity-40">
            <Radio size={48} className="mx-auto text-slate-700 mb-4" />
            <p className="font-black text-[10px] uppercase tracking-widest text-slate-500">Listening for Link Signals...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertHistory;
