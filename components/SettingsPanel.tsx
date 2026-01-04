
import React, { useEffect, useState } from 'react';
// Added Shield to the lucide-react imports to fix the "Cannot find name 'Shield'" error on line 151
import { AlertCircle, CheckCircle2, Mic, Search, Shield, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
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

  // Hardened verification for Mesh Nodes
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
      console.warn("User fetch failed", error);
      setLookupResult('not_found');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newContact.email) checkUserExists(newContact.email);
    }, 1000);
    return () => clearTimeout(timer);
  }, [newContact.email]);

  const addContact = () => {
    if (newContact.name.trim() && newContact.email.trim()) {
      const contact: EmergencyContact = {
        id: Date.now().toString(),
        name: newContact.name.trim(),
        email: newContact.email.trim().toLowerCase(),
        isRegisteredUser: lookupResult === 'found'
      };
      
      // CRITICAL FIX: Ensure we spread the existing array to prevent erasure
      const currentContacts = Array.isArray(settings.contacts) ? settings.contacts : [];
      const updatedContacts = [...currentContacts, contact];
      
      updateSettings({ contacts: updatedContacts });
      
      // Reset
      setNewContact({ name: '', email: '' });
      setLookupResult(null);
    }
  };

  const removeContact = (id: string) => {
    const currentContacts = Array.isArray(settings.contacts) ? settings.contacts : [];
    const filtered = currentContacts.filter((c) => c.id !== id);
    updateSettings({ contacts: filtered });
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700 pb-10">
      <section className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500"><Mic size={18} /></div>
          <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-500 italic">Panic Phrase</h3>
        </div>
        <div className="bg-slate-950 p-7 rounded-[2.5rem] border border-white/5 shadow-inner">
           <input 
            type="text" 
            value={settings.triggerPhrase}
            onChange={(e) => updateSettings({ triggerPhrase: e.target.value })}
            className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-6 py-5 text-sm font-black text-white focus:border-blue-500 outline-none"
          />
          <p className="text-[9px] text-slate-600 mt-4 font-bold uppercase tracking-widest">Say this to trigger the mesh SOS.</p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500"><UserPlus size={18} /></div>
          <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-500 italic">Guardian Management</h3>
        </div>

        <div className="bg-slate-950 p-8 rounded-[3rem] border border-white/5 space-y-5 shadow-2xl">
          <input 
            type="text" placeholder="Guardian Name" value={newContact.name}
            onChange={(e) => setNewContact(p => ({...p, name: e.target.value}))}
            className="w-full bg-slate-900 border border-white/5 rounded-2xl px-6 py-4 text-xs text-white font-bold outline-none focus:border-blue-500"
          />
          <div className="relative">
            <input 
              type="email" placeholder="Guardian Email" value={newContact.email}
              onChange={(e) => setNewContact(p => ({...p, email: e.target.value}))}
              className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 px-6 text-xs text-white font-bold pr-14 outline-none focus:border-blue-500"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2">
              {isSearching ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : 
               lookupResult === 'found' ? <CheckCircle2 size={20} className="text-green-500" /> :
               lookupResult === 'not_found' ? <AlertCircle size={20} className="text-red-500" /> : <Search size={20} className="text-slate-800" />}
            </div>
          </div>
          
          <button 
            onClick={addContact} disabled={!newContact.name.trim() || !newContact.email.trim()}
            className="w-full bg-blue-600 py-5 rounded-[2rem] text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-20 shadow-xl active:scale-95 transition-all"
          >
            Authorize Mesh Node
          </button>
        </div>

        <div className="space-y-4">
          {(settings.contacts || []).map(c => (
            <div key={c.id} className="bg-slate-900/40 border border-white/5 p-6 rounded-[2.5rem] flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center font-black text-lg text-slate-500 uppercase">{c.name[0]}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-[14px] font-black text-white italic">{c.name}</h5>
                    {c.isRegisteredUser ? (
                      <span className="bg-green-500/10 text-green-500 text-[7px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border border-green-500/20">
                        <ShieldCheck size={10} /> Verified
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-600 text-[7px] font-black uppercase px-2 py-0.5 rounded-full">
                        External SMS
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-1">{c.email}</p>
                </div>
              </div>
              <button onClick={() => removeContact(c.id)} className="text-slate-700 hover:text-red-500 transition-colors p-3"><Trash2 size={20} /></button>
            </div>
          ))}
          {(!settings.contacts || settings.contacts.length === 0) && (
            <div className="text-center py-16 opacity-10">
              <Shield size={64} className="mx-auto mb-4" />
              <p className="text-[10px] uppercase font-bold tracking-[0.5em]">Network Isolated</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default SettingsPanel;
