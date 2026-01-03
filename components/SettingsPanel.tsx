
import { AlertCircle, CheckCircle2, List, Mic, Search, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { collection, db, getDocs, query, where } from '../services/firebase';
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
      const q = query(collection(db, "users"), where("email", "==", normalized));
      const snap = await getDocs(q);
      setLookupResult(snap.empty ? 'not_found' : 'found');
    } catch (error) {
      setLookupResult('not_found');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newContact.email) checkUserExists(newContact.email);
    }, 800);
    return () => clearTimeout(timer);
  }, [newContact.email]);

  const addContact = () => {
    if (newContact.name && newContact.email) {
      const contact: EmergencyContact = {
        id: Date.now().toString(),
        name: newContact.name,
        email: newContact.email.trim().toLowerCase(),
        isRegisteredUser: lookupResult === 'found'
      };
      updateSettings({ contacts: [...settings.contacts, contact] });
      setNewContact({ name: '', email: '' });
      setLookupResult(null);
    }
  };

  const removeContact = (id: string) => {
    updateSettings({ contacts: settings.contacts.filter((c) => c.id !== id) });
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700 pb-10">
      <section className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-sky-500/10 rounded-xl text-sky-500"><Mic size={18} /></div>
          <h3 className="font-black text-[11px] uppercase tracking-[0.3em] text-slate-500 italic">Activation Phrase</h3>
        </div>
        <div className="bg-slate-950 p-7 rounded-[2.5rem] border border-white/5 shadow-2xl">
           <input 
            type="text" 
            value={settings.triggerPhrase}
            onChange={(e) => updateSettings({ triggerPhrase: e.target.value })}
            className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-6 py-5 text-sm font-black text-white focus:border-sky-500 outline-none transition-all"
          />
          <p className="text-[9px] text-slate-700 mt-4 italic font-bold leading-relaxed px-1">
            * Say this to trigger a mesh-wide emergency broadcast.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-sky-500/10 rounded-xl text-sky-500"><List size={18} /></div>
          <h3 className="font-black text-[11px] uppercase tracking-[0.3em] text-slate-500 italic">Guardian Node</h3>
        </div>

        <div className="bg-slate-950 p-8 rounded-[3rem] border border-white/5 shadow-2xl space-y-6">
          <div className="space-y-4">
            <input 
              type="text" placeholder="Guardian Name" value={newContact.name}
              onChange={(e) => setNewContact(p => ({...p, name: e.target.value}))}
              className="w-full bg-slate-900 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white font-bold outline-none"
            />
            <div className="relative">
              <input 
                type="email" placeholder="Mesh Email ID" value={newContact.email}
                onChange={(e) => setNewContact(p => ({...p, email: e.target.value}))}
                className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 px-6 text-sm text-white font-bold pr-14 outline-none"
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2">
                {isSearching ? <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /> : 
                 lookupResult === 'found' ? <CheckCircle2 size={18} className="text-green-500" /> :
                 lookupResult === 'not_found' ? <AlertCircle size={18} className="text-red-500" /> : <Search size={18} className="text-slate-800" />}
              </div>
            </div>
            
            <button 
              onClick={addContact} disabled={!newContact.name || !newContact.email}
              className="w-full bg-sky-500 py-4 rounded-2xl text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-20 shadow-xl"
            >
              Add Node
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {settings.contacts.map(c => (
            <div key={c.id} className="bg-slate-900/40 border border-white/5 p-5 rounded-[2rem] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-slate-400">{c.name[0]}</div>
                <div>
                  <h5 className="text-sm font-black text-white italic">{c.name}</h5>
                  <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{c.email}</p>
                </div>
              </div>
              <button onClick={() => removeContact(c.id)} className="text-slate-700 hover:text-red-500 transition-colors p-2"><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SettingsPanel;
