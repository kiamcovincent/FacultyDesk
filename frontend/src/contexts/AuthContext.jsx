import { useEffect, useState } from 'react';
import { apiRequest } from '../services/api.js';
import { getRegistrationOutcome } from '../services/registrationResult.js';
import { authContext as AuthContext } from './authContext.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;

    apiRequest('/auth/me')
      .then((data) => {
        if (active) {
          setUser(data.user);
          setStatus('authenticated');
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setStatus('unauthenticated');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const login = async (credentials) => {
    const data = await apiRequest('/auth/login', { method: 'POST', body: credentials });
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  };

  const register = async (details) => {
    const data = await apiRequest('/auth/register', { method: 'POST', body: details });
    const outcome = getRegistrationOutcome(data, details.email);

    if (outcome.pendingConfirmation) {
      setUser(null);
      setStatus('unauthenticated');
      return outcome;
    }

    setUser(outcome.user);
    setStatus('authenticated');
    return outcome;
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  };

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
