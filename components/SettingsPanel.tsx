
import { collection, getDocs, query, where } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, List, Mic, Search, ShieldCheck, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { AppSettings, EmergencyContact } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, updateSettings }) => {
  const [newContact, setNewContact] = useState({ name: '', email: '' });
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<'found' | 'not_found' | null>(null);

  const checkUserExists = async (inputEmail: string) => {
    const normalized = inputEmail.trim().toLowerCase();
    if (normalized.length < 5 || !normalized.includes('@')) {
      setLookupResult(null);
      return;
    }

    setIsSearching(true);
    setLookupResult(null);

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", normalized));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setLookupResult('found');
      } else {
        setLookupResult('not_found');
      }
    } catch (error) {
      console.error("[GuardianLink] Mesh lookup failed:", error);
      setLookupResult('not_found');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newContact.email) checkUserExists(newContact.email);
    }, 600);
    return () => clearTimeout(timer);
  }, [newContact.email]);

  const addContact = () => {
    if (newContact.name && newContact.email) {
      const isRegistered = lookupResult === 'found';
      const contact: EmergencyContact = {
        id: Date.now().toString(),
        name: newContact.name,
        phone: newContact.email.trim().toLowerCase(), // Reusing phone field for email ID
        isRegisteredUser: isRegistered
      };
      updateSettings({ contacts: [...settings.contacts, contact] });
      setNewContact({ name: '', email: '' });
      setLookupResult(null);
    }
  };

  const removeContact = (id: string) => {
    updateSettings({
      contacts: settings.contacts.filter((c: EmergencyContact) => c.id !== id)
    });
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
      <section className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500 shadow-sm"><Mic size={20} /></div>
          <h3 className="font-black text-[11px] uppercase tracking-[0.3em] text-slate-500 italic">Voice Intelligence</h3>
        </div>
        <div className="bg-slate-900/60 p-7 rounded-[3rem] border border-slate-800 shadow-2xl backdrop-blur-xl">
           <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Emergency Activation Phrase</p>
           <input 
            type="text" 
            value={settings.triggerPhrase}
            onChange={(e) => updateSettings({ triggerPhrase: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-7 py-5 text-sm font-black text-white focus:border-blue-500/50 shadow-inner outline-none transition-all"
          />
          <p className="text-[9px] text-slate-600 mt-4 italic font-medium leading-relaxed px-1">
            * Speak this phrase clearly. The Aegis Shield listens locally to trigger the Mesh SOS.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500 shadow-sm"><List size={20} /></div>
          <h3 className="font-black text-[11px] uppercase tracking-[0.3em] text-slate-500 italic">Guardian Mesh</h3>
        </div>

        <div className="bg-slate-900/60 p-8 rounded-[3.5rem] border border-slate-800 shadow-2xl space-y-6">
          <div className="space-y-1.5">
             <h4 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-3 italic">
               Link Friend <ShieldCheck size={18} className="text-blue-500"/>
             </h4>
             <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">Sync nodes by entering their Mesh Email</p>
          </div>

          <div className="space-y-4">
            <input 
              type="text" placeholder="Guardian Nickname" value={newContact.name}
              onChange={(e) => setNewContact(p => ({...p, name: e.target.value}))}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-5 text-sm text-white font-bold placeholder:text-slate-800 outline-none transition-all"
            />
            <div className="relative group">
              <input 
                type="email" placeholder="Mesh Email (e.g. friend@email.com)" value={newContact.email}
                onChange={(e) => setNewContact(p => ({...p, email: e.target.value}))}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-5 px-6 text-sm text-white font-black pr-14 outline-none transition-all tracking-wider"
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2">
                {isSearching ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : 
                 lookupResult === 'found' ? <CheckCircle2 size={20} className="text-green-500" /> :
                 lookupResult === 'not_found' ? <AlertCircle size={20} className="text-red-500" /> : <Search size={20} className="text-slate-800" />}
              </div>
            </div>
            
            <div className="min-h-[40px]">
              {lookupResult === 'not_found' && (
                <p className="text-[9px] text-red-400 font-black uppercase tracking-tight px-2">
                  Email not found in Mesh. Friend must enroll in Aegis first.
                </p>
              )}
            </div>

            <button 
              onClick={addContact} disabled={!newContact.name || !newContact.email || lookupResult !== 'found'}
              className="w-full bg-blue-600 py-5 rounded-[2rem] text-white font-black uppercase text-[11px] tracking-[0.2em] disabled:opacity-20 shadow-xl active:scale-95 transition-all"
            >
              Authorise Guardian
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] pl-4">Active Connections</h4>
          <div className="space-y-4">
            {settings.contacts.length === 0 ? (
              <div className="p-12 border-2 border-dashed border-slate-900 rounded-[3rem] text-center bg-slate-950/20">
                 <p className="text-[9px] font-black uppercase text-slate-800 tracking-[0.3em] italic">Mesh Nodes Offline</p>
              </div>
            ) : settings.contacts.map(c => (
              <div key={c.id} className="bg-slate-900/60 border border-slate-800 p-6 rounded-[2.5rem] flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg ${c.isRegisteredUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-600'}`}>
                    {c.name[0]}
                  </div>
                  <div>
                    <h5 className="text-md font-black flex items-center gap-2 text-white italic tracking-tighter">
                      {c.name} {c.isRegisteredUser && <CheckCircle2 size={14} className="text-blue-500" />}
                    </h5>
                    <p className="text-[10px] text-slate-500 font-black tracking-widest truncate max-w-[150px]">{c.phone}</p>
                  </div>
                </div>
                <button onClick={() => removeContact(c.id)} className="text-slate-700 hover:text-red-500 transition-colors p-3">
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsPanel;
