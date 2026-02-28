
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import GameHistory from './pages/GameHistory';
import Statistics from './pages/Statistics';
import RoomView from './pages/RoomView';
import RoomDetailHistory from './pages/RoomDetailHistory';
import { User } from './types';
import { mockCloud } from './services/mockCloud';
import apiClient from './services/apiClient';
import { ToastProvider } from './components/Toast';
import { getApiService } from './config/apiSwitch';
import firstImage from './first.png';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStartupSplash, setShowStartupSplash] = useState(true);

  useEffect(() => {
    // 初始化 API 并获取当前用户
    const initializeApp = async () => {
      try {
        const apiService = await getApiService();
        const user = await apiService.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('初始化应用失败:', error);
        // 失败时继续，允许用户登录
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowStartupSplash(false);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('poker_user');
    setCurrentUser(null);
  };

  if (showStartupSplash || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <img
          src={firstImage}
          alt="启动页"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <ToastProvider>
      <HashRouter>
        <div className="max-w-[500px] mx-auto min-h-screen bg-background-dark shadow-2xl relative flex flex-col overflow-hidden">
          <Routes>
            <Route 
              path="/login" 
              element={!currentUser ? <Login onLogin={setCurrentUser} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/register" 
              element={!currentUser ? <Register onLogin={setCurrentUser} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/" 
              element={currentUser ? <Home user={currentUser} onLogout={handleLogout} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/home" 
              element={currentUser ? <Home user={currentUser} onLogout={handleLogout} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/game-history" 
              element={currentUser ? <GameHistory user={currentUser} onLogout={handleLogout} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/statistics" 
              element={currentUser ? <Statistics user={currentUser} onLogout={handleLogout} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/room/:id" 
              element={currentUser ? <RoomView user={currentUser} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/room-history/:roomCode" 
              element={currentUser ? <RoomDetailHistory user={currentUser} /> : <Navigate to="/login" />} 
            />
          </Routes>
        </div>
      </HashRouter>
    </ToastProvider>
  );
};

export default App;
