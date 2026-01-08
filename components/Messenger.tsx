import {
  ArrowLeft,
  ExternalLink, MapPin,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Navigation,
  Search,
  Send,
  ShieldCheck,
  User as UserIcon
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DataSnapshot, onValue, push, ref, rtdb } from '../services/firebase';
import { getPreciseCurrentPosition } from '../services/LocationService';
import { AppSettings, ChatMessage, EmergencyContact, GuardianCoords, User } from '../types';

interface MessengerProps {
  user: User;
  settings: AppSettings;
  activeAlertId: string | null;
}

const Messenger: React.FC<MessengerProps> = ({ user, settings, activeAlertId }) => {
  const [selectedContact, setSelectedContact] = useState<EmergencyContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /**
   * Generates a unique, deterministic ID for the conversation.
   */
  const getChatPath = (contact: EmergencyContact) => {
    if (activeAlertId) return `alerts/${activeAlertId}`;
    
    const email1 = user.email.toLowerCase().trim();
    const email2 = contact.email.toLowerCase().trim();
    const sortedEmails = [email1, email2].sort();
    const sanitize = (e: string) => e.replace(/[\.\#\$\/\[\]]/g, '_');
    
    const combinedId = `${sanitize(sortedEmails[0])}__${sanitize(sortedEmails[1])}`;
    return `direct_chats/${combinedId}`;
  };

  // Real-time message synchronization
  useEffect(() => {
    if (selectedContact) {
      const path = getChatPath(selectedContact);
      const messagesRef = ref(rtdb, `${path}/updates`);
      
      const unsubscribe = onValue(messagesRef, (snapshot: DataSnapshot) => {
        const data = snapshot.val();
        if (data) {
          const msgArray = Object.keys(data).map(key => ({
            ...data[key],
            id: key
          }));
          const sorted = msgArray.sort((a: any, b: any) => a.timestamp - b.timestamp) as ChatMessage[];
          setMessages(sorted);
        } else {
          setMessages([]);
        }
      }, (error) => {
        console.error("Firebase Realtime Listener Error:", error);
      });

      return () => unsubscribe();
    } else {
      setMessages([]);
    }
  }, [selectedContact, activeAlertId, user.email]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const messageText = text.trim();
    if (!selectedContact || !messageText) return;

    const path = getChatPath(selectedContact);
    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderName: user.name,
      senderEmail: user.email.toLowerCase().trim(),
      text: messageText,
      timestamp: Date.now()
    };

    try {
      setText('');
      await push(ref(rtdb, `${path}/updates`), newMessage);
    } catch (err) { 
      console.error("Failed to transmit message:", err);
      setText(messageText);
    }
  };

  /**
   * Manual Location Dispatch:
   * Fetches fresh High-Accuracy coordinates and sends them as a location message.
   */
  const sendManualLocation = async () => {
    if (!selectedContact || isLocating) return;
    
    setIsLocating(true);
    try {
      const coords: GuardianCoords = await getPreciseCurrentPosition();
      const path = getChatPath(selectedContact);
      
      const locationMsg: ChatMessage = {
        id: `loc_${Date.now()}`,
        type: 'location',
        senderName: user.name,
        senderEmail: user.email.toLowerCase().trim(),
        text: '📍 Shared Live Location',
        lat: coords.lat,
        lng: coords.lng,
        timestamp: Date.now()
      };

      await push(ref(rtdb, `${path}/updates`), locationMsg);
    } catch (err) {
      console.error("Manual location dispatch failed:", err);
      alert("Failed to acquire GPS lock. Please check permissions.");
    } finally {
      setIsLocating(false);
    }
  };

  // 1. INBOX VIEW
  if (!selectedContact) {
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-white italic tracking-tighter">Messages</h2>
            <div className="p-2.5 bg-blue-600/10 rounded-full text-blue-500">
              <MessageSquare size={20} />
            </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" placeholder="Search Guardians..." 
              className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold outline-none focus:border-blue-500 shadow-inner"
            />
          </div>

          <div className="space-y-4 pb-28">
            <div className="flex items-center gap-2 px-2 mb-4">
              <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Active Guardians</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            {(!settings.contacts || settings.contacts.length === 0) ? (
              <div className="text-center py-20 opacity-20 italic">
                <UserIcon size={48} className="mx-auto mb-4" />
                <p className="text-[10px] uppercase font-bold tracking-widest">No Authorized Contacts.<br/>Add them in Settings.</p>
              </div>
            ) : (
              settings.contacts.map(contact => (
                <div 
                  key={contact.id} 
                  onClick={() => setSelectedContact(contact)}
                  className="bg-slate-900/40 border border-white/5 p-4 rounded-3xl flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer hover:bg-slate-800/60 shadow-lg"
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600/10 flex items-center justify-center font-black text-blue-500 text-lg uppercase border border-blue-500/20">
                      {contact.name ? contact.name[0] : '?'}
                    </div>
                    {contact.isRegisteredUser && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-[#020617] rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white italic">{contact.name}</h4>
                      {contact.isRegisteredUser && <ShieldCheck size={12} className="text-blue-500" />}
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate max-w-[150px]">{contact.email}</p>
                  </div>
                  <MoreVertical size={16} className="text-slate-800" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. CHAT VIEW
  return (
    <div className="fixed inset-0 z-[60] bg-[#020617] flex flex-col animate-in slide-in-from-right duration-300">
      <header className="p-6 bg-[#020617]/90 backdrop-blur-xl flex items-center justify-between border-b border-white/5 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedContact(null)} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center font-black text-blue-500 text-sm uppercase">
               {selectedContact.name ? selectedContact.name[0] : '?'}
             </div>
             <div>
               <h3 className="font-black text-sm text-white italic">{selectedContact.name}</h3>
               <div className="flex items-center gap-1">
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                 <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Secured Node</span>
               </div>
             </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <button 
            onClick={sendManualLocation}
            disabled={isLocating}
            className={`p-2 rounded-xl transition-all ${isLocating ? 'text-blue-500 animate-pulse bg-blue-500/10' : 'hover:text-blue-500 hover:bg-blue-500/10'}`}
          >
            <MapPin size={22} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {activeAlertId && (
          <div className="flex justify-center mb-8">
            <div className="bg-red-600/20 border border-red-500/40 px-6 py-2 rounded-full text-red-500 text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
              <ShieldCheck size={12} /> Emergency War Room
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-10 italic">
            <MessageCircle size={48} className="mb-4" />
            <p className="text-[10px] uppercase font-black tracking-widest">End-to-End Encrypted.<br/>No messages yet.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderEmail.toLowerCase().trim() === user.email.toLowerCase().trim();
            
            if (msg.type === 'location') {
              return (
                <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-4 animate-in fade-in slide-in-from-bottom-2`}>
                   {!isMe && <p className="text-[8px] font-black uppercase text-blue-400 mb-1 px-2">{msg.senderName}</p>}
                   <div className="bg-blue-600 p-5 rounded-[2rem] w-full max-w-[240px] shadow-2xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-white/20 p-2 rounded-xl text-white"><Navigation size={18} /></div>
                      <span className="text-white text-[10px] font-black uppercase tracking-widest italic">Live Pinpoint</span>
                    </div>
                    <a 
                      href={`https://www.google.com/maps?q=${msg.lat},${msg.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 bg-white py-3 rounded-xl text-blue-950 text-[9px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                    >
                      View Map <ExternalLink size={10} />
                    </a>
                  </div>
                  <span className="text-[7px] font-black text-slate-700 uppercase mt-1.5 px-2">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            }

            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[85%] p-4 rounded-3xl text-[13px] font-bold shadow-lg leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'}`}>
                  {!isMe && <p className="text-[8px] font-black uppercase text-blue-400 mb-1">{msg.senderName}</p>}
                  {msg.text}
                </div>
                <span className="text-[7px] font-black text-slate-700 uppercase mt-1.5 px-2">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} className="h-4" />
      </div>

      <div className="p-6 bg-[#020617]/95 backdrop-blur-md border-t border-white/5 pb-10">
        <form onSubmit={sendMessage} className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <input 
              type="text" value={text} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
              placeholder="Message Guardian..." 
              className="w-full bg-slate-900 border border-white/10 rounded-3xl px-6 py-4 text-sm text-white outline-none focus:border-blue-500 shadow-inner placeholder:text-slate-700"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3 text-slate-700">
               <button type="button" onClick={sendManualLocation}>
                 <MapPin size={18} className={`${isLocating ? 'text-blue-500 animate-bounce' : 'hover:text-blue-500'} transition-colors`} />
               </button>
            </div>
          </div>
          <button 
            type="submit" 
            className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-600/20 active:scale-90 transition-all disabled:opacity-30 flex items-center justify-center"
            disabled={!text.trim()}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Messenger;