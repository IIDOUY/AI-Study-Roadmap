import React, { useState } from 'react';
import { Key, ExternalLink, Check, X } from 'lucide-react';

interface ApiKeyModalProps {
  onSave: (key: string) => void;
  onCancel: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave, onCancel }) => {
  const [key, setKey] = useState('');

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
           <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
             <Key className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
             Configure API Key
           </h3>
           <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
             <X className="w-5 h-5" />
           </button>
        </div>
        
        <div className="p-6 space-y-4">
           <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-sm text-indigo-800 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
             <p>
               Cortexa requires a <strong>Google Gemini API Key</strong> to analyze your documents. The key is stored locally on your device.
             </p>
           </div>
           
           <div>
             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gemini API Key</label>
             <input 
               type="password" 
               value={key}
               onChange={(e) => setKey(e.target.value)}
               placeholder="AIzaSy..."
               className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
             />
           </div>

           <a 
             href="https://aistudio.google.com/app/apikey" 
             target="_blank" 
             rel="noopener noreferrer"
             className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
           >
             Get a free key from Google AI Studio <ExternalLink className="w-3 h-3" />
           </a>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
           <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
             Cancel
           </button>
           <button 
             onClick={() => onSave(key)}
             disabled={!key.trim()}
             className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-sm"
           >
             <Check className="w-4 h-4" />
             Save Key
           </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;