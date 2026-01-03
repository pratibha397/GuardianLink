
import { Activity, Clock, ExternalLink, MessageCircle, Navigation, Radio, Send, ShieldAlert } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { AlertLog, User as AppUser, ChatMessage } from '../types';
import { normalizePhone } from './AuthScreen';

interface AlertHistoryProps {
  logs: AlertLog[];
  clearLogs: () => void;
  user: AppUser;
}

const AlertHistory: React.FC<AlertHistoryProps> = ({ user }) => {
  const [incomingAlerts, setIncomingAlerts] = useState<AlertLog[]>([]);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const chatEndRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const fetchUpdates = () => {
      const all: AlertLog[] = JSON.parse(localStorage.getItem('guardian_voice_global_alerts') || '[]');
      const myPhone = normalizePhone(user.phone);
      const active = all.filter(a => a.recipients.includes(myPhone) && a.isLive);
      setIncomingAlerts(active);
      setLastSync(Date.now());
    };
    fetchUpdates();
    const interval = setInterval(fetchUpdates, 1500);
    return () => clearInterval(interval);
  }, [user.phone]);

  const sendReply = (alertId: string) => {
    const text = replyText[alertId];
    if (!text?.trim()) return;

    const GLOBAL_KEY = 'guardian_voice_global_alerts';
    const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_KEY) || '[]');
    const idx = all.findIndex(a => a.id === alertId);
    if (idx !== -1) {
      const newMsg: ChatMessage = {
        id: Date.now().toString(),
        senderName: user.name,
        senderPhone: user.phone,
        text,
        timestamp: Date.now()
      };
      all[idx].updates.push(newMsg);
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(all));
      setReplyText({ ...replyText, [alertId]: '' });
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radio size={18} className="text-blue-500 animate-pulse" />
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20" />
          </div>
          <h3 className="font-black text-xs uppercase tracking-[0.4em] text-slate-500 italic">Network Intercept</h3>
        </div>
        <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[9px] font-black text-slate-500 uppercase flex items-center gap-2">
          <Clock size={12} className="text-blue-500" /> Live Feed
        </div>
      </div>

      <div className="space-y-12">
        {incomingAlerts.map(alert => (
          <div key={alert.id} className="bg-slate-900/60 border-2 border-blue-500/30 rounded-[3rem] p-8 space-y-7 shadow-2xl animate-in zoom-in duration-500">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center font-black text-3xl text-white shadow-2xl rotate-3 border-2 border-slate-950">{alert.senderName[0]}</div>
                <div>
                  <h4 className="font-black text-2xl text-white italic tracking-tighter leading-none">{alert.senderName}</h4>
                  <p className="text-[10px] text-blue-500 font-black uppercase flex items-center gap-2 mt-2 leading-none">
                    <Activity size={12} className="animate-pulse" /> Live Tracking Broadcast
                  </p>
                </div>
              </div>
              <div className="bg-red-500/10 border-2 border-red-500/20 px-4 py-2 rounded-[1.2rem] flex items-center gap-2">
                <ShieldAlert size={16} className="text-red-500" />
                <span className="text-[10px] font-black text-red-500 uppercase">Emergency</span>
              </div>
            </div>

            <div className="w-full h-64 bg-slate-950 rounded-[2.5rem] border-2 border-slate-800 overflow-hidden relative shadow-inner">
              {alert.location ? (
                <div className="w-full h-full relative">
                  <img src={`https://images.placeholders.dev/?width=500&height=350&text=LOCATING:+${alert.location.lat.toFixed(4)},${alert.location.lng.toFixed(4)}&bgColor=%230f172a&textColor=%232563eb`} className="w-full h-full object-cover opacity-40" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="p-5 bg-blue-600 rounded-full shadow-2xl text-white animate-pulse relative z-10"><Navigation size={32} /></div>
                    <div className="absolute w-32 h-32 border-2 border-blue-500/20 rounded-full animate-ping" />
                  </div>
                  <div className="absolute bottom-5 left-5 right-5 flex justify-between items-center bg-slate-900/95 p-5 rounded-[1.8rem] border border-white/5 shadow-2xl">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest leading-none">GPS Lock Active</p>
                      <div className="text-[11px] font-black text-white uppercase tabular-nums tracking-tighter leading-none">
                        {alert.location.lat.toFixed(6)}, {alert.location.lng.toFixed(6)}
                      </div>
                    </div>
                    <a href={`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`} target="_blank" className="bg-blue-600 p-4 rounded-[1.2rem] text-white shadow-xl hover:bg-blue-500 transition-all"><ExternalLink size={20} /></a>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-5 text-slate-700">
                  <Activity size={40} className="animate-bounce" />
                  <span className="text-[11px] uppercase font-black tracking-[0.5em]">Syncing Coordinates...</span>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-3 px-2">
                <MessageCircle size={16} className="text-blue-500" />
                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Tactical Feed</h5>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-4 px-3 custom-scrollbar">
                <div className="bg-blue-600/10 border-2 border-blue-500/10 p-5 rounded-[2.2rem] text-[12px] text-blue-100 italic leading-relaxed shadow-inner border-dashed">
                  Alert: {alert.message}
                </div>
                {alert.updates.map(msg => (
                  <div key={msg.id} className={`p-5 rounded-[2.2rem] text-[13px] shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300 border ${normalizePhone(msg.senderPhone) === normalizePhone(user.phone) ? 'ml-auto bg-blue-600 text-white border-blue-400/30 rounded-br-none' : 'bg-slate-800 text-slate-200 border-slate-700 rounded-bl-none mr-12'}`}>
                    <div className="flex justify-between items-center mb-1.5 opacity-60 text-[8px] font-black uppercase tracking-widest">
                      <span>{msg.senderName}</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p className="font-medium leading-snug">{msg.text}</p>
                  </div>
                ))}
                <div ref={(el) => { if (el) chatEndRefs.current[alert.id] = el; }} />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); sendReply(alert.id); }} className="flex gap-4 pt-2">
                <input type="text" value={replyText[alert.id] || ''} onChange={(e) => setReplyText({ ...replyText, [alert.id]: e.target.value })} placeholder="Intercept response..." className="grow bg-slate-950 border-2 border-slate-800 rounded-[2rem] py-5 px-8 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all shadow-inner" />
                <button type="submit" className="p-5 bg-blue-600 text-white rounded-[1.5rem] shadow-2xl active:scale-95 transition-all"><Send size={24}/></button>
              </form>
            </div>
          </div>
        ))}
        {incomingAlerts.length === 0 && (
          <div className="py-64 text-center space-y-8 animate-in fade-in duration-1000">
            <Radio size={80} className="text-slate-900 mx-auto" />
            <div className="space-y-3 px-10">
              <p className="text-[11px] font-black uppercase text-slate-700 tracking-[0.6em] leading-none">Security Standby</p>
              <p className="text-[9px] font-bold uppercase text-slate-800 tracking-widest italic leading-relaxed">Guardians are monitoring for active satellite handshakes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertHistory;
