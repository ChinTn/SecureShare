import React from 'react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', isDangerous = true }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm p-4 font-sans transition-colors duration-300 animate-fade-in">
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl relative transition-colors text-center">
                
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 border ${isDangerous ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-500' : 'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20 text-orange-600 dark:text-orange-500'}`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                
                <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase mb-2">{title}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 font-medium leading-relaxed">
                    {message}
                </p>

                <div className="flex gap-3 w-full">
                    <button 
                        onClick={onCancel}
                        className="flex-1 px-5 py-3.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all border border-gray-200 dark:border-white/10"
                    >
                        {cancelText}
                    </button>
                    <button 
                        onClick={onConfirm}
                        className={`flex-1 px-5 py-3.5 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md ${isDangerous ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
