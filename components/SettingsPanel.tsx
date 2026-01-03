
import { AlertCircle, CheckCircle2, List, Mic, Search, Trash2 } from 'lucide-react';
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

  // Check registration status when phone number changes
  useEffect(() => {
    if (newContact.phone.length >= 8) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        const registry = JSON.parse(localStorage.getItem(GLOBAL_REGISTRY_KEY) || '[]');
        // Check if any registered user has this phone number (ignoring + prefix)
        const found = registry.some((u: any) => u.phone.includes(newContact.phone) || newContact.phone.includes(u.phone));
        setLookupResult(found ? 'found' : 'not_found');
        setIsSearching(false);
      }, 500);
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Mic size={18} className="text-blue-500" />
          <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400">Trigger Config</h3>
        </div>
        <input 
          type="text" 
          value={settings.triggerPhrase}
          onChange={(e) => updateSettings({ triggerPhrase: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <List size={18} className="text-blue-500" />
          <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400">Guardian Network</h3>
        </div>

        <div className="bg-blue-600/5 p-6 rounded-[2.5rem] border border-blue-500/20 space-y-4">
          <h4 className="text-[10px] font-black uppercase text-blue-400">Add New Connection</h4>
          <input 
            type="text" placeholder="Guardian Name" value={newContact.name}
            onChange={(e) => setNewContact(p => ({...p, name: e.target.value}))}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm"
          />
          <div className="relative">
            <input 
              type="tel" placeholder="Phone Number" value={newContact.phone}
              onChange={(e) => setNewContact(p => ({...p, phone: e.target.value}))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm pr-10"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isSearching ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : 
               lookupResult === 'found' ? <CheckCircle2 size={18} className="text-green-500" /> :
               lookupResult === 'not_found' ? <AlertCircle size={18} className="text-red-500" /> : <Search size={18} className="text-slate-700" />}
            </div>
          </div>
          
          {lookupResult === 'not_found' && (
            <p className="text-[9px] text-red-400 font-bold uppercase tracking-tight">
              Notice: This number is NOT registered on Guardian Link. They cannot receive live alerts.
            </p>
          )}
          {lookupResult === 'found' && (
            <p className="text-[9px] text-green-400 font-bold uppercase tracking-tight">
              Verified: This user is part of the Guardian Network.
            </p>
          )}

          <button 
            onClick={addContact} disabled={!newContact.name || !newContact.phone}
            className="w-full bg-blue-600 py-3 rounded-xl text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
          >
            Authorize Guardian
          </button>
        </div>

        <div className="space-y-3">
          {settings.contacts.map(c => (
            <div key={c.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${c.isRegisteredUser ? 'bg-blue-600' : 'bg-slate-800'}`}>
                  {c.name[0]}
                </div>
                <div>
                  <h5 className="text-sm font-bold flex items-center gap-2">
                    {c.name} {c.isRegisteredUser && <CheckCircle2 size={12} className="text-blue-500" />}
                  </h5>
                  <p className="text-[10px] text-slate-500 font-bold">{c.phone}</p>
                </div>
              </div>
              <button onClick={() => removeContact(c.id)} className="text-slate-600 hover:text-red-500 transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SettingsPanel;
