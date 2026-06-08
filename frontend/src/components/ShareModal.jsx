import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { reEncryptAESKeyForRecipient } from '../utils/crypto';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
            <div className="bg-[#0f172a] border border-white/20 p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
                
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>

                <h2 className="text-2xl font-bold text-white mb-2">Securely Share File</h2>
                <p className="text-gray-400 text-sm mb-6">Sharing: <span className="text-violet-300 font-mono">{file?.originalName}</span></p>

                
                {shareLink ? (
                    <div className="space-y-4">
                        <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-xl text-green-300 text-sm">
                            File securely shared! The recipient can log in and view it in their "Shared With Me" tab.
                        </div>
                        <div className="bg-black/40 p-3 rounded-lg border border-white/10 break-all font-mono text-xs text-gray-300">
                            {shareLink}
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(shareLink); alert('Link copied!'); }} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition-all">
                            Copy Link
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleShare} className="space-y-4">
                        {error && <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm">{error}</div>}
                        
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Recipient Email</label>
                            <input
                                type="email"
                                required
                                placeholder="bob@example.com"
                                className="w-full bg-black/40 border border-white/20 p-3 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                value={receiverEmail}
                                onChange={(e) => setReceiverEmail(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Expiry (Hours)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="168"
                                    className="w-full bg-black/40 border border-white/20 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                    value={expiryHours}
                                    onChange={(e) => setExpiryHours(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Max Downloads</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    className="w-full bg-black/40 border border-white/20 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                    value={downloadLimit}
                                    onChange={(e) => setDownloadLimit(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full mt-4 bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50"
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
