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
        <div className="min-h-screen flex bg-white dark:bg-[#1a1a1a] transition-colors duration-300 animate-fade-in">
            {/* Left Side: Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 relative z-10">
                <div className="w-full max-w-md space-y-10 text-center">
                    <div className="w-24 h-24 mx-auto bg-orange-100 dark:bg-orange-500/10 rounded-full flex items-center justify-center mb-2 shadow-inner">
                        <svg className="w-12 h-12 text-orange-600 dark:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                    </div>
                    
                    <div>
                        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Vault Locked</h2>
                        <p className="mt-4 text-gray-500 dark:text-gray-400 font-medium">
                            Welcome back, <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{user?.name || 'User'}</span>.<br/>Enter your Master Password to decrypt your vault into memory.
                        </p>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-red-700 dark:text-red-400 text-sm font-semibold tracking-wide text-left">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleUnlock} className="space-y-6">
                        <div>
                            <input
                                type="password"
                                placeholder="Master Password"
                                className="w-full bg-gray-50 dark:bg-[#252525] border border-gray-300 dark:border-white/10 rounded-xl p-4 text-center text-xl tracking-widest text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:dark:bg-gray-700 disabled:opacity-50 text-white font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-md shadow-orange-500/20"
                        >
                            {loading ? 'Decrypting Vault...' : 'Unlock Vault'}
                        </button>
                    </form>

                    <button 
                        onClick={() => { logout(); navigate('/login'); }}
                        className="mt-8 text-xs uppercase tracking-widest font-bold text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                        Not you? Logout completely
                    </button>
                </div>
            </div>

            {/* Right Side: Image/Branding */}
            <div className="hidden lg:flex w-1/2 bg-gray-50 dark:bg-[#0f172a] border-l border-gray-200 dark:border-white/5 items-center justify-center p-12 overflow-hidden relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/10 dark:bg-orange-500/5 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen pointer-events-none"></div>
                
                <img 
                    src="https://imgs.search.brave.com/kfWGnzGve6hMmT6QS97qm5zfliJqkmVN3NY84TiNGIc/rs:fit:0:180:1:0/g:ce/aHR0cHM6Ly93d3cu/cHVyZXN0b3JhZ2Uu/Y29tL2NvbnRlbnQv/ZGFtL3B1cmVzdG9y/YWdlL2tub3dsZWRn/ZS93aGF0LWlzLWZp/bGUtbGV2ZWwtZW5j/cnlwdGlvbi1oZXJv/LmpwZy5pbWdvLmpw/Zw" 
                    alt="Vault Security Vector" 
                    className="w-full max-w-lg object-contain relative z-10 filter drop-shadow-2xl dark:opacity-90 mix-blend-darken dark:mix-blend-normal rounded-2xl"
                />
            </div>
        </div>
    );
};

export default UnlockVault;