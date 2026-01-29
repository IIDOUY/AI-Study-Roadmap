import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  isVisible: boolean;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const bgColors = {
    success: 'bg-gray-900 dark:bg-white text-white dark:text-gray-900',
    error: 'bg-red-600 text-white',
    info: 'bg-gray-800 text-white'
  };

  const icons = {
    success: <CheckCircle2 className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4" />,
    info: <Info className="w-4 h-4" />
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] animate-slide-up">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl ${bgColors[type]}`}>
        {icons[type]}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 p-1 hover:opacity-70 transition-opacity">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-slide-up {
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default Toast;