import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { deriveKeyFromPassword, encryptPrivateKey } from '../utils/crypto';
import { Link, useNavigate } from 'react-router-dom';

const Settings = () => {
    const { user, privateKey, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
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
            await axios.post('/api/auth/change-password', {
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
        <div className="min-h-screen p-8 pb-20 transition-colors duration-300 animate-fade-in">
            <div className="max-w-6xl mx-auto space-y-8 relative z-10">
                
                {/* Navigation Header */}
                <div className="flex justify-between items-center bg-white dark:bg-[#252525] border border-gray-200 dark:border-white/10 p-6 rounded-2xl shadow-sm transition-colors">
                    <div className="flex items-center gap-6">
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase">
                            Secure<span className="text-orange-500">Share</span>
                        </h1>
                        <nav className="flex gap-4 text-sm font-semibold tracking-wide uppercase">
                            <Link to="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">My Vault</Link>
                            <Link to="/shared" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">Shared Hub</Link>
                            <Link to="/audit" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">Security Logs</Link>
                            <span className="text-gray-900 dark:text-white border-b-2 border-orange-500 pb-1">Settings</span>
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

                {/* Form Container */}
                <div className="max-w-2xl mx-auto bg-white dark:bg-[#252525] border border-gray-200 dark:border-white/10 p-10 rounded-2xl shadow-sm transition-colors mt-12">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 bg-orange-50 dark:bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-100 dark:border-orange-500/20">
                            <svg className="w-6 h-6 text-orange-600 dark:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                        </div>
                        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase">Change Master Password</h2>
                    </div>
                    
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                        Warning: Because SecureShare uses a Zero-Knowledge architecture, changing your Master Password requires completely re-encrypting your Private Vault Key in your browser. 
                        If you lose your new password, nobody (not even us) can recover your files.
                    </p>

                    <form onSubmit={handleChangePassword} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">Current Master Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-300 dark:border-white/10 rounded-xl p-4 text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                        </div>
                        
                        <hr className="border-gray-200 dark:border-white/10 my-8" />

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">New Master Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-300 dark:border-white/10 rounded-xl p-4 text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">Confirm New Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-300 dark:border-white/10 rounded-xl p-4 text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-red-700 dark:text-red-400 text-sm font-semibold tracking-wide">
                                {error}
                            </div>
                        )}
                        
                        {statusMessage && !error && (
                            <div className="p-4 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-lg">
                                <span className="text-sm font-mono font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 animate-pulse">{statusMessage}</span>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:dark:bg-gray-700 disabled:opacity-50 text-white font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-md shadow-orange-500/20 mt-4"
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
