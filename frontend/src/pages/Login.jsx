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
            const response = await axios.post('http://localhost:5000/api/auth/login', {
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
        <div className="min-h-screen flex bg-white dark:bg-[#1a1a1a] transition-colors duration-300 animate-fade-in">
            {/* Left Side: Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 relative z-10">
                <div className="w-full max-w-md space-y-10">
                    <div>
                        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                            Secure<span className="text-orange-500">Share</span>
                        </h1>
                        <p className="mt-4 text-gray-500 dark:text-gray-400 font-medium text-lg leading-relaxed">
                            Welcome back to your zero-knowledge vault.
                        </p>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-red-700 dark:text-red-400 text-sm font-semibold tracking-wide">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                            <input 
                                type="email" 
                                required
                                className="w-full bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-white/10 rounded-xl p-4 text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
                                placeholder="you@example.com"
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">Master Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-white/10 rounded-xl p-4 text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
                                placeholder="••••••••"
                                onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:dark:bg-gray-700 disabled:opacity-50 text-white font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-md shadow-orange-500/20"
                        >
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-center text-gray-600 dark:text-gray-400 font-medium">
                        Don't have a vault yet? <Link to="/register" className="text-orange-500 hover:text-orange-600 font-bold transition-colors">Create one.</Link>
                    </p>
                </div>
            </div>

            {/* Right Side: Image/Branding */}
            <div className="hidden lg:flex w-1/2 bg-gray-50 dark:bg-[#0f172a] border-l border-gray-200 dark:border-white/5 items-center justify-center p-12 overflow-hidden relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/10 dark:bg-orange-500/5 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen pointer-events-none"></div>
                
                <img 
                    src="https://imgs.search.brave.com/5j0kb7KXiMnzhc-luULzkJIwl_HB76sw5TWhM6gN6Ik/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9tZWRp/YS5pc3RvY2twaG90/by5jb20vaWQvMTA2/NDU2NjIzMC92ZWN0/b3IvY3liZXItc2Vj/dXJpdHktZGlnaXRh/bC1maWxlLXByb3Rl/Y3Rpb24tdmVjdG9y/LW9mLW1hbi11c2lu/Zy1zZWN1cml0eS1r/ZXktdG8tYWNjZXNz/LWRpZ2l0YWwuanBn/P3M9NjEyeDYxMiZ3/PTAmaz0yMCZjPXRC/UTFQUG1zdUt2UUpC/RjRBSjJnTmlvZmE4/Y294UjdCck1abmta/WkE2bXc9" 
                    alt="Cyber Security Vector" 
                    className="w-full max-w-lg object-contain relative z-10 filter drop-shadow-2xl dark:opacity-90 mix-blend-darken dark:mix-blend-normal"
                />
            </div>
        </div>
    );
};

export default Login;