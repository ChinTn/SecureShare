import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const AuditLogs = () => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await axios.get('/api/audit?limit=10');
                setLogs(res.data.logs);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    // This function translates raw database logs into your specific human-readable sentences!
    const translateLog = (log) => {
        const fileName = log.file?.originalName || 'an unknown file';
        
        switch (log.action) {
            case 'LOGIN': return `✅ You logged in from IP ${log.ipAddress}`;
            case 'LOGOUT': return `✅ You logged out from IP ${log.ipAddress}`;
            case 'FAILED_LOGIN': return `⚠️ Failed login attempt from IP ${log.ipAddress}`;
            case 'FILE_UPLOAD': return `✅ You uploaded ${fileName}`;
            case 'FILE_DOWNLOAD': 
                if (log.details && log.details.includes('Share link accessed')) {
                    return `✅ Someone downloaded your shared file: ${fileName}`;
                }
                if (log.details && log.details.includes('You downloaded a file shared by someone else')) {
                    return `✅ You downloaded a file shared by someone else: ${fileName}`;
                }
                return `✅ You downloaded ${fileName}`;
            case 'FILE_DELETE': return `🗑️ You deleted ${fileName}`;
            case 'SHARE': return `✅ You shared ${fileName} with ${log.details.replace('Created share link for receiver: ', '')}`;
            case 'REVOKE_SHARE': return `✅ You revoked access to ${fileName}`;
            case 'INTEGRITY_FAIL': return `⚠️ Tampered file detected: ${fileName}`;
            default: return null; // We hide internal server actions!
        }
    };

    return (
        <div className="min-h-screen p-4 sm:p-8 pb-20 transition-colors duration-300 animate-fade-in">
            <div className="max-w-6xl mx-auto space-y-8 relative z-10">
                
                {/* Navigation & Header */}
                <div className="flex flex-col xl:flex-row justify-between items-center bg-white dark:bg-[#252525] border border-gray-200 dark:border-white/10 p-6 rounded-2xl shadow-sm transition-colors gap-6 xl:gap-0">
                    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 w-full xl:w-auto">
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase text-center md:text-left">
                            Secure<span className="text-orange-500">Share</span>
                        </h1>
                        <nav className="flex flex-wrap justify-center gap-4 text-sm font-semibold tracking-wide uppercase">
                            <Link to="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">My Vault</Link>
                            <Link to="/shared" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">Shared Hub</Link>
                            <span className="text-gray-900 dark:text-white border-b-2 border-orange-500 pb-1">Security Logs</span>
                            <Link to="/settings" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">Settings</Link>
                        </nav>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-6 w-full xl:w-auto justify-center">
                        {/* Theme Toggle Button */}
                        <button onClick={toggleTheme} className="p-2 text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">
                            {theme === 'dark' ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                            )}
                        </button>

                        <div className="text-right hidden sm:block">
                            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">
                                Logged in as
                            </p>
                            <p className="font-mono text-sm text-gray-900 dark:text-white">
                                {user?.email}
                            </p>
                        </div>
                        <button onClick={logout} className="px-5 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-red-50 text-red-600 dark:text-red-400 hover:text-red-700 font-bold rounded-lg transition-all text-sm uppercase tracking-wider">
                            Lock Vault
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden transition-colors">
                    <div className="p-8 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-transparent">
                        <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase flex items-center gap-3">
                            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.965 11.965 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                            Security Activity
                        </h2>
                    </div>

                    <div className="p-6">
                        {loading ? (
                            <div className="p-16 text-center text-gray-400 font-medium animate-pulse">Loading logs...</div>
                        ) : (
                            <div className="space-y-4 max-w-4xl mx-auto">
                                {logs.map(log => {
                                    const message = translateLog(log);
                                    if (!message) return null; // Hides stuff we don't want to show!
                                    
                                    const isWarning = log.action === 'FAILED_LOGIN' || log.action === 'INTEGRITY_FAIL';
                                    
                                    return (
                                        <div key={log._id} className={`p-5 rounded-xl border transition-colors ${isWarning ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-500/30' : 'bg-gray-50 dark:bg-[#1a1a1a] border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10'}`}>
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                                <div className="flex items-center gap-3">
                                                    <span className={`flex-shrink-0 w-2 h-2 rounded-full ${isWarning ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                                                    <span className={`font-medium ${isWarning ? 'text-red-700 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>{message}</span>
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:text-right shrink-0">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {logs.length === 0 && (
                                    <div className="p-16 text-center">
                                        <p className="text-gray-500 dark:text-gray-400 font-medium">No activity recorded yet.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuditLogs;