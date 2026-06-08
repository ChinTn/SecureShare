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
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl">
                <h2 className="text-3xl font-bold text-center mb-6 text-white">Unlock Vault</h2>
                {error && <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm">{error}</div>}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="email" placeholder="Email" required 
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                    />
                    <input type="password" placeholder="Master Password" required 
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                    />
                    <button type="submit" disabled={loading}
                        className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/30">
                        {loading ? 'Unlocking...' : 'Login'}
                    </button>
                </form>
                <p className="mt-6 text-center text-gray-400 text-sm">
                    Need an account? <Link to="/register" className="text-violet-400 hover:text-violet-300 font-medium">Register</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;