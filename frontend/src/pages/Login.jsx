import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { deriveKeyFromPassword, decryptPrivateKey } from '../utils/crypto';
import { useAuth } from '../context/AuthContext';

// Configure axios to automatically send/receive our secure cookies
axios.defaults.withCredentials = true;

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { loginUser } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Fetch the locked vault from the server
            const response = await axios.post('/api/auth/login', {
                email: formData.email,
                password: formData.password
            });

            const { user, accessToken } = response.data;
            const { encryptedPrivateKey, pbkdf2Salt } = user;

            // 2. Derive the AES key using the password they just typed
            const aesKey = await deriveKeyFromPassword(formData.password, pbkdf2Salt);

            // 3. Unlock the Private Key!
            const unlockedPrivateKey = await decryptPrivateKey(encryptedPrivateKey, aesKey);

            // 4. Set the access token for future API calls
            axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
            
            // 5. Save the unlocked key to the RAM vault
            loginUser(user, unlockedPrivateKey);

            navigate('/dashboard');

        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Check your password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-[#121212] transition-colors duration-300 overflow-hidden animate-fade-in">
            <div className="w-full max-w-md bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl p-6 sm:p-8 relative z-10 transition-colors flex flex-col">
                
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                        Secure<span className="text-orange-500">Share</span>
                    </h1>
                    <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium text-sm leading-relaxed">
                        Welcome back to your zero-knowledge vault.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-red-700 dark:text-red-400 text-sm font-semibold tracking-wide text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                        <input 
                            type="email" 
                            required
                            className="w-full bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-white/10 rounded-xl p-3.5 text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
                            placeholder="you@example.com"
                            onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">Master Password</label>
                        <input 
                            type="password" 
                            required
                            className="w-full bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-white/10 rounded-xl p-3.5 text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
                            placeholder="••••••••"
                            onChange={e => setFormData({...formData, password: e.target.value})}
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full mt-2 py-3.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:dark:bg-gray-700 disabled:opacity-50 text-white font-extrabold text-sm uppercase tracking-widest rounded-xl transition-all shadow-md shadow-orange-500/20"
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                <p className="mt-6 text-center text-gray-600 dark:text-gray-400 text-sm font-medium">
                    Don't have a vault yet? <Link to="/register" className="text-orange-500 hover:text-orange-600 font-bold transition-colors">Create one.</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;