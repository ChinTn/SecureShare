import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { deriveKeyFromPassword, encryptPrivateKey } from '../utils/crypto';
import { Link, useNavigate } from 'react-router-dom';

const Settings = () => {
    const { user, privateKey, logout } = useAuth();
    const navigate = useNavigate();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setError('');
        setStatusMessage('');

        if (newPassword.length < 8) {
            return setError("New password must be at least 8 characters long.");
        }
        if (newPassword !== confirmPassword) {
            return setError("New passwords do not match.");
        }

        try {
            setLoading(true);
            setStatusMessage('Generating new Cryptographic Salt...');
            
            // 1. Generate a brand new Salt for PBKDF2
            const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
            let binary = '';
            for (let i = 0; i < saltBytes.byteLength; i++) {
                binary += String.fromCharCode(saltBytes[i]);
            }
            const newSaltBase64 = window.btoa(binary);

            setStatusMessage('Deriving new 256-bit AES Master Key from New Password...');
            
            // 2. Derive the NEW Master AES Key using the New Password and New Salt
            const newMasterKey = await deriveKeyFromPassword(newPassword, newSaltBase64);

            setStatusMessage('Encrypting your Private RSA Key with the new Master Key...');

            // 3. Re-encrypt the existing Private Key (currently in RAM) with the NEW Master Key
            const newEncryptedPrivateKey = await encryptPrivateKey(privateKey, newMasterKey);

            setStatusMessage('Sending secured payload to the server...');

            // 4. Send the payload to the backend
            await axios.post('http://localhost:5000/api/auth/change-password', {
                currentPassword,
                newPassword,
                newSalt: newSaltBase64,
                newEncryptedPrivateKey
            });

            setStatusMessage('Password changed successfully! Logging out...');
            
            // 5. Force logout
            setTimeout(() => {
                logout();
                navigate('/login');
            }, 1500);

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to change password. Make sure your current password is correct.');
            setStatusMessage('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen text-white p-8 font-sans" style={{ background: 'radial-gradient(circle at 50% -20%, #312e81 0%, #0f172a 50%)', backgroundColor: '#0f172a' }}>
            <div className="max-w-2xl mx-auto space-y-8 relative z-10">
                
                {/* Navigation Header */}
                <div className="flex justify-between items-center bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-2xl">
                    <div className="flex items-center gap-6">
                        <h1 className="text-3xl font-bold text-white">
                            Account Settings
                        </h1>
                        <nav className="flex gap-4">
                            <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors">My Vault</Link>
                        </nav>
                    </div>
                </div>

                {/* Form Container */}
                <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl shadow-2xl">
                    <h2 className="text-2xl font-bold mb-2">Change Master Password</h2>
                    <p className="text-sm text-gray-400 mb-8">
                        Warning: Because SecureShare uses a Zero-Knowledge architecture, changing your Master Password requires completely re-encrypting your Private Vault Key in your browser. 
                        If you lose your new password, nobody (not even us) can recover your files.
                    </p>

                    <form onSubmit={handleChangePassword} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Current Master Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                        </div>
                        
                        <hr className="border-white/10 my-6" />

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">New Master Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        {error && <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">{error}</div>}
                        
                        {statusMessage && !error && (
                            <div className="p-4 bg-violet-900/30 border border-violet-500/30 rounded-lg">
                                <span className="text-sm font-mono text-violet-300 animate-pulse">{statusMessage}</span>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-4 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:opacity-50 text-white font-bold rounded-lg transition-all shadow-lg shadow-violet-500/30"
                        >
                            {loading ? 'Re-encrypting Vault Key...' : 'Change Password & Re-Encrypt'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Settings;
