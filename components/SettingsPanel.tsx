
import { AlertCircle, CheckCircle2, List, Mic, Search, ShieldCheck, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AppSettings, EmergencyContact } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
}

const GLOBAL_REGISTRY_KEY = 'guardian_link_global_users';

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, updateSettings }) => {
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<'found' | 'not_found' | null>(null);

  /**
   * Standardized Normalization:
   * 1. Remove all non-numeric characters.
   * 2. Take the last 10 digits to ensure consistency between +91..., 0..., and raw numbers.
   */
  const normalizeForLookup = (p: string) => {
    const digits = p.replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };

  useEffect(() => {
    const searchPhone = normalizeForLookup(newContact.phone);
    if (searchPhone.length >= 10) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        const registry = JSON.parse(localStorage.getItem(GLOBAL_REGISTRY_KEY) || '[]');
        // Use the same normalization logic on the registry data
        const found = registry.some((u: any) => normalizeForLookup(u.phone) === searchPhone);
        setLookupResult(found ? 'found' : 'not_found');
        setIsSearching(false);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setLookupResult(null);
    }
  }, [newContact.phone]);

  const addContact = () => {
    if (newContact.name && newContact.phone) {
      const isRegistered = lookupResult === 'found';
      const contact: EmergencyContact = {
        id: Date.now().toString(),
        name: newContact.name,
        phone: newContact.phone,
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
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <section className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500 shadow-sm"><Mic size={20} /></div>
          <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-500">Intelligent Trigger</h3>
        </div>
        <div className="bg-slate-900/60 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl backdrop-blur-md">
           <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3">Custom Emergency Phrase</p>
           <input 
            type="text" 
            value={settings.triggerPhrase}
            onChange={(e) => updateSettings({ triggerPhrase: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all shadow-inner"
          />
          <p className="text-[9px] text-slate-600 mt-3 italic font-medium leading-relaxed px-1">
            * Guardian AI monitors audio and triggers an alert if this phrase is detected.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500 shadow-sm"><List size={20} /></div>
          <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-500">Safety Network</h3>
        </div>

        <div className="bg-slate-900/60 p-7 rounded-[3rem] border border-slate-800 shadow-2xl space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none scale-150"><ShieldCheck size={80} /></div>
          
          <div className="space-y-1">
             <h4 className="text-xs font-black uppercase text-white tracking-widest">Verify & Link Guardian</h4>
             <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Enter number to check network status</p>
          </div>

          <div className="space-y-4">
            <input 
              type="text" placeholder="Contact Name" value={newContact.name}
              onChange={(e) => setNewContact(p => ({...p, name: e.target.value}))}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white font-bold placeholder:text-slate-700 shadow-inner outline-none focus:border-slate-600 transition-colors"
            />
            <div className="relative group">
              <input 
                type="tel" placeholder="Phone (with Country Code)" value={newContact.phone}
                onChange={(e) => setNewContact(p => ({...p, phone: e.target.value}))}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white font-bold placeholder:text-slate-700 pr-12 shadow-inner outline-none focus:border-slate-600 transition-colors"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {isSearching ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : 
                 lookupResult === 'found' ? <CheckCircle2 size={22} className="text-green-500 animate-in zoom-in" /> :
                 lookupResult === 'not_found' ? <AlertCircle size={22} className="text-red-500 animate-in zoom-in" /> : <Search size={22} className="text-slate-800" />}
              </div>
            </div>
            
            <div className="min-h-[44px]">
              {lookupResult === 'not_found' && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
                  <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-400 font-bold uppercase tracking-tight leading-normal">
                    User Not Found: They are not registered on Guardian Link. They cannot receive live maps or intercept feeds.
                  </p>
                </div>
              )}
              {lookupResult === 'found' && (
                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
                  <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-green-500 font-bold uppercase tracking-tight leading-normal">
                    Verified Guardian: Secure link detected. This contact will receive your live GPS coordinates immediately if an alert is triggered.
                  </p>
                </div>
              )}
            </div>

            <button 
              onClick={addContact} disabled={!newContact.name || !newContact.phone || lookupResult !== 'found'}
              className="w-full bg-blue-600 py-4 rounded-2xl text-white font-black uppercase text-[11px] tracking-[0.2em] disabled:opacity-20 disabled:grayscale shadow-[0_15px_30px_rgba(37,99,235,0.3)] hover:bg-blue-500 active:scale-95 transition-all"
            >
              Confirm Guardian
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] pl-2">Network Mesh</h4>
          <div className="space-y-3">
            {settings.contacts.length === 0 && (
              <div className="p-12 border-2 border-dashed border-slate-900 rounded-[3rem] text-center bg-slate-900/20">
                 <p className="text-[10px] font-black uppercase text-slate-700 tracking-widest leading-relaxed">Network Empty • Add verified guardians to enable protection</p>
              </div>
            )}
            {settings.contacts.map(c => (
              <div key={c.id} className="bg-slate-900/60 border border-slate-800 p-5 rounded-[2.5rem] flex items-center justify-between group hover:border-slate-700 transition-all shadow-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center font-black shadow-xl ${c.isRegisteredUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-600'}`}>
                    {c.name[0]}
                  </div>
                  <div>
                    <h5 className="text-base font-black flex items-center gap-2 text-white italic tracking-tighter">
                      {c.name} {c.isRegisteredUser && <div className="p-0.5 bg-blue-500/20 rounded-full border border-blue-500/30"><CheckCircle2 size={12} className="text-blue-500" /></div>}
                    </h5>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{c.phone}</p>
                  </div>
                </div>
                <button onClick={() => removeContact(c.id)} className="text-slate-700 hover:text-red-500 transition-colors p-3 bg-slate-950/50 rounded-2xl shadow-inner active:scale-90">
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
