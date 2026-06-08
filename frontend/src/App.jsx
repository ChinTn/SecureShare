import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Register from './pages/Register';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import UnlockVault from './pages/UnlockVault';
import SharedWithMe from './pages/SharedWithMe';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import ToastContainer from './components/ToastContainer';

// Smarter Private Route Logic
const PrivateRoute = ({ children }) => {
    const { user, privateKey } = useAuth();
    const location = useLocation();

    // If they have no user profile saved at all, force them to Login
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} />;
    }

    // If they have a profile saved, but the RAM was wiped (e.g. they refreshed the page), force them to Unlock!
    if (user && !privateKey) {
        return <Navigate to="/unlock" state={{ from: location }} />;
    }

    // If they have both their profile and their decrypted private key in RAM, let them in!
    return children;
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <ToastContainer />
                <Routes>
                    <Route path="/register" element={<Register />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    
                    {/* The New Unlock Route */}
                    <Route path="/unlock" element={<UnlockVault />} />

                    {/* The Protected Dashboard */}
                    <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                    <Route path="/shared" element={<PrivateRoute><SharedWithMe /></PrivateRoute>} />
                    <Route path="/audit" element={<PrivateRoute><AuditLogs /></PrivateRoute>} />
                    <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
                    
                    {/* Catch-all route routes them to the dashboard */}
                    <Route path="*" element={<Navigate to="/dashboard" />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;