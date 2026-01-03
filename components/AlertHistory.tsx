
import { Clock, ExternalLink, MapPin, Radio, Send } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AlertLog, User as AppUser, ChatMessage } from '../types';

interface AlertHistoryProps {
  logs: AlertLog[];
  clearLogs: () => void;
  user: AppUser;
}

const AlertHistory: React.FC<AlertHistoryProps> = ({ logs, clearLogs, user }) => {
  const [incomingAlerts, setIncomingAlerts] = useState<AlertLog[]>([]);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetch = () => {
      const all: AlertLog[] = JSON.parse(localStorage.getItem('guardian_voice_global_alerts') || '[]');
      const filtered = all.filter(a => a.recipients.includes(user.phone) && a.isLive);
      setIncomingAlerts(filtered);
    };
    fetch();
    const interval = setInterval(fetch, 2000);
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
      <div className="flex items-center gap-2 mb-2">
        <Radio size={14} className="text-blue-500 animate-pulse" />
        <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Live Guardian Feed</h3>
      </div>

      <div className="space-y-6">
        {incomingAlerts.map(alert => (
          <div key={alert.id} className="bg-slate-900 border border-blue-500/20 rounded-[2.5rem] p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center font-black">{alert.senderName[0]}</div>
                <div>
                  <h4 className="font-black text-sm">{alert.senderName}</h4>
                  <div className="flex items-center gap-2 text-[9px] text-slate-500 font-bold uppercase"><Clock size={10} /> {new Date(alert.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
              <div className="px-3 py-1 bg-blue-600/10 border border-blue-500/20 rounded-full text-[8px] font-black text-blue-400 uppercase">Active Tracking</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs italic text-blue-100">
              "{alert.message}"
            </div>

            <div className="max-h-48 overflow-y-auto space-y-3 px-1 custom-scrollbar">
              {alert.updates.map(msg => (
                <div key={msg.id} className={`p-3 rounded-2xl text-[11px] ${msg.senderName === user.name ? 'bg-blue-600 text-white ml-6' : 'bg-slate-800 text-slate-300 border border-slate-700 mr-6'}`}>
                  {msg.text}
                </div>
              ))}
            </div>

            {alert.location && (
              <a href={`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`} target="_blank" className="flex items-center justify-between bg-blue-600/10 p-4 rounded-2xl border border-blue-500/30">
                <div className="flex gap-2 items-center"><MapPin size={16} className="text-blue-500" /><span className="text-[10px] font-black uppercase text-slate-400">View Live Position</span></div>
                <ExternalLink size={14} className="text-blue-400" />
              </a>
            )}

            <div className="flex gap-2">
              <input type="text" value={replyText[alert.id] || ''} onChange={(e) => setReplyText({ ...replyText, [alert.id]: e.target.value })} placeholder="Respond to alert..." className="grow bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-xs text-white" />
              <button onClick={() => sendReply(alert.id)} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg"><Send size={18}/></button>
            </div>
          </div>
        ))}

        {incomingAlerts.length === 0 && (
          <div className="py-24 text-center opacity-40">
            <Radio size={48} className="mx-auto text-slate-800 mb-4" />
            <p className="text-[10px] font-black uppercase text-slate-500">Listening for emergency signals...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertHistory;
