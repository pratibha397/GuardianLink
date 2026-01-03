
import { Activity, Clock, ExternalLink, MessageCircle, Navigation, Radio, Send, ShieldAlert } from 'lucide-react';
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

  // High-frequency polling to simulate a real-time server connection
  useEffect(() => {
    const fetchLiveUpdates = () => {
      const all: AlertLog[] = JSON.parse(localStorage.getItem('guardian_voice_global_alerts') || '[]');
      // Show alerts where I am a recipient and it is currently live
      const active = all.filter(a => a.recipients.includes(user.phone) && a.isLive);
      setIncomingAlerts(active);
      setLastSync(Date.now());
    };

    fetchLiveUpdates();
    const interval = setInterval(fetchLiveUpdates, 1500); // Poll every 1.5s for "Live" feel
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
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radio size={16} className="text-blue-500 animate-pulse" />
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20" />
          </div>
          <h3 className="font-black text-xs uppercase tracking-[0.3em] text-slate-500 italic">Intercept Feed</h3>
        </div>
        <div className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-[8px] font-black text-slate-500 uppercase flex items-center gap-2">
          <Clock size={10} /> Sync: {Math.max(0, (Date.now() - lastSync) / 1000).toFixed(1)}s
        </div>
      </div>

      <div className="space-y-10">
        {incomingAlerts.map(alert => (
          <div key={alert.id} className="bg-slate-900/60 border-2 border-blue-500/30 rounded-[3rem] p-7 space-y-6 shadow-[0_30px_70px_rgba(0,0,0,0.6)] animate-in zoom-in duration-500 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center font-black text-3xl text-white shadow-[0_15px_35px_rgba(37,99,235,0.45)] rotate-3">
                  {alert.senderName[0]}
                </div>
                <div>
                  <h4 className="font-black text-xl text-white italic tracking-tighter leading-none">{alert.senderName}</h4>
                  <p className="text-[10px] text-blue-500 font-black uppercase flex items-center gap-2 mt-2">
                    <Activity size={12} className="animate-pulse" /> Encrypted Link Active
                  </p>
                </div>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-inner">
                <ShieldAlert size={16} className="text-red-500" />
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Urgent</span>
              </div>
            </div>

            {/* LIVE TRACKING MAP INTERFACE */}
            <div className="relative group overflow-hidden rounded-[2.5rem] border border-slate-800 shadow-inner">
              <div className="w-full h-56 bg-slate-950 flex flex-col items-center justify-center relative">
                 {alert.location ? (
                   <div className="w-full h-full relative">
                      {/* High-quality placeholder map logic */}
                      <img 
                        src={`https://images.placeholders.dev/?width=500&height=300&text=GEO+STREAM:+${alert.location.lat.toFixed(4)},${alert.location.lng.toFixed(4)}&bgColor=%230f172a&textColor=%232563eb`}
                        alt="Satellite Map View"
                        className="w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700"
                      />
                      
                      {/* Radar Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className="w-40 h-40 border border-blue-500/10 rounded-full animate-[ping_3s_infinite]" />
                         <div className="w-24 h-24 border border-blue-500/20 rounded-full animate-[ping_3s_infinite_0.5s]" />
                         <div className="p-4 bg-blue-600 rounded-full shadow-[0_0_50px_rgba(37,99,235,0.8)] text-white relative z-10">
                            <Navigation size={28} className="animate-pulse" />
                         </div>
                      </div>

                      {/* Real-time Telemetry Data */}
                      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-slate-900/90 backdrop-blur-xl p-4 rounded-[1.5rem] border border-white/5 shadow-2xl">
                        <div className="space-y-1">
                          <p className="text-[8px] font-black text-blue-500 uppercase tracking-[0.2em]">GPS Telemetry Locked</p>
                          <div className="text-[10px] font-black text-white/90 uppercase tracking-tighter tabular-nums">
                             Lat: {alert.location.lat.toFixed(6)} | Lng: {alert.location.lng.toFixed(6)}
                          </div>
                        </div>
                        <a 
                          href={`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl hover:bg-blue-500 active:scale-90 transition-all"
                        >
                          <ExternalLink size={18} />
                        </a>
                      </div>
                   </div>
                 ) : (
                   <div className="flex flex-col items-center gap-4 text-slate-700">
                      <div className="p-5 bg-slate-900 rounded-full animate-pulse shadow-inner">
                        <Activity size={32} />
                      </div>
                      <span className="text-[10px] uppercase font-black tracking-[0.3em]">Acquiring Signal...</span>
                   </div>
                 )}
              </div>
            </div>

            {/* TWO-WAY TACTICAL CHAT */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <MessageCircle size={14} className="text-blue-500" />
                <h5 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600">Secure Comms Channel</h5>
              </div>
              
              <div className="max-h-56 overflow-y-auto space-y-4 px-2 custom-scrollbar">
                <div className="bg-blue-600/10 border border-blue-500/20 p-5 rounded-3xl text-[11px] text-blue-100/70 italic shadow-inner">
                   System Notification: {alert.message}
                </div>
                {alert.updates.map(msg => (
                  <div key={msg.id} className={`p-4 rounded-[1.8rem] text-[11px] leading-relaxed shadow-lg border ${msg.senderName === user.name ? 'bg-blue-600 text-white ml-10 rounded-br-none border-blue-400/30' : 'bg-slate-800 text-slate-300 mr-10 border-slate-700 rounded-bl-none'}`}>
                    <div className="flex justify-between items-center mb-1.5 opacity-60">
                      <span className="font-black uppercase text-[7px] tracking-[0.2em]">{msg.senderName}</span>
                      <span className="text-[7px] font-bold">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p className="font-medium">{msg.text}</p>
                  </div>
                ))}
              </div>

              <form 
                onSubmit={(e) => { e.preventDefault(); sendReply(alert.id); }}
                className="flex gap-3 pt-2"
              >
                <input 
                  type="text" 
                  value={replyText[alert.id] || ''} 
                  onChange={(e) => setReplyText({ ...replyText, [alert.id]: e.target.value })} 
                  placeholder="Type tactical update..." 
                  className="grow bg-slate-950 border border-slate-800 rounded-[1.8rem] py-5 px-6 text-xs text-white font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 shadow-inner" 
                />
                <button type="submit" className="p-5 bg-blue-600 text-white rounded-[1.5rem] shadow-2xl hover:bg-blue-500 active:scale-95 transition-all">
                  <Send size={20}/>
                </button>
              </form>
            </div>
          </div>
        ))}

        {incomingAlerts.length === 0 && (
          <div className="py-52 text-center space-y-6">
            <div className="relative inline-block">
               <Radio size={64} className="text-slate-900 mx-auto" />
               <div className="absolute inset-0 bg-blue-500/5 rounded-full animate-ping scale-150 opacity-20" />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-600 tracking-[0.5em]">Mesh Network Standby</p>
              <p className="text-[8px] font-bold uppercase text-slate-800 tracking-widest italic">All linked guardians are currently secure</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertHistory;
