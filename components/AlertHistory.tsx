
import { DataSnapshot, onValue, push, ref, set } from 'firebase/database';
import { Activity, ExternalLink, Navigation, Radio, Send, ShieldAlert } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { rtdb } from '../services/firebase';
import { AlertLog, User as AppUser, ChatMessage } from '../types';

interface AlertHistoryProps {
  logs: AlertLog[];
  clearLogs: () => void;
  user: AppUser;
}

const AlertHistory: React.FC<AlertHistoryProps> = ({ user }) => {
  const [incomingAlerts, setIncomingAlerts] = useState<AlertLog[]>([]);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const chatEndRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const alertsRef = ref(rtdb, 'alerts');
    const unsubscribe = onValue(alertsRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (data) {
        const active = Object.values(data).filter((a: any) => 
          a.recipients?.includes(user.email) && a.isLive
        ) as AlertLog[];
        setIncomingAlerts(active);
      } else {
        setIncomingAlerts([]);
      }
    });

    return () => unsubscribe();
  }, [user.email]);

  const sendReply = async (alertId: string) => {
    const text = replyText[alertId];
    if (!text?.trim()) return;

    const msg: ChatMessage = {
      id: Date.now().toString(),
      senderName: user.name,
      senderEmail: user.email,
      text,
      timestamp: Date.now()
    };

    const updatesRef = ref(rtdb, `alerts/${alertId}/updates`);
    await set(push(updatesRef), msg);
    setReplyText({ ...replyText, [alertId]: '' });
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radio size={18} className="text-sky-500 animate-pulse" />
            <div className="absolute inset-0 bg-sky-500 rounded-full animate-ping opacity-20" />
          </div>
          <h3 className="font-black text-[10px] uppercase tracking-[0.4em] text-slate-500 italic">Mesh Intercept</h3>
        </div>
      </div>

      <div className="space-y-12">
        {incomingAlerts.map(alert => (
          <div key={alert.id} className="bg-slate-900/30 border border-white/5 rounded-[3rem] p-7 space-y-7 shadow-2xl relative">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-sky-500 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-xl rotate-3 border-4 border-slate-950">{alert.senderName[0]}</div>
                <div>
                  <h4 className="font-black text-xl text-white italic tracking-tighter leading-none">{alert.senderName}</h4>
                  <p className="text-[9px] text-sky-500 font-black uppercase mt-2 tracking-widest">{alert.senderEmail}</p>
                </div>
              </div>
              <div className="bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20">
                <ShieldAlert size={14} className="text-red-500" />
              </div>
            </div>

            <div className="w-full h-56 bg-slate-950 rounded-[2rem] border border-white/5 overflow-hidden relative shadow-inner">
              {alert.location ? (
                <div className="w-full h-full">
                  <img src={`https://images.placeholders.dev/?width=400&height=300&text=LOCATING&bgColor=%23020617&textColor=%230f172a`} className="w-full h-full object-cover opacity-20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Navigation size={32} className="text-sky-500 animate-pulse" />
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-slate-900/95 p-4 rounded-2xl border border-white/5">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-sky-500 uppercase tracking-widest">Live Coordinate</p>
                      <div className="text-[10px] font-black text-white uppercase tabular-nums">{alert.location.lat.toFixed(5)}, {alert.location.lng.toFixed(5)}</div>
                    </div>
                    <a href={`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`} target="_blank" className="bg-sky-500 p-3 rounded-xl text-white"><ExternalLink size={18} /></a>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-800">
                  <Activity size={32} className="animate-pulse" />
                  <span className="text-[9px] uppercase font-black tracking-[0.4em]">Establishing Link...</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-sky-500/5 border border-sky-500/10 p-5 rounded-2xl text-[11px] text-sky-200 italic leading-relaxed">
                Status: {alert.message}
              </div>
              
              <div className="max-h-48 overflow-y-auto space-y-3 custom-scrollbar px-2">
                {alert.updates && Object.values(alert.updates).map((msg: any) => (
                  <div key={msg.id} className={`p-4 rounded-2xl text-[12px] border ${msg.senderEmail === user.email ? 'ml-8 bg-sky-500 text-white border-white/10' : 'mr-8 bg-slate-800 text-slate-300 border-white/5'}`}>
                    <div className="flex justify-between items-center mb-1 text-[8px] font-black uppercase opacity-60">
                      <span>{msg.senderName}</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p className="font-bold">{msg.text}</p>
                  </div>
                ))}
                <div ref={(el) => { if (el) chatEndRefs.current[alert.id] = el; }} />
              </div>

              <form onSubmit={(e) => { e.preventDefault(); sendReply(alert.id); }} className="flex gap-3">
                <input type="text" value={replyText[alert.id] || ''} onChange={(e) => setReplyText({ ...replyText, [alert.id]: e.target.value })} placeholder="Type response..." className="grow bg-slate-950 border border-white/5 rounded-2xl py-4 px-6 text-sm text-white font-bold outline-none focus:border-sky-500 transition-all shadow-inner" />
                <button type="submit" className="p-4 bg-sky-500 text-white rounded-2xl shadow-xl active:scale-95 transition-all"><Send size={20}/></button>
              </form>
            </div>
          </div>
        ))}

        {incomingAlerts.length === 0 && (
          <div className="py-48 text-center space-y-6">
            <Radio size={48} className="text-slate-900 mx-auto" />
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-700 tracking-[0.6em]">Feed Quiet</p>
              <p className="text-[9px] font-bold uppercase text-slate-800 tracking-widest italic">Monitoring satellite mesh for activity</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertHistory;
