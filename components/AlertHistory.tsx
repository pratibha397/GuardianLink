
import { Activity, ExternalLink, MapPin, Navigation, Radio, Send } from 'lucide-react';
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

  // High-frequency polling to simulate real-time network packets
  useEffect(() => {
    const fetchLiveUpdates = () => {
      const all: AlertLog[] = JSON.parse(localStorage.getItem('guardian_voice_global_alerts') || '[]');
      // Filter alerts where current user is a recipient and the alert is still "live"
      const active = all.filter(a => a.recipients.includes(user.phone) && a.isLive);
      setIncomingAlerts(active);
      setLastSync(Date.now());
    };

    fetchLiveUpdates();
    const interval = setInterval(fetchLiveUpdates, 1000); // 1-second refresh for "Live" feel
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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio size={14} className="text-blue-500 animate-pulse" />
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20" />
          </div>
          <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 italic">Live Network Feed</h3>
        </div>
        <div className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">
          Sync: {((Date.now() - lastSync) / 1000).toFixed(1)}s ago
        </div>
      </div>

      <div className="space-y-8">
        {incomingAlerts.map(alert => (
          <div key={alert.id} className="bg-slate-900 border border-blue-500/30 rounded-[2.5rem] p-6 space-y-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in duration-300">
            {/* Header: Sender Info */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-white shadow-lg rotate-3">
                    {alert.senderName[0]}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full animate-pulse" />
                </div>
                <div>
                  <h4 className="font-black text-base text-white">{alert.senderName}</h4>
                  <div className="flex items-center gap-2 text-[9px] text-blue-400 font-black uppercase tracking-widest">
                    <Navigation size={10} className="animate-bounce" /> Streaming Location
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-slate-500 uppercase">{new Date(alert.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>

            {/* Live Message Box */}
            <div className="bg-blue-600/5 border border-blue-500/10 p-4 rounded-2xl text-xs text-blue-100/80 italic leading-relaxed">
              "{alert.message}"
            </div>

            {/* THE LIVE MAP INTERFACE */}
            {alert.location ? (
              <div className="space-y-3">
                <div className="relative w-full h-48 bg-slate-950 rounded-[2rem] overflow-hidden border border-slate-800 shadow-inner group">
                  {/* Simulated Map Background - Using a high-quality static map image that updates with coordinates */}
                  <img 
                    src={`https://images.placeholders.dev/?width=400&height=200&text=LIVE+TRACKING:+${alert.location.lat.toFixed(4)},${alert.location.lng.toFixed(4)}&bgColor=%230f172a&textColor=%232563eb`}
                    alt="Live Location"
                    className="w-full h-full object-cover opacity-50 grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                  
                  {/* Radar/Pulse Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="w-24 h-24 border border-blue-500/20 rounded-full animate-ping" />
                     <div className="w-12 h-12 border border-blue-500/40 rounded-full animate-ping [animation-delay:0.5s]" />
                     <div className="p-3 bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.6)] text-white relative z-10">
                        <MapPin size={24} />
                     </div>
                  </div>

                  {/* Coordinate Badge */}
                  <div className="absolute bottom-4 left-4 right-4 bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-white/5 flex justify-between items-center">
                    <div className="text-[9px] font-black text-white uppercase tracking-tighter">
                      LAT: {alert.location.lat.toFixed(6)} <br/>
                      LNG: {alert.location.lng.toFixed(6)}
                    </div>
                    <a 
                      href={`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-blue-600 hover:bg-blue-500 p-2 rounded-lg text-white shadow-lg transition-transform active:scale-90"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
                <p className="text-center text-[8px] font-black uppercase text-slate-600 tracking-[0.2em]">Zero-Latency GPS Link Established</p>
              </div>
            ) : (
              <div className="h-48 bg-slate-950 rounded-[2rem] flex flex-col items-center justify-center border border-dashed border-slate-800">
                <Activity size={32} className="text-slate-800 animate-pulse mb-2" />
                <span className="text-[10px] font-black text-slate-700 uppercase">Awaiting GPS Lock...</span>
              </div>
            )}

            {/* Live Chat Stream */}
            <div className="max-h-48 overflow-y-auto space-y-3 px-1 custom-scrollbar">
              {alert.updates.map(msg => (
                <div key={msg.id} className={`p-4 rounded-2xl text-[11px] leading-relaxed shadow-sm ${msg.senderName === user.name ? 'bg-blue-600 text-white ml-8 rounded-br-none' : 'bg-slate-800 text-slate-300 border border-slate-700 mr-8 rounded-bl-none'}`}>
                  <div className="font-black uppercase text-[7px] mb-1 opacity-60 tracking-widest">{msg.senderName}</div>
                  {msg.text}
                </div>
              ))}
            </div>

            {/* Response Area */}
            <form 
              onSubmit={(e) => { e.preventDefault(); sendReply(alert.id); }}
              className="flex gap-2"
            >
              <input 
                type="text" 
                value={replyText[alert.id] || ''} 
                onChange={(e) => setReplyText({ ...replyText, [alert.id]: e.target.value })} 
                placeholder="Send tactical update..." 
                className="grow bg-slate-950 border border-slate-800 rounded-2xl py-4 px-5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all" 
              />
              <button 
                type="submit" 
                className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl hover:bg-blue-500 active:scale-95 transition-all"
              >
                <Send size={18}/>
              </button>
            </form>
          </div>
        ))}

        {incomingAlerts.length === 0 && (
          <div className="py-32 text-center">
            <div className="relative inline-block mb-6">
              <Radio size={64} className="text-slate-800" />
              <div className="absolute inset-0 bg-slate-800/20 rounded-full animate-ping" />
            </div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Listening for emergency packets</p>
            <p className="text-[9px] text-slate-700 mt-2 font-bold uppercase italic">Global Safety Mesh: Active</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertHistory;
