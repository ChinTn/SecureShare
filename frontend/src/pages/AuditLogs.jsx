import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/audit');
                setLogs(res.data.logs);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    // This function translates raw database logs into your specific human-readable sentences!
    const translateLog = (log) => {
        const fileName = log.file?.originalName || 'an unknown file';
        
        switch (log.action) {
            case 'LOGIN': return `✅ You logged in from IP ${log.ipAddress}`;
            case 'FAILED_LOGIN': return `⚠️ Failed login attempt from IP ${log.ipAddress}`;
            case 'FILE_UPLOAD': return `✅ You uploaded ${fileName}`;
            case 'FILE_DOWNLOAD': return `✅ You downloaded ${fileName}`;
            case 'SHARE': return `✅ You shared ${fileName} with ${log.details.replace('Created share link for receiver: ', '')}`;
            case 'FILE_DOWNLOAD': return `✅ Someone downloaded your shared file: ${fileName}`; // Assuming details holds the email
            case 'REVOKE_SHARE': return `✅ You revoked access to ${fileName}`;
            case 'INTEGRITY_FAIL': return `⚠️ Tampered file detected: ${fileName}`;
            default: return null; // We hide internal server actions!
        }
    };

    return (
        <div className="min-h-screen text-white p-8 font-sans bg-[#0f172a]">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center bg-white/10 p-6 rounded-2xl">
                    <h1 className="text-3xl font-bold">Security Activity</h1>
                    <Link to="/dashboard" className="text-violet-400 hover:text-white">Back to Vault</Link>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    {loading ? <p>Loading logs...</p> : (
                        <div className="space-y-4">
                            {logs.map(log => {
                                const message = translateLog(log);
                                if (!message) return null; // Hides stuff we don't want to show!
                                
                                const isWarning = log.action === 'FAILED_LOGIN' || log.action === 'INTEGRITY_FAIL';
                                
                                return (
                                    <div key={log._id} className={`p-4 rounded-lg border ${isWarning ? 'bg-red-950/30 border-red-500/50 text-red-200' : 'bg-black/20 border-white/10 text-gray-300'}`}>
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">{message}</span>
                                            <span className="text-xs opacity-50">{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditLogs;