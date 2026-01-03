
import { CheckCircle2, List, Mic, Trash2, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { AppSettings, EmergencyContact } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, updateSettings }) => {
  const [newContact, setNewContact] = useState<{name: string; phone: string; isRegisteredUser: boolean}>({ 
    name: '', 
    phone: '', 
    isRegisteredUser: true 
  });

  const addContact = () => {
    if (newContact.name && newContact.phone) {
      const contact: EmergencyContact = {
        id: Date.now().toString(),
        name: newContact.name,
        phone: newContact.phone,
        isRegisteredUser: newContact.isRegisteredUser
      };
      updateSettings({ contacts: [...settings.contacts, contact] });
      setNewContact({ name: '', phone: '', isRegisteredUser: true });
    }
  };

  const removeContact = (id: string) => {
    updateSettings({
      contacts: settings.contacts.filter((c: EmergencyContact) => c.id !== id)
    });
  };

  const toggleRegistration = (id: string) => {
    updateSettings({
      contacts: settings.contacts.map(c => 
        c.id === id ? { ...c, isRegisteredUser: !c.isRegisteredUser } : c
      )
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Mic size={18} className="text-blue-500" />
          <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400">Detection Phrase</h3>
        </div>
        <div className="space-y-2">
          <input 
            type="text" 
            value={settings.triggerPhrase}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ triggerPhrase: e.target.value })}
            placeholder="e.g. Activate Rescue"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <p className="text-[10px] text-slate-500 px-1">
            Gemini AI will listen for this exact phrase to trigger an emergency broadcast.
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <List size={18} className="text-blue-500" />
          <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400">Guardian Network</h3>
        </div>
        
        <div className="space-y-3">
          {settings.contacts.map((contact: EmergencyContact) => (
            <div key={contact.id} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${contact.isRegisteredUser ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    {contact.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{contact.name}</h4>
                    <p className="text-xs text-slate-400">{contact.phone}</p>
                  </div>
                </div>
                <button onClick={() => removeContact(contact.id)} className="p-2 text-slate-500 hover:text-red-400 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
              <button 
                onClick={() => toggleRegistration(contact.id)}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                  contact.isRegisteredUser 
                    ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' 
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                <CheckCircle2 size={12} /> {contact.isRegisteredUser ? 'App Registered' : 'Legacy Contact'}
              </button>
            </div>
          ))}

          {settings.contacts.length === 0 && (
            <div className="py-8 text-center border-2 border-dashed border-slate-800 rounded-xl text-slate-500">
              <p className="text-sm">No guardians in your link.</p>
            </div>
          )}
        </div>

        <div className="mt-6 p-5 bg-blue-600/5 rounded-[2rem] border border-blue-500/20 space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
            <UserPlus size={14} /> Add Guardian
          </h4>
          <div className="space-y-2">
            <input 
              type="text" 
              placeholder="Name"
              value={newContact.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input 
              type="tel" 
              placeholder="Phone (e.g. +91...)"
              value={newContact.phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button 
            onClick={addContact}
            disabled={!newContact.name || !newContact.phone}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20"
          >
            Connect Guardian
          </button>
        </div>
      </section>
      
      <div className="pt-4 text-center">
         <p className="text-[10px] text-slate-500 italic uppercase font-bold tracking-widest">Local Security Config Active</p>
      </div>
    </div>
  );
};

export default SettingsPanel;
