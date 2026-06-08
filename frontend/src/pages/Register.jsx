import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { generateRSAKeyPair, deriveKeyFromPassword, encryptPrivateKey } from '../utils/crypto';
import { toast } from '../utils/toast';

const Register = () => {
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    
    // NEW: Force the user to acknowledge the Zero-Knowledge warning
    const [ackWarning, setAckWarning] = useState(false); 
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Final safety check
        if (!ackWarning) {
            setError("You must acknowledge the security warning.");
            return;
        }

        setLoading(true);
        setError('');

        try {
            const saltArray = window.crypto.getRandomValues(new Uint8Array(16));
            const pbkdf2Salt = btoa(String.fromCharCode(...saltArray));

            const rsaKeys = await generateRSAKeyPair();
            const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", rsaKeys.publicKey);
            
            const aesKey = await deriveKeyFromPassword(formData.password, pbkdf2Salt);
            const encryptedPrivateKey = await encryptPrivateKey(rsaKeys.privateKey, aesKey);

            await axios.post('http://localhost:5000/api/auth/register', {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                publicKey: JSON.stringify(publicKeyJwk),
                encryptedPrivateKey,
                pbkdf2Salt
            });

            toast.success('Registration complete! You can now log in.');
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-[#121212] transition-colors duration-300 overflow-hidden animate-fade-in">
            <div className="w-full max-w-md bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl p-6 sm:p-8 relative z-10 transition-colors flex flex-col">
                
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                        Join <span className="text-orange-500">SecureShare</span>
                    </h1>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-red-700 dark:text-red-400 text-sm font-semibold tracking-wide text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                    <div className="space-y-3">
                        <div>
                            <input 
                                type="text" 
                                required
                                className="w-full bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
                                placeholder="Full Name"
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <input 
                                type="email" 
                                required
                                className="w-full bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
                                placeholder="Email Address"
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                        <div>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
                                placeholder="Master Password"
                                onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* REDESIGNED SECURITY WARNING BOX */}
                    <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/30 rounded-lg p-3">
                        <h4 className="text-red-600 dark:text-red-400 font-bold text-[11px] mb-1 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="text-sm">⚠</span> Zero-Knowledge Encryption
                        </h4>
                        <p className="text-red-500 dark:text-red-300/70 text-[11px] mb-2 font-medium">
                            We cannot recover your password.
                        </p>
                        <label className="flex items-start gap-2 cursor-pointer group">
                            <input 
                                type="checkbox" 
                                required
                                checked={ackWarning}
                                onChange={(e) => setAckWarning(e.target.checked)}
                                className="mt-0.5 w-3.5 h-3.5 rounded border-red-300 dark:border-red-500/50 bg-white dark:bg-black/50 text-red-500 focus:ring-red-500 cursor-pointer shrink-0"
                            />
                            <span className="text-red-600 dark:text-red-200/90 text-[10px] font-bold uppercase tracking-wider group-hover:opacity-80 transition-opacity leading-tight">
                                I understand that losing my password permanently locks my data.
                            </span>
                        </label>
                    </div>

                    <div className="pt-1">
                        <button 
                            type="submit" 
                            disabled={loading || !ackWarning}
                            className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:dark:bg-gray-700 disabled:opacity-50 text-white font-extrabold text-sm uppercase tracking-widest rounded-lg transition-all shadow-md shadow-orange-500/20"
                        >
                            {loading ? 'Generating Secure Keys...' : 'Create Vault'}
                        </button>
                    </div>
                </form>

                <p className="text-center text-gray-500 dark:text-gray-400 text-xs font-medium mt-4">
                    Already have a vault? <Link to="/login" className="text-orange-500 hover:text-orange-600 font-bold transition-colors">Sign in</Link>
                </p>

                {/* Security Badges Row */}
                <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2 mt-6 pt-5 border-t border-gray-100 dark:border-white/5">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 flex items-center gap-1"><span className="text-xs">🔒</span> End-to-End Encrypted</span>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 flex items-center gap-1"><span className="text-xs">🛡</span> Zero-Knowledge Architecture</span>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 flex items-center gap-1"><span className="text-xs">⚡</span> Client-Side Encryption</span>
                </div>
            </div>
        </div>
    );
};

export default Register;