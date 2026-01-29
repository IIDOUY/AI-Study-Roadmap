import React, { useState } from 'react';
import { CreditCard, Lock, CheckCircle2, Loader2, X, ShieldCheck } from 'lucide-react';

interface PaymentModalProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ onSuccess, onCancel }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // Simulate API call
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }, 2000);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
      // Allow closing by clicking the background if not processing/success
      if (e.target === e.currentTarget && !isProcessing && !isSuccess) {
          onCancel();
      }
  };

  return (
    <div 
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleBackdropClick}
    >
      <div 
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-800 overflow-hidden relative"
          onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
           <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
             <ShieldCheck className="w-5 h-5 text-green-500" />
             Secure Checkout
           </h3>
           <button 
             type="button"
             onClick={onCancel} 
             disabled={isProcessing || isSuccess} 
             className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors disabled:opacity-50 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
           >
             <X className="w-5 h-5" />
           </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isSuccess ? (
             <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 text-green-500 rounded-full flex items-center justify-center mb-4">
                   <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h3>
                <p className="text-gray-500 dark:text-gray-400">Welcome to Cortexa Pro.</p>
             </div>
          ) : (
             <form onSubmit={handlePay} className="space-y-5">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
                   <div>
                      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Total Due</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">$1.00 <span className="text-sm font-medium text-gray-500">/ month</span></p>
                   </div>
                   <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm text-indigo-600">
                      <CreditCard className="w-5 h-5" />
                   </div>
                </div>

                <div className="space-y-4">
                   <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Card Number</label>
                      <div className="relative">
                         <input 
                           type="text" 
                           required
                           placeholder="0000 0000 0000 0000"
                           value={cardNumber}
                           onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                           maxLength={19}
                           className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                         />
                         <CreditCard className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Expiry</label>
                         <input 
                           type="text" 
                           required
                           placeholder="MM/YY"
                           value={expiry}
                           onChange={(e) => {
                             let v = e.target.value.replace(/[^0-9]/g, '');
                             if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2, 4);
                             setExpiry(v);
                           }}
                           maxLength={5}
                           className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                         />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">CVC</label>
                         <div className="relative">
                            <input 
                              type="text" 
                              required
                              placeholder="123"
                              value={cvc}
                              onChange={(e) => setCvc(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                              maxLength={4}
                              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                            />
                            <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                         </div>
                      </div>
                   </div>

                   <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Cardholder Name</label>
                      <input 
                        type="text" 
                        required
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                      />
                   </div>
                </div>

                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold hover:opacity-90 disabled:opacity-70 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {isProcessing ? (
                     <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                     </>
                  ) : (
                     <>
                        Pay $1.00
                     </>
                  )}
                </button>
                
                <p className="text-center text-[10px] text-gray-400 flex items-center justify-center gap-1 mt-2">
                   <Lock className="w-3 h-3" /> 
                   Encrypted & Secure Payment (Demo Mode)
                </p>
             </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;