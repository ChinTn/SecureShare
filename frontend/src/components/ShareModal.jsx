import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { reEncryptAESKeyForRecipient } from '../utils/crypto';
import { toast } from '../utils/toast';

const ShareModal = ({ file, onClose }) => {
    const { privateKey } = useAuth();
    const [receiverEmail, setReceiverEmail] = useState('');
    const [expiryHours, setExpiryHours] = useState(24);
    const [downloadLimit, setDownloadLimit] = useState(5);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [shareLink, setShareLink] = useState('');

    const handleShare = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setShareLink('');

        try {
            // 1. Fetch Bob's Public Key from the server
            const pkRes = await axios.get(`http://localhost:5000/api/share/public-key?email=${encodeURIComponent(receiverEmail)}`);
            const bobPublicKeyJwkStr = pkRes.data.publicKey;

            // 2. Perform the Zero-Knowledge Re-Encryption
            // We take the file's encryptedAESKey (which is locked with OUR public key),
            // We unlock it using OUR private key in RAM, 
            // And instantly lock it again using BOB's public key.
            const encryptedAESKeyForReceiver = await reEncryptAESKeyForRecipient(
                file.encryptedAESKey, 
                privateKey, 
                bobPublicKeyJwkStr
            );

            // 3. Send the Bob-specific padlock to the server to create the link
            const shareRes = await axios.post('http://localhost:5000/api/share', {
                fileId: file._id,
                receiverEmail,
                encryptedAESKeyForReceiver,
                expiryHours: Number(expiryHours),
                downloadLimit: Number(downloadLimit)
            });

            setShareLink(`http://localhost:5174${shareRes.data.shareLink}`);
        } catch (err) {
            console.error("Share error:", err);
            setError(err.response?.data?.message || 'Failed to share file. Make sure the user exists.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm p-4 font-sans transition-colors duration-300">
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative transition-colors">
                
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors p-1 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>

                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-100 dark:border-orange-500/20">
                        <svg className="w-5 h-5 text-orange-600 dark:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase">Secure Share</h2>
                </div>
                
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 font-medium">Sharing: <span className="text-orange-600 dark:text-orange-400 font-mono font-bold">{file?.originalName}</span></p>

                {shareLink ? (
                    <div className="space-y-5">
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-4 rounded-xl text-emerald-700 dark:text-emerald-400 text-sm font-semibold tracking-wide flex items-start gap-3">
                            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            File securely shared! The recipient can log in and view it in their "Shared With Me" tab.
                        </div>
                        <div className="bg-gray-50 dark:bg-[#252525] p-4 rounded-xl border border-gray-200 dark:border-white/10 break-all font-mono text-xs text-gray-800 dark:text-gray-300 shadow-inner">
                            {shareLink}
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(shareLink); toast.success('Link copied!'); }} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-md shadow-orange-500/20">
                            Copy Link
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleShare} className="space-y-5">
                        {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm font-semibold tracking-wide">{error}</div>}
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wider mb-2">Recipient Email</label>
                            <input
                                type="email"
                                required
                                placeholder="bob@example.com"
                                className="w-full bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-white/10 p-3.5 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-medium"
                                value={receiverEmail}
                                onChange={(e) => setReceiverEmail(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wider mb-2">Expiry (Hours)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="168"
                                    className="w-full bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-white/10 p-3.5 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-medium"
                                    value={expiryHours}
                                    onChange={(e) => setExpiryHours(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wider mb-2">Max Downloads</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    className="w-full bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-white/10 p-3.5 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-medium"
                                    value={downloadLimit}
                                    onChange={(e) => setDownloadLimit(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full mt-2 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm uppercase tracking-widest py-3.5 rounded-xl transition-all disabled:bg-gray-300 disabled:dark:bg-gray-700 disabled:opacity-50 shadow-md shadow-orange-500/20"
                        >
                            {loading ? 'Re-Encrypting AES Key...' : 'Share File'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ShareModal;
