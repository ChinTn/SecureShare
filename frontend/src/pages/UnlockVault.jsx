import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { deriveKeyFromPassword, decryptPrivateKey } from '../utils/crypto';

const UnlockVault = () => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { user, setPrivateKey, logout } = useAuth();
    const navigate = useNavigate();

    const handleUnlock = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // 1. Derive the AES key from the password they just typed
            const aesKey = await deriveKeyFromPassword(password, user.pbkdf2Salt);
            
            // 2. Unlock the RSA Private Key using the AES Key!
            const decryptedKey = await decryptPrivateKey(user.encryptedPrivateKey, aesKey);
            
            // 3. Inject it back into secure RAM
            setPrivateKey(decryptedKey);
            
            // 4. Drop them back into the vault!
            navigate('/dashboard');
        } catch (err) {
            console.error("Unlock failed", err);
            setError('Incorrect Master Password. Your vault remains locked.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center font-sans p-4 text-white" style={{ background: 'radial-gradient(circle at 50% -20%, #312e81 0%, #0f172a 50%)', backgroundColor: '#0f172a' }}>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-10 rounded-3xl shadow-2xl w-full max-w-md text-center relative z-10">
                <div className="w-20 h-20 mx-auto bg-violet-500/30 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                
                <h2 className="text-3xl font-bold text-white mb-2">Vault Locked</h2>
                <p className="text-gray-300 mb-8">Welcome back, <span className="font-mono text-violet-300">{user?.name || 'User'}</span>. Enter your Master Password to decrypt your vault into memory.</p>

                {error && <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm">{error}</div>}

                <form onSubmit={handleUnlock} className="space-y-6">
                    <div>
                        <input
                            type="password"
                            placeholder="Master Password"
                            className="w-full bg-black/40 border border-white/20 p-4 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50"
                    >
                        {loading ? 'Decrypting Vault...' : 'Unlock Vault'}
                    </button>
                </form>

                <button onClick={logout} className="mt-8 text-sm text-gray-400 hover:text-red-400 transition-colors relative z-20">
                    Not you? Logout completely
                </button>
            </div>
        </div>
    );
};

export default UnlockVault;