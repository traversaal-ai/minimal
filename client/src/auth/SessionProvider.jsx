import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from '../api/client.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      setUser(null);
      setWorkspace(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.getMe();
      setUser(data.user);
      setWorkspace(data.workspace);
    } catch (err) {
      api.setToken(null);
      setUser(null);
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const applySession = useCallback((data) => {
    api.setToken(data.access_token);
    setUser(data.user);
    setWorkspace(data.workspace);
  }, []);

  const signup = useCallback(
    async (email, password) => {
      const data = await api.signup(email, password);
      applySession(data);
      return data;
    },
    [applySession]
  );

  const login = useCallback(
    async (email, password) => {
      const data = await api.login(email, password);
      applySession(data);
      return data;
    },
    [applySession]
  );

  const logout = useCallback(() => {
    api.setToken(null);
    setUser(null);
    setWorkspace(null);
  }, []);

  const value = {
    user,
    workspace,
    loading,
    isAuthenticated: !!user,
    signup,
    login,
    logout,
    refresh: loadSession,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
