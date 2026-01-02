import { Clock, ExternalLink, MapPin, MessageSquare, Trash2 } from 'lucide-react';
import React from 'react';
import { AlertLog } from '../types';

interface AlertHistoryProps {
  logs: AlertLog[];
  clearLogs: () => void;
}

const AlertHistory: React.FC<AlertHistoryProps> = ({ logs, clearLogs }) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400">Activity Logs</h3>
        {logs.length > 0 && (
          <button 
            onClick={clearLogs}
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-bold"
          >
            <Trash2 size={12} /> Clear All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {logs.map((log: AlertLog) => (
          <div key={log.id} className="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2 text-slate-300">
                <Clock size={14} className="text-blue-400" />
                <span className="text-xs font-medium">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="bg-red-500/10 text-red-500 px-2 py-1 rounded text-[10px] font-black uppercase">
                Alert Sent
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3">
                <MessageSquare size={16} className="text-slate-500 shrink-0 mt-1" />
                <div className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 italic leading-relaxed">
                  "{log.message}"
                </div>
              </div>

              <div className="flex gap-3">
                <MapPin size={16} className="text-slate-500 shrink-0" />
                <div className="text-xs text-slate-400">
                  {log.location ? (
                    <a 
                      href={`https://www.google.com/maps?q=${log.location.lat},${log.location.lng}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline flex items-center gap-1"
                    >
                      View Location Link <ExternalLink size={10} />
                    </a>
                  ) : 'Location unavailable'}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700/50">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Recipients</p>
                <div className="flex flex-wrap gap-2">
                  {log.recipients.map((r: string, i: number) => (
                    <span key={i} className="bg-slate-700/50 px-2 py-1 rounded text-[10px] text-slate-400">
                      {r}
                    </span>
                  ))}
                  {log.recipients.length === 0 && <span className="text-[10px] text-slate-600">No contacts configured</span>}
                </div>
              </div>
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <div className="py-20 text-center space-y-4 opacity-50">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
              <Clock size={32} className="text-slate-600" />
            </div>
            <div>
              <p className="font-bold">No activity history</p>
              <p className="text-xs mt-1">Recent triggers and alerts will appear here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertHistory;