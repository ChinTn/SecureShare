import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
    const [message, setMessage] = useState('Verifying your email...');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('No verification token found in the link.');
            return;
        }

        const verifyToken = async () => {
            try {
                const response = await axios.get(`/api/auth/verify-email?token=${token}`);
                setStatus('success');
                setMessage(response.data.message || 'Email verified successfully!');
            } catch (error) {
                setStatus('error');
                setMessage(error.response?.data?.message || 'Verification failed. The link may have expired.');
            }
        };

        verifyToken();
    }, [token]);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl text-center">
                <h2 className="text-3xl font-bold mb-6 text-white">Email Verification</h2>
                
                {status === 'verifying' && (
                    <div className="text-violet-400 font-medium animate-pulse">{message}</div>
                )}
                
                {status === 'success' && (
                    <div>
                        <div className="bg-green-500/20 border border-green-500/50 text-green-200 p-4 rounded-lg mb-6">
                            {message}
                        </div>
                        <Link to="/login" className="inline-block w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-lg transition-all shadow-lg shadow-violet-500/30">
                            Proceed to Login
                        </Link>
                    </div>
                )}
                
                {status === 'error' && (
                    <div>
                        <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6">
                            {message}
                        </div>
                        <Link to="/register" className="inline-block w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 rounded-lg transition-all">
                            Back to Registration
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;