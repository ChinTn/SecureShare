import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { calculateIntegrityHash, decryptFile } from '../utils/crypto';
import { Link } from 'react-router-dom';

const SharedHub = () => {
    const { user, privateKey, logout } = useAuth();
    
    // Tab State
    const [activeTab, setActiveTab] = useState('received'); // 'received' or 'sent'
    
    // Data States
    const [receivedShares, setReceivedShares] = useState([]);
    const [sentShares, setSentShares] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

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
                    fileId: share ? share.file._id : file._id,
                    details: `Tampered file detected: ${share ? share.file.originalName : file.originalName}`
                });
                alert("WARNING: File integrity check failed! The file may have been corrupted or tampered with.");
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
            alert(error.response?.data?.message || "Failed to download or decrypt file. The link may have expired.");
            setStatusMessage('');
        }
    };

    const handleRevoke = async (shareToken) => {
        if (!window.confirm("Are you sure you want to revoke this share link? The recipient will instantly lose access.")) return;
        
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
            alert(error.response?.data?.message || "Failed to revoke share.");
            setStatusMessage('');
        }
    };

    return (
        <div className="min-h-screen text-white p-8 font-sans" style={{ background: 'radial-gradient(circle at 50% -20%, #312e81 0%, #0f172a 50%)', backgroundColor: '#0f172a' }}>
            <div className="max-w-6xl mx-auto space-y-8 relative z-10">
                
                {/* Navigation & Header */}
                <div className="flex justify-between items-center bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-2xl">
                    <div className="flex items-center gap-6">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                            Shared Hub
                        </h1>
                        <nav className="flex gap-4">
                            <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors">My Vault</Link>
                            <span className="text-white font-bold border-b-2 border-violet-500 pb-1">Shared Hub</span>
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <p className="text-gray-300 text-sm">Logged in as: <span className="font-mono text-violet-300">{user?.email}</span></p>
                        <button onClick={logout} className="px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/50 hover:bg-red-500 hover:text-white rounded-lg transition-all text-sm font-semibold">
                            Lock Vault
                        </button>
                    </div>
                </div>

                {/* Shared Hub Content Container */}
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative z-20">
                    
                    {/* Tab Navigation */}
                    <div className="flex border-b border-white/20">
                        <button 
                            onClick={() => setActiveTab('received')}
                            className={`flex-1 py-4 font-bold text-center transition-all ${activeTab === 'received' ? 'bg-violet-600/30 text-white border-b-2 border-violet-500' : 'text-gray-400 hover:bg-white/5'}`}
                        >
                            Inbox (Shared With Me)
                        </button>
                        <button 
                            onClick={() => setActiveTab('sent')}
                            className={`flex-1 py-4 font-bold text-center transition-all ${activeTab === 'sent' ? 'bg-violet-600/30 text-white border-b-2 border-violet-500' : 'text-gray-400 hover:bg-white/5'}`}
                        >
                            Outbox (Shared By Me)
                        </button>
                    </div>

                    <div className="p-6 flex justify-between items-center bg-black/20">
                        <h2 className="text-xl font-bold">
                            {activeTab === 'received' ? 'Files Securely Received' : 'Active & Revoked Share Links'}
                        </h2>
                        {statusMessage && <span className="text-xs font-mono text-violet-300 animate-pulse">{statusMessage}</span>}
                    </div>
                    
                    {/* Render RECEIVED SHARES */}
                    {activeTab === 'received' && (
                        <div className="divide-y divide-white/10 min-h-[300px]">
                            {loading ? (
                                <div className="p-10 text-center text-gray-300 animate-pulse">Loading secure links...</div>
                            ) : receivedShares.length === 0 ? (
                                <div className="p-10 text-center text-gray-300">Your inbox is empty. No files have been shared with you.</div>
                            ) : (
                                receivedShares.map(share => (
                                    <div key={share._id} className="p-6 flex items-center justify-between hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-indigo-500/30 rounded-lg flex items-center justify-center">
                                                <svg className="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">{share.file.originalName}</h4>
                                                <p className="text-xs text-gray-300 mt-1">
                                                    From: <span className="text-violet-300 font-mono">{share.sender.email}</span> • Expires: {new Date(share.expiryDate).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={() => handleDownload(share)} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-violet-500/30">
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
                        <div className="divide-y divide-white/10 min-h-[300px]">
                            {loading ? (
                                <div className="p-10 text-center text-gray-300 animate-pulse">Loading sent links...</div>
                            ) : sentShares.length === 0 ? (
                                <div className="p-10 text-center text-gray-300">You haven't shared any files yet.</div>
                            ) : (
                                sentShares.map(share => (
                                    <div key={share._id} className={`p-6 flex items-center justify-between transition-colors ${share.isRevoked ? 'bg-red-950/20 opacity-75' : 'hover:bg-white/10'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${share.isRevoked ? 'bg-red-500/20' : 'bg-emerald-500/30'}`}>
                                                {share.isRevoked ? (
                                                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                                ) : (
                                                    <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path></svg>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className={`font-semibold ${share.isRevoked ? 'line-through text-gray-400' : 'text-white'}`}>{share.file.originalName}</h4>
                                                    {share.isRevoked && <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Revoked</span>}
                                                </div>
                                                <p className="text-xs text-gray-300 mt-1">
                                                    To: <span className="text-violet-300 font-mono">{share.receiver?.email || 'Public'}</span> • 
                                                    Downloads: <span className={`${share.downloadCount >= share.downloadLimit ? 'text-red-400' : 'text-emerald-400'} font-mono`}>{share.downloadCount}/{share.downloadLimit}</span> • 
                                                    Expires: {new Date(share.expiryDate).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <button 
                                                onClick={() => handleRevoke(share.shareToken)} 
                                                disabled={share.isRevoked}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-red-500/30 disabled:shadow-none"
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
