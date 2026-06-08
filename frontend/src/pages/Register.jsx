import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { generateRSAKeyPair, deriveKeyFromPassword, encryptPrivateKey } from '../utils/crypto';

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

            alert('Registration complete! You can now log in.');
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl">
                <h2 className="text-3xl font-bold text-center mb-6 text-white">Secure Register</h2>
                
                {error && <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm">{error}</div>}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" placeholder="Full Name" required 
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                    />
                    <input type="email" placeholder="Email" required 
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                    />
                    <input type="password" placeholder="Master Password" required minLength="8"
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                    />
                    
                    {/* CRITICAL SECURITY WARNING BOX */}
                    <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-4 mt-6">
                        <h4 className="text-red-400 font-bold text-sm mb-2 uppercase tracking-wide">⚠️ Zero-Knowledge Warning</h4>
                        <p className="text-red-200/80 text-xs mb-3 leading-relaxed">
                            Because this app uses military-grade End-to-End Encryption, <strong>we cannot reset your password</strong>. If you forget it, your files will be permanently locked and you will be forced to delete your account.
                        </p>
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input 
                                type="checkbox" 
                                required
                                checked={ackWarning}
                                onChange={(e) => setAckWarning(e.target.checked)}
                                className="mt-1 w-4 h-4 rounded border-red-500 bg-black/50 text-red-500 focus:ring-red-500 cursor-pointer"
                            />
                            <span className="text-red-200 text-xs font-medium group-hover:text-red-100 transition-colors">
                                I understand that if I lose my password, I lose my data forever.
                            </span>
                        </label>
                    </div>

                    <button type="submit" disabled={loading || !ackWarning}
                        className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/30 mt-4">
                        {loading ? 'Generating Secure Keys...' : 'Create Account'}
                    </button>
                </form>
                
                <p className="mt-6 text-center text-gray-400 text-sm">
                    Already have an account? <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium">Login</Link>
                </p>
            </div>
        </div>
    );
};

export default Register;