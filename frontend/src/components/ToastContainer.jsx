import React, { useState, useEffect } from 'react';

const ToastContainer = () => {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const handleToast = (e) => {
            const id = Date.now() + Math.random();
            setToasts(prev => [...prev, { ...e.detail, id }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 3500);
        };
        window.addEventListener('toast', handleToast);
        return () => window.removeEventListener('toast', handleToast);
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className={`pointer-events-auto min-w-[300px] max-w-sm px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-xl transition-all duration-300 transform translate-y-0 opacity-100 ${t.type === 'error' ? 'bg-red-50 dark:bg-red-950/90 border-red-200 dark:border-red-500/30' : t.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-500/30' : 'bg-white dark:bg-[#1a1a1a]/90 border-gray-200 dark:border-white/10'}`}>
                    <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
                            {t.type === 'error' ? (
                                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            ) : t.type === 'success' ? (
                                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            ) : (
                                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            )}
                        </div>
                        <div className="flex-1">
                            <h4 className={`text-sm font-bold uppercase tracking-wide mb-0.5 ${t.type === 'error' ? 'text-red-800 dark:text-red-200' : t.type === 'success' ? 'text-emerald-800 dark:text-emerald-200' : 'text-gray-900 dark:text-white'}`}>
                                {t.type === 'error' ? 'Error' : t.type === 'success' ? 'Success' : 'Notification'}
                            </h4>
                            <p className={`text-xs font-medium leading-relaxed ${t.type === 'error' ? 'text-red-600 dark:text-red-300' : t.type === 'success' ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                {t.message}
                            </p>
                        </div>
                        <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="shrink-0 p-1 opacity-50 hover:opacity-100 transition-opacity">
                            <svg className={`w-4 h-4 ${t.type === 'error' ? 'text-red-800 dark:text-red-200' : t.type === 'success' ? 'text-emerald-800 dark:text-emerald-200' : 'text-gray-900 dark:text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
