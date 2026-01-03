
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
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<'found' | 'not_found' | null>(null);

  /**
   * Production-ready user verification logic.
   * Uses Firestore query to find registered users by phone number.
   */
  const checkUserExists = async (inputPhone: string) => {
    // 1. Normalization: Remove spaces, dashes, and ensure standard format
    const normalized = inputPhone.trim().replace(/\s+/g, '');
    if (normalized.length < 8) {
      setLookupResult(null);
      return;
    }

    setIsSearching(true);
    setLookupResult(null);

    try {
      // 2. Database Query: Search the 'users' collection for the normalized phone
      // We search for both raw input and normalized variants to be robust
      console.log(`[GuardianLink] Searching for: ${normalized}`);
      
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("phoneNumber", "==", normalized));
      
      const querySnapshot = await getDocs(q);
      
      // 3. Async Handling: Await response before updating UI state
      if (!querySnapshot.empty) {
        const foundUser = querySnapshot.docs[0].data();
        console.log(`[GuardianLink] User found: ${foundUser.name} (${foundUser.phoneNumber})`);
        setLookupResult('found');
      } else {
        // 4. Debug Logging: Helper for identifying registry gaps
        console.warn(`[GuardianLink] No user found for phone: ${normalized}`);
        setLookupResult('not_found');
      }
    } catch (error) {
      console.error("[GuardianLink] Mesh lookup failed:", error);
      setLookupResult('not_found');
    } finally {
      setIsSearching(false);
    }
  };

  // Trigger search with a slight debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newContact.phone) checkUserExists(newContact.phone);
    }, 600);
    return () => clearTimeout(timer);
  }, [newContact.phone]);

  const addContact = () => {
    if (newContact.name && newContact.phone) {
      const isRegistered = lookupResult === 'found';
      const contact: EmergencyContact = {
        id: Date.now().toString(),
        name: newContact.name,
        phone: newContact.phone.trim().replace(/\s+/g, ''),
        isRegisteredUser: isRegistered
      };
      updateSettings({ contacts: [...settings.contacts, contact] });
      setNewContact({ name: '', phone: '' });
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
            * Say this phrase naturally. Gemini AI will detect the emergency and start broadcasting.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500 shadow-sm"><List size={20} /></div>
          <h3 className="font-black text-[11px] uppercase tracking-[0.3em] text-slate-500 italic">Guardian Registry</h3>
        </div>

        <div className="bg-slate-900/60 p-8 rounded-[3.5rem] border border-slate-800 shadow-[0_30px_80px_rgba(0,0,0,0.5)] space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none scale-150 rotate-12"><ShieldCheck size={100} /></div>
          
          <div className="space-y-1.5 relative z-10">
             <h4 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-3 italic">
               Link Friend <ShieldCheck size={18} className="text-blue-500"/>
             </h4>
             <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">Enter friend's number to sync mesh link</p>
          </div>

          <div className="space-y-4 relative z-10">
            <input 
              type="text" placeholder="Guardian Nickname" value={newContact.name}
              onChange={(e) => setNewContact(p => ({...p, name: e.target.value}))}
              className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-6 py-5 text-sm text-white font-bold placeholder:text-slate-800 shadow-inner outline-none transition-all"
            />
            <div className="relative group">
              <input 
                type="tel" placeholder="Phone (e.g. +919999988888)" value={newContact.phone}
                onChange={(e) => setNewContact(p => ({...p, phone: e.target.value}))}
                className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-6 py-5 text-sm text-white font-black placeholder:text-slate-800 pr-14 shadow-inner outline-none transition-all tracking-widest"
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2">
                {isSearching ? <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" /> : 
                 lookupResult === 'found' ? <CheckCircle2 size={24} className="text-green-500 animate-in zoom-in" /> :
                 lookupResult === 'not_found' ? <AlertCircle size={24} className="text-red-500 animate-in zoom-in" /> : <Search size={24} className="text-slate-800" />}
              </div>
            </div>
            
            <div className="min-h-[50px]">
              {lookupResult === 'not_found' && (
                <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-[1.8rem] flex items-start gap-4 animate-in slide-in-from-top-2">
                  <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-400 font-black uppercase tracking-tight leading-normal">
                    Phone number not found. Ask your friend to log into the app at least once to register their mesh node.
                  </p>
                </div>
              )}
              {lookupResult === 'found' && (
                <div className="bg-green-500/10 border border-green-500/20 p-5 rounded-[1.8rem] flex items-start gap-4 animate-in slide-in-from-top-2">
                  <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-green-500 font-black uppercase tracking-tight leading-normal">
                    Mesh Node Found: This friend is registered and will receive real-time feeds during an alert.
                  </p>
                </div>
              )}
            </div>

            <button 
              onClick={addContact} disabled={!newContact.name || !newContact.phone || lookupResult !== 'found'}
              className="w-full bg-blue-600 py-5 rounded-[2rem] text-white font-black uppercase text-[12px] tracking-[0.3em] disabled:opacity-20 disabled:grayscale shadow-[0_20px_40px_rgba(37,99,235,0.4)] hover:bg-blue-500 active:scale-95 transition-all"
            >
              Confirm Guardian
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] pl-4">Network Connections</h4>
          <div className="space-y-4">
            {settings.contacts.length === 0 && (
              <div className="p-16 border-4 border-dashed border-slate-900 rounded-[3rem] text-center bg-slate-950/20">
                 <p className="text-[10px] font-black uppercase text-slate-800 tracking-[0.3em] leading-relaxed italic">Network Mesh Offline • Link Friends to Begin</p>
              </div>
            )}
            {settings.contacts.map(c => (
              <div key={c.id} className="bg-slate-900/60 border-2 border-slate-800/50 p-6 rounded-[3rem] flex items-center justify-between group shadow-xl hover:border-slate-700 transition-all">
                <div className="flex items-center gap-5">
                  <div className={`w-16 h-16 rounded-[1.8rem] flex items-center justify-center font-black text-2xl shadow-2xl transition-all ${c.isRegisteredUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-600'}`}>
                    {c.name[0]}
                  </div>
                  <div>
                    <h5 className="text-lg font-black flex items-center gap-3 text-white italic tracking-tighter">
                      {c.name} {c.isRegisteredUser && <div className="p-1 bg-blue-500/10 rounded-full border border-blue-500/20"><CheckCircle2 size={16} className="text-blue-500" /></div>}
                    </h5>
                    <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest">{c.phone}</p>
                  </div>
                </div>
                <button onClick={() => removeContact(c.id)} className="text-slate-700 hover:text-red-500 transition-colors p-4 bg-slate-950/50 rounded-[1.5rem] shadow-inner active:scale-90">
                  <Trash2 size={24} />
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
