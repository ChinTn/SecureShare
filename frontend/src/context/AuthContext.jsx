import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // 1. The Secure RAM Vault
    const [privateKey, setPrivateKey] = useState(null); 
    
    // 2. The Public Profile
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    // --- THE AXIOS INTERCEPTOR ---
    useEffect(() => {
        // We set up a silent watcher on ALL outgoing axios requests
        const interceptor = axios.interceptors.response.use(
            (response) => response, // If the request succeeds, let it pass normally
            async (error) => {
                const originalRequest = error.config;

                // If the error is a 401 Unauthorized, and we haven't already retried this exact request, 
                // AND the request isn't the login or refresh routes themselves...
                if (
                    error.response?.status === 401 && 
                    !originalRequest._retry && 
                    !originalRequest.url.includes('/auth/login') &&
                    !originalRequest.url.includes('/auth/refresh')
                ) {
                    originalRequest._retry = true; // Mark it so we don't infinitely loop

                    try {
                        // 1. Ask the backend for a new access token using our HTTP-Only cookie!
                        const res = await axios.get('/api/auth/refresh', { withCredentials: true });
                        const newAccessToken = res.data.accessToken;

                        // 2. Globally update Axios to use the new token for all future requests
                        axios.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                        
                        // 3. Attach the new token to the frozen request and try it again seamlessly!
                        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                        return axios(originalRequest);
                        
                    } catch (refreshError) {
                        // If the refresh token itself is expired or missing, they must do a full login
                        console.error("Session completely expired. Please log in again.");
                        setPrivateKey(null);
                        localStorage.removeItem('user');
                        setUser(null);
                        return Promise.reject(refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );

        // Cleanup interceptor if component unmounts
        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    // 3. Login Helper
    const loginUser = (userData, decryptedKey) => {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setPrivateKey(decryptedKey);
    };

    // 4. Logout Helper
    const logout = async () => {
        try {
            await axios.post('/api/auth/logout', {}, { withCredentials: true });
        } catch (error) {
            console.error("Logout failed on server", error);
        } finally {
            setPrivateKey(null);
            localStorage.removeItem('user');
            setUser(null);
            delete axios.defaults.headers.common['Authorization'];
        }
    };

    return (
        <AuthContext.Provider value={{ privateKey, setPrivateKey, user, loginUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);