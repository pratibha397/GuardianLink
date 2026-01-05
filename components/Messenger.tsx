
import {
    Activity,
    ArrowLeft,
    Camera,
    ExternalLink,
    MessageCircle,
    MessageSquare,
    MoreVertical,
    Navigation,
    Phone,
    Search,
    Send,
    ShieldCheck,
    User as UserIcon
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { DataSnapshot, onValue, push, ref, rtdb } from '../services/firebase';
import { AppSettings, ChatMessage, EmergencyContact, User } from '../types';

interface MessengerProps {
  user: User;
  settings: AppSettings;
  activeAlertId: string | null;
}

const Messenger: React.FC<MessengerProps> = ({ user, settings, activeAlertId }) => {
  const [selectedContact, setSelectedContact] = useState<EmergencyContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Derive Chat Path
  // For emergency: path is specific to alert
  // For normal: path is 1-on-1 direct chat
  const getChatPath = (contact: EmergencyContact) => {
    if (activeAlertId) return `alerts/${activeAlertId}`;
    const sortedIds = [user.email, contact.email].sort();
    const chatKey = sortedIds[0].replace(/\./g, '_') + "__" + sortedIds[1].replace(/\./g, '_');
    return `direct_chats/${chatKey}`;
  };

  useEffect(() => {
    if (selectedContact) {
      const path = getChatPath(selectedContact);
      const chatRef = ref(rtdb, `${path}/updates`);
      const unsubscribe = onValue(chatRef, (snapshot: DataSnapshot) => {
        const data = snapshot.val();
        if (data) {
          const sorted = Object.values(data).sort((a: any, b: any) => a.timestamp - b.timestamp) as ChatMessage[];
          setMessages(sorted);
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else {
          setMessages([]);
        }
      });
      return () => unsubscribe();
    }
  }, [selectedContact, activeAlertId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !text.trim()) return;

    const path = getChatPath(selectedContact);
    const msg: ChatMessage = {
      id: Date.now().toString(),
      senderName: user.name,
      senderEmail: user.email,
      text: text.trim(),
      timestamp: Date.now()
    };

    try {
      await push(ref(rtdb, `${path}/updates`), msg);
      setText('');
    } catch (e) { console.error(e); }
  };

  // 1. INBOX LIST VIEW
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
              className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-4 pb-28">
            <div className="flex items-center gap-2 px-2 mb-4">
              <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Active Guardians</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            {settings.contacts.length === 0 ? (
              <div className="text-center py-20 opacity-20 italic">
                <UserIcon size={48} className="mx-auto mb-4" />
                <p className="text-[10px] uppercase font-bold tracking-widest">No Authorized Contacts.<br/>Add them in Settings.</p>
              </div>
            ) : (
              settings.contacts.map(contact => (
                <div 
                  key={contact.id} 
                  onClick={() => setSelectedContact(contact)}
                  className="bg-slate-900/40 border border-white/5 p-4 rounded-3xl flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer hover:bg-slate-800/60"
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600/10 flex items-center justify-center font-black text-blue-500 text-lg uppercase border border-blue-500/20">
                      {contact.name[0]}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-[#020617] rounded-full" />
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

  // 2. CHAT CONVERSATION VIEW
  return (
    <div className="fixed inset-0 z-[60] bg-[#020617] flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <header className="p-6 bg-[#020617]/90 backdrop-blur-xl flex items-center justify-between border-b border-white/5 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedContact(null)} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center font-black text-blue-500 text-sm uppercase">
               {selectedContact.name[0]}
             </div>
             <div>
               <h3 className="font-black text-sm text-white italic">{selectedContact.name}</h3>
               <div className="flex items-center gap-1">
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                 <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Active Link</span>
               </div>
             </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <Phone size={18} className="cursor-not-allowed opacity-20" />
          <Camera size={20} className="cursor-not-allowed opacity-20" />
        </div>
      </header>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
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
            <p className="text-[10px] uppercase font-black tracking-widest">End-to-End Encrypted.<br/>Start the conversation.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderEmail === user.email;
            
            if (msg.type === 'location') {
              return (
                <div key={idx} className="flex justify-center my-6">
                  <div className="bg-blue-600 p-5 rounded-[2rem] w-full max-w-[280px] shadow-2xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-white/20 p-2 rounded-xl text-white"><Navigation size={18} /></div>
                      <span className="text-white text-[12px] font-black uppercase tracking-widest italic">Live Pinpoint</span>
                    </div>
                    <a 
                      href={`https://www.google.com/maps?q=${msg.lat},${msg.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 bg-white py-3.5 rounded-2xl text-blue-950 text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                    >
                      View on Map <ExternalLink size={12} />
                    </a>
                  </div>
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
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 bg-[#020617]/95 backdrop-blur-md border-t border-white/5 pb-10">
        <form onSubmit={sendMessage} className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <input 
              type="text" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Message Guardian..." 
              className="w-full bg-slate-900 border border-white/10 rounded-3xl px-6 py-4 text-sm text-white outline-none focus:border-blue-500 shadow-inner"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3 text-slate-600">
               <Activity size={18} className="cursor-pointer hover:text-blue-500 transition-colors" />
            </div>
          </div>
          <button 
            type="submit" 
            className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-600/20 active:scale-90 transition-all disabled:opacity-30"
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
