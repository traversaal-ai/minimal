import React from 'react';
import { Route, Routes } from 'react-router-dom';
import LandingPage from './marketing/LandingPage.jsx';
import LoginPage from './auth/LoginPage.jsx';
import SignupPage from './auth/SignupPage.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import AppShell from './pages/AppShell.jsx';
import AppHome from './pages/AppHome.jsx';
import PageDetail from './pages/PageDetail.jsx';
import GraphView from './pages/GraphView.jsx';
import DemoView from './pages/DemoView.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/demo" element={<DemoView />} />
      <Route path="/demo/pages/:id" element={<DemoView />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<AppHome />} />
        <Route path="pages/:id" element={<PageDetail />} />
        <Route path="graph" element={<GraphView />} />
      </Route>
    </Routes>
  );
}
