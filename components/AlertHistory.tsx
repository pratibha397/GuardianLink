
import { Activity, ExternalLink, Navigation, Radio, Send, ShieldAlert } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AlertLog, User as AppUser, ChatMessage } from '../types';

interface AlertHistoryProps {
  logs: AlertLog[];
  clearLogs: () => void;
  user: AppUser;
}

const AlertHistory: React.FC<AlertHistoryProps> = ({ user }) => {
  const [incomingAlerts, setIncomingAlerts] = useState<AlertLog[]>([]);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [lastSync, setLastSync] = useState<number>(Date.now());

  useEffect(() => {
    const fetchLiveUpdates = () => {
      const all: AlertLog[] = JSON.parse(localStorage.getItem('guardian_voice_global_alerts') || '[]');
      // Filter for alerts where I am a recipient
      const active = all.filter(a => a.recipients.includes(user.phone) && a.isLive);
      setIncomingAlerts(active);
      setLastSync(Date.now());
    };

    fetchLiveUpdates();
    const interval = setInterval(fetchLiveUpdates, 1500);
    return () => clearInterval(interval);
  }, [user.phone]);

  const sendReply = (alertId: string) => {
    const text = replyText[alertId];
    if (!text?.trim()) return;

    const GLOBAL_KEY = 'guardian_voice_global_alerts';
    const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_KEY) || '[]');
    const idx = all.findIndex(a => a.id === alertId);
    
    if (idx !== -1) {
      const msg: ChatMessage = {
        id: Date.now().toString(),
        senderName: user.name,
        text,
        timestamp: Date.now()
      };
      all[idx].updates.push(msg);
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(all));
      setReplyText({ ...replyText, [alertId]: '' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-blue-500 animate-pulse" />
          <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-500">Tactical Feed</h3>
        </div>
        <div className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[8px] font-black text-slate-400 uppercase">
          Latency: {Math.max(0, (Date.now() - lastSync) / 1000).toFixed(1)}s
        </div>
      </div>

      {incomingAlerts.map(alert => (
        <div key={alert.id} className="bg-slate-900 border-2 border-blue-500/20 rounded-[2.5rem] p-6 space-y-5 shadow-2xl animate-in zoom-in duration-500">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-600 rounded-[1.2rem] flex items-center justify-center font-black text-2xl text-white shadow-[0_10px_30px_rgba(37,99,235,0.4)]">
                {alert.senderName[0]}
              </div>
              <div>
                <h4 className="font-black text-lg text-white italic tracking-tighter">{alert.senderName}</h4>
                <p className="text-[9px] text-blue-500 font-black uppercase flex items-center gap-1">
                  <Activity size={10} className="animate-pulse" /> Live Link Active
                </p>
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <ShieldAlert size={14} className="text-red-500" />
              <span className="text-[10px] font-black text-red-500 uppercase">Alert</span>
            </div>
          </div>

          {/* DYNAMIC MAP PREVIEW */}
          <div className="relative group">
            <div className="w-full h-52 bg-slate-950 rounded-[2rem] border border-slate-800 overflow-hidden relative shadow-inner">
               <img 
                src={`https://images.placeholders.dev/?width=400&height=250&text=GEO+TRACKER:+${alert.location?.lat.toFixed(5)},${alert.location?.lng.toFixed(5)}&bgColor=%230f172a&textColor=%232563eb`}
                alt="Tactical Map"
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-20 h-20 bg-blue-500/10 rounded-full animate-ping" />
                 <div className="p-4 bg-blue-600 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.8)] text-white">
                    <Navigation size={24} className="animate-pulse" />
                 </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-white/5">
                <div className="text-[9px] font-black text-white/70 uppercase">
                  {alert.location ? `${alert.location.lat.toFixed(6)}, ${alert.location.lng.toFixed(6)}` : 'GATHERING GPS...'}
                </div>
                <a 
                  href={`https://www.google.com/maps?q=${alert.location?.lat},${alert.location?.lng}`}
                  target="_blank"
                  className="bg-blue-600 p-2 rounded-xl text-white shadow-lg"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          </div>

          {/* CHAT THREAD */}
          <div className="max-h-48 overflow-y-auto space-y-3 px-1 custom-scrollbar">
            {alert.updates.map(msg => (
              <div key={msg.id} className={`p-4 rounded-[1.5rem] text-[11px] leading-relaxed shadow-sm ${msg.senderName === user.name ? 'bg-blue-600 text-white ml-8' : 'bg-slate-800 text-slate-300 mr-8 border border-slate-700'}`}>
                <div className="font-black uppercase text-[7px] mb-1 opacity-50">{msg.senderName}</div>
                {msg.text}
              </div>
            ))}
          </div>

          <form 
            onSubmit={(e) => { e.preventDefault(); sendReply(alert.id); }}
            className="flex gap-2"
          >
            <input 
              type="text" 
              value={replyText[alert.id] || ''} 
              onChange={(e) => setReplyText({ ...replyText, [alert.id]: e.target.value })} 
              placeholder="Send instruction..." 
              className="grow bg-slate-950 border border-slate-800 rounded-2xl py-4 px-5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30" 
            />
            <button type="submit" className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl hover:bg-blue-500">
              <Send size={18}/>
            </button>
          </form>
        </div>
      ))}

      {incomingAlerts.length === 0 && (
        <div className="py-40 text-center space-y-4">
          <div className="relative inline-block">
             <Radio size={48} className="text-slate-800" />
             <div className="absolute inset-0 bg-blue-500/5 rounded-full animate-ping" />
          </div>
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-[0.4em]">Standby • Network Encrypted</p>
        </div>
      )}
    </div>
  );
};

export default AlertHistory;
