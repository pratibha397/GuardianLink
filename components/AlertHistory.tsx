
import { DataSnapshot, onValue, push, ref } from 'firebase/database';
import { ExternalLink, Navigation, Radio, Send, ShieldAlert, Wifi } from 'lucide-react';
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
  const [meshChats, setMeshChats] = useState<{ [key: string]: any }>({});
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const chatEndRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Listen for both Alerts and persistent Mesh Comms
  useEffect(() => {
    // Alerts Listener
    const alertsRef = ref(rtdb, 'alerts');
    const unsubscribeAlerts = onValue(alertsRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (data) {
        const active = Object.values(data).filter((a: any) => 
          (a.recipients?.includes(user.email) || a.senderEmail === user.email) && a.isLive
        ) as AlertLog[];
        active.sort((a, b) => b.timestamp - a.timestamp);
        setIncomingAlerts(active);
      } else {
        setIncomingAlerts([]);
      }
    });

    // Mesh Comms Listener (Check for messages from users I'm a guardian for)
    // Note: In a production mesh, we'd query specifically for monitored users.
    // For this prototype, we monitor the 'mesh_chats' node.
    const meshRef = ref(rtdb, 'mesh_chats');
    const unsubscribeMesh = onValue(meshRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (data) {
        setMeshChats(data);
      }
    });

    return () => {
      unsubscribeAlerts();
      unsubscribeMesh();
    };
  }, [user.email]);

  const sendReply = async (path: string, id: string) => {
    const text = replyText[id];
    if (!text?.trim()) return;

    const msg: ChatMessage = {
      id: Date.now().toString(),
      senderName: user.name,
      senderEmail: user.email,
      text: text.trim(),
      timestamp: Date.now()
    };

    try {
      await push(ref(rtdb, `${path}/updates`), msg);
      setReplyText({ ...replyText, [id]: '' });
      setTimeout(() => chatEndRefs.current[id]?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Radio size={18} className="text-blue-500 animate-pulse" />
          <h3 className="font-black text-[10px] uppercase tracking-[0.4em] text-slate-500 italic">Safety Network</h3>
        </div>
      </div>

      <div className="space-y-12">
        {/* Active Emergencies take Priority */}
        {incomingAlerts.map(alert => (
          <div key={alert.id} className="bg-red-950/10 border-2 border-red-500/20 rounded-[3rem] p-7 space-y-6 shadow-2xl relative animate-in fade-in duration-500">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-xl flex items-center gap-2">
              <ShieldAlert size={12} /> CRITICAL INCIDENT
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-xl border-4 border-slate-950">
                  {alert.senderName[0]}
                </div>
                <div>
                  <h4 className="font-black text-xl text-white italic tracking-tighter leading-none">{alert.senderName}</h4>
                  <p className="text-[9px] text-red-500 font-black uppercase mt-1">EMERGENCY SOS</p>
                </div>
              </div>
            </div>

            {alert.location && (
               <div className="w-full h-40 bg-slate-950 rounded-[2rem] border border-white/5 overflow-hidden relative shadow-inner">
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <Navigation size={60} className="text-red-500 animate-pulse" />
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-red-500/20">
                    <div className="text-[10px] font-black text-white tabular-nums">
                      {alert.location.lat.toFixed(5)}, {alert.location.lng.toFixed(5)}
                    </div>
                    <a href={`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`} target="_blank" className="bg-red-600 p-2.5 rounded-xl text-white shadow-lg"><ExternalLink size={16} /></a>
                  </div>
               </div>
            )}

            <div className="space-y-4">
              <div className="bg-slate-950/60 rounded-[2rem] p-5 space-y-4 border border-white/5">
                <div className="max-h-40 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                  {alert.updates && Object.values(alert.updates).sort((a: any, b: any) => a.timestamp - b.timestamp).map((msg: any) => (
                    <div key={msg.id} className={`p-3 rounded-2xl text-[12px] font-bold ${msg.senderEmail === user.email ? 'bg-blue-600 text-white ml-6' : 'bg-slate-800 text-slate-300 mr-6'}`}>
                      {msg.text}
                    </div>
                  ))}
                  <div ref={(el) => { if (el) chatEndRefs.current[alert.id] = el; }} />
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); sendReply(`alerts/${alert.id}`, alert.id); }} className="flex gap-2">
                  <input 
                    type="text" value={replyText[alert.id] || ''} onChange={(e) => setReplyText({ ...replyText, [alert.id]: e.target.value })} 
                    placeholder="Emergency response..." className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-white" 
                  />
                  <button type="submit" className="p-3 bg-red-600 text-white rounded-xl shadow-lg"><Send size={18}/></button>
                </form>
              </div>
            </div>
          </div>
        ))}

        {/* Regular Mesh Conversations */}
        {Object.entries(meshChats).map(([meshId, data]) => {
          // In a real app, only show chats if I'm a guardian of meshId
          // For now, only show if it has messages and isn't the current user's own mesh (unless they want to see it)
          const messages = data.updates ? Object.values(data.updates).sort((a: any, b: any) => a.timestamp - b.timestamp) as ChatMessage[] : [];
          if (messages.length === 0) return null;
          
          const lastMsg = messages[messages.length - 1];
          const isOwnMesh = lastMsg.senderEmail === user.email && incomingAlerts.length === 0;

          return (
            <div key={meshId} className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 space-y-5 shadow-xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center font-black text-slate-500">
                    {lastMsg.senderName[0]}
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-white italic">{lastMsg.senderName}</h4>
                    <div className="flex items-center gap-1.5">
                      <Wifi size={10} className="text-blue-500" />
                      <span className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Normal Status • Mesh Comms</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 rounded-2xl p-4 space-y-4">
                <div className="max-h-40 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                  {messages.map((msg: any) => (
                    <div key={msg.id} className={`p-3 rounded-2xl text-[11px] font-bold ${msg.senderEmail === user.email ? 'bg-blue-600 text-white ml-6' : 'bg-slate-800 text-slate-300 mr-6'}`}>
                      {msg.text}
                    </div>
                  ))}
                  <div ref={(el) => { if (el) chatEndRefs.current[meshId] = el; }} />
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); sendReply(`mesh_chats/${meshId}`, meshId); }} className="flex gap-2">
                  <input 
                    type="text" value={replyText[meshId] || ''} onChange={(e) => setReplyText({ ...replyText, [meshId]: e.target.value })} 
                    placeholder="Reply to mesh node..." className="flex-1 bg-slate-900 border border-white/5 rounded-xl px-4 py-2 text-xs text-white" 
                  />
                  <button type="submit" className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg"><Send size={16}/></button>
                </form>
              </div>
            </div>
          );
        })}

        {incomingAlerts.length === 0 && Object.keys(meshChats).length === 0 && (
          <div className="py-48 text-center space-y-6 opacity-20">
            <Radio size={48} className="mx-auto" />
            <p className="text-[10px] font-black uppercase tracking-[0.5em]">Network Standby</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertHistory;
