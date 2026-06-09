import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { calculateIntegrityHash, decryptFile } from '../utils/crypto';
import { Link } from 'react-router-dom';
import { toast } from '../utils/toast';
import ConfirmModal from '../components/ConfirmModal';

const SharedHub = () => {
    const { user, privateKey, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    
    // Tab State
    const [activeTab, setActiveTab] = useState('received'); // 'received' or 'sent'
    
    // Data States
    const [receivedShares, setReceivedShares] = useState([]);
    const [sentShares, setSentShares] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [revokeConfirmToken, setRevokeConfirmToken] = useState(null);

    useEffect(() => {
        if (activeTab === 'received') {
            fetchReceivedShares();
        } else {
            fetchSentShares();
        }
    }, [activeTab]);

    const fetchReceivedShares = async () => {
        try {
            setLoading(true);
            const res = await axios.get('http://localhost:5000/api/share/shared-with-me');
            setReceivedShares(res.data.shares || []);
        } catch (error) {
            console.error("Failed to fetch received shares", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSentShares = async () => {
        try {
            setLoading(true);
            const res = await axios.get('http://localhost:5000/api/share/my-shares');
            setSentShares(res.data.shares || []);
        } catch (error) {
            console.error("Failed to fetch sent shares", error);
        } finally {
            setLoading(false);
        }
    };
    
    //This is for the BOB to download the shared file ONLY
    const handleDownload = async (share) => {
        try {
            setStatusMessage(`Fetching shared blob for ${share.file.originalName}...`);
            
            const res = await axios.get(`http://localhost:5000/api/share/${share.shareToken}`);
            const { encryptedData, encryptedAESKeyForReceiver, iv, authTag, integrityHash, mimeType, originalName } = res.data;

            setStatusMessage(`Decrypting Bob-specific padlock...`);

            const decryptedBuffer = await decryptFile(
                encryptedData,
                encryptedAESKeyForReceiver, 
                iv,
                authTag,
                privateKey 
            );

            const newHash = await calculateIntegrityHash(decryptedBuffer);
            if (newHash !== integrityHash) {
                //send to the backend so it can log it
                await axios.post('http://localhost:5000/api/audit/integrity', { 
                    fileId: share.file._id,
                    details: `Tampered file detected: ${share.file.originalName}`
                });
                toast.error("WARNING: File integrity check failed! The file may have been corrupted or tampered with.");
                setStatusMessage('');
                return;
            }

            setStatusMessage('Decryption successful! Saving file...');

            const blob = new Blob([decryptedBuffer], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = originalName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            setStatusMessage('');

        } catch (error) {
            console.error("Download error:", error);
            toast.error(error.response?.data?.message || "Failed to download or decrypt file. The link may have expired.");
            setStatusMessage('');
        }
    };

    const handleRevoke = async () => {
        if (!revokeConfirmToken) return;
        const shareToken = revokeConfirmToken;
        
        try {
            setStatusMessage('Revoking access...');
            await axios.delete(`http://localhost:5000/api/share/${shareToken}`);
            
            // Update the UI
            setSentShares(sentShares.map(share => 
                share.shareToken === shareToken ? { ...share, isRevoked: true } : share
            ));
            
            setStatusMessage('Access Revoked Successfully!');
            setTimeout(() => setStatusMessage(''), 3000);
        } catch (error) {
            console.error("Revoke error:", error);
            toast.error(error.response?.data?.message || "Failed to revoke share.");
            setStatusMessage('');
        } finally {
            setRevokeConfirmToken(null);
        }
    };

    return (
        <div className="min-h-screen p-8 pb-20 transition-colors duration-300 animate-fade-in">
            <ConfirmModal
                isOpen={!!revokeConfirmToken}
                title="Revoke Share Access?"
                message="Are you sure you want to revoke this share link? The recipient will instantly lose access."
                confirmText="Yes, Revoke"
                onConfirm={handleRevoke}
                onCancel={() => setRevokeConfirmToken(null)}
            />
            <div className="max-w-6xl mx-auto space-y-8 relative z-10">
                
                {/* Navigation & Header */}
                <div className="flex justify-between items-center bg-white dark:bg-[#252525] border border-gray-200 dark:border-white/10 p-6 rounded-2xl shadow-sm transition-colors">
                    <div className="flex items-center gap-6">
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase">
                            Secure<span className="text-orange-500">Share</span>
                        </h1>
                        <nav className="flex gap-4 text-sm font-semibold tracking-wide uppercase">
                            <Link to="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">My Vault</Link>
                            <span className="text-gray-900 dark:text-white border-b-2 border-orange-500 pb-1">Shared Hub</span>
                            <Link to="/audit" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">Security Logs</Link>
                            <Link to="/settings" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">Settings</Link>
                        </nav>
                    </div>
                    <div className="flex items-center gap-6">
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

                {/* Shared Hub Content Container */}
                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden relative z-20 transition-colors">
                    
                    {/* Tab Navigation */}
                    <div className="flex border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-transparent">
                        <button 
                            onClick={() => setActiveTab('received')}
                            className={`flex-1 py-5 font-bold uppercase tracking-wider text-sm text-center transition-all ${activeTab === 'received' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            Inbox (Shared With Me)
                        </button>
                        <button 
                            onClick={() => setActiveTab('sent')}
                            className={`flex-1 py-5 font-bold uppercase tracking-wider text-sm text-center transition-all ${activeTab === 'sent' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            Outbox (Shared By Me)
                        </button>
                    </div>

                    <div className="p-8 flex justify-between items-center border-b border-gray-200 dark:border-white/10 bg-white dark:bg-transparent">
                        <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase">
                            {activeTab === 'received' ? 'Files Securely Received' : 'Active & Revoked Share Links'}
                        </h2>
                        {statusMessage && <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400 animate-pulse tracking-wider uppercase">{statusMessage}</span>}
                    </div>
                    
                    {/* Render RECEIVED SHARES */}
                    {activeTab === 'received' && (
                        <div className="divide-y divide-gray-200 dark:divide-white/10 min-h-[300px] bg-white dark:bg-transparent">
                            {loading ? (
                                <div className="p-16 text-center text-gray-400 font-medium animate-pulse">Loading secure links...</div>
                            ) : receivedShares.length === 0 ? (
                                <div className="p-16 text-center">
                                    <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">Your inbox is empty. No files have been shared with you.</p>
                                </div>
                            ) : (
                                receivedShares.map(share => (
                                    <div key={share._id} className="p-6 flex flex-col sm:flex-row items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors gap-6 sm:gap-0">
                                        <div className="flex items-center gap-5 w-full sm:w-auto">
                                            <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-xl flex items-center justify-center shrink-0 border border-gray-200 dark:border-white/10">
                                                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-gray-900 dark:text-white truncate">{share.file.originalName}</h4>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                        From: <span className="text-orange-600 dark:text-orange-400 font-mono font-bold">{share.sender.email}</span>
                                                    </span>
                                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                        Expires: {new Date(share.expiryDate).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 w-full sm:w-auto shrink-0 justify-end">
                                            <button onClick={() => handleDownload(share)} className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold tracking-wide uppercase rounded-lg transition-colors shadow-sm">
                                                Decrypt & Download
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Render SENT SHARES */}
                    {activeTab === 'sent' && (
                        <div className="divide-y divide-gray-200 dark:divide-white/10 min-h-[300px] bg-white dark:bg-transparent">
                            {loading ? (
                                <div className="p-16 text-center text-gray-400 font-medium animate-pulse">Loading sent links...</div>
                            ) : sentShares.length === 0 ? (
                                <div className="p-16 text-center">
                                    <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">You haven't shared any files yet.</p>
                                </div>
                            ) : (
                                sentShares.map(share => (
                                    <div key={share._id} className={`p-6 flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-0 transition-colors ${share.isRevoked ? 'bg-red-50/50 dark:bg-red-950/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                                        <div className="flex items-center gap-5 w-full sm:w-auto">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${share.isRevoked ? 'bg-red-100 dark:bg-red-500/20 border-red-200 dark:border-red-500/30' : 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/30'}`}>
                                                {share.isRevoked ? (
                                                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                                ) : (
                                                    <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path></svg>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h4 className={`font-bold truncate ${share.isRevoked ? 'line-through text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>{share.file.originalName}</h4>
                                                    {share.isRevoked && <span className="text-[10px] bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 px-2 py-0.5 rounded uppercase font-extrabold tracking-wider border border-red-200 dark:border-red-500/30 shrink-0">Revoked</span>}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                                                    <span>To: <span className="text-orange-600 dark:text-orange-400 font-mono font-bold">{share.receiver?.email || 'Public'}</span></span>
                                                    <span>•</span>
                                                    <span>Downloads: <span className={`font-mono font-bold ${share.downloadCount >= share.downloadLimit ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{share.downloadCount}/{share.downloadLimit}</span></span>
                                                    <span>•</span>
                                                    <span>Expires: {new Date(share.expiryDate).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 w-full sm:w-auto shrink-0 justify-end">
                                            <button 
                                                onClick={() => setRevokeConfirmToken(share.shareToken)} 
                                                disabled={share.isRevoked}
                                                className="px-5 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:bg-gray-100 disabled:dark:bg-white/5 disabled:text-gray-400 disabled:dark:text-gray-600 text-sm font-bold tracking-wide uppercase rounded-lg transition-colors border border-gray-200 dark:border-white/10 hover:border-red-200 dark:hover:border-red-500/20 disabled:border-gray-200 disabled:dark:border-white/10 shadow-sm disabled:shadow-none"
                                            >
                                                {share.isRevoked ? 'Access Dead' : 'Revoke Access'}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default SharedHub;
