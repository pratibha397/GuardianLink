
import { AlertCircle, CheckCircle2, Mic, Search, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { db, doc, getDoc } from '../services/firebase';
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
    
    // Only search if it looks like a valid email
    if (normalized.length < 5 || !normalized.includes('@')) {
      setLookupResult(null);
      return;
    }

    setIsSearching(true);
    setLookupResult(null);

    try {
      // Lookup the user by their normalized email in the 'users' collection
      // Document IDs are consistent because AuthScreen lowercases them
      const userRef = doc(db, "users", normalized);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        setLookupResult('found');
        // Pre-fill the name if found
        if (!newContact.name.trim()) {
           setNewContact(prev => ({ ...prev, name: userSnap.data().name }));
        }
      } else {
        setLookupResult('not_found');
      }
    } catch (error) {
      console.warn("User lookup failed", error);
      setLookupResult('not_found');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newContact.email) {
        checkUserExists(newContact.email);
      } else {
        setLookupResult(null);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [newContact.email]);

  const addContact = () => {
    const cleanName = newContact.name.trim();
    const cleanEmail = newContact.email.trim().toLowerCase();

    if (cleanName && cleanEmail) {
      const contact: EmergencyContact = {
        id: `contact_${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        isRegisteredUser: lookupResult === 'found'
      };
      
      const currentContacts = Array.isArray(settings.contacts) ? settings.contacts : [];
      
      // Prevent duplicates
      if (currentContacts.some(c => c.email === cleanEmail)) {
        setNewContact({ name: '', email: '' });
        setLookupResult(null);
        return;
      }

      const updatedContacts = [...currentContacts, contact];
      updateSettings({ contacts: updatedContacts });
      
      // Reset input
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
            placeholder="e.g. Guardian, help me"
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
          <div className="relative">
             <input 
              type="email" placeholder="Guardian Email" value={newContact.email}
              onChange={(e) => setNewContact(p => ({...p, email: e.target.value}))}
              className={`w-full bg-slate-950 border rounded-2xl py-4 px-6 text-xs text-white font-bold pr-14 outline-none transition-colors ${lookupResult === 'found' ? 'border-green-500/50' : lookupResult === 'not_found' ? 'border-red-500/50' : 'border-white/5 focus:border-blue-500'}`}
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2">
              {isSearching ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : 
               lookupResult === 'found' ? <CheckCircle2 size={20} className="text-green-500" /> :
               lookupResult === 'not_found' ? <AlertCircle size={20} className="text-red-500" /> : <Search size={20} className="text-slate-800" />}
            </div>
          </div>

          <input 
            type="text" placeholder="Guardian Name" value={newContact.name}
            onChange={(e) => setNewContact(p => ({...p, name: e.target.value}))}
            className="w-full bg-slate-900 border border-white/5 rounded-2xl px-6 py-4 text-xs text-white font-bold outline-none focus:border-blue-500"
          />
          
          <button 
            onClick={addContact} 
            disabled={!newContact.name.trim() || !newContact.email.trim() || isSearching}
            className="w-full bg-blue-600 py-5 rounded-[2rem] text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-20 shadow-xl active:scale-95 transition-all"
          >
            Authorize Mesh Node
          </button>
          
          {lookupResult === 'not_found' && newContact.email && !isSearching && (
            <p className="text-[10px] text-red-400 font-bold uppercase text-center">User not found. They will receive SMS only.</p>
          )}
          {lookupResult === 'found' && (
             <p className="text-[10px] text-green-500 font-bold uppercase text-center flex items-center justify-center gap-2 italic">
               <ShieldCheck size={12} /> Verified Aegis Node
             </p>
          )}
        </div>

        <div className="space-y-4">
          {(settings.contacts || []).map(c => (
            <div key={c.id} className="bg-slate-900/40 border border-white/5 p-6 rounded-[2.5rem] flex items-center justify-between shadow-lg group">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg uppercase ${c.isRegisteredUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  {c.name ? c.name[0] : '?'}
                </div>
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
              <button onClick={() => removeContact(c.id)} className="text-slate-700 hover:text-red-500 transition-colors p-3 group-hover:scale-110 transition-transform">
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SettingsPanel;
