'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinNotebook: (notebookId: string) => void;
  leaveNotebook: (notebookId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Connect to WebSocket when user is authenticated
      const token = localStorage.getItem('token');
      const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000', {
        auth: {
          token
        }
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        console.log('Connected to WebSocket');
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
        console.log('Disconnected from WebSocket');
      });

      newSocket.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
        setSocket(null);
        setIsConnected(false);
      };
    }
  }, [user]);

  const joinNotebook = (notebookId: string) => {
    if (socket) {
      socket.emit('join-notebook', { notebookId });
    }
  };

  const leaveNotebook = (notebookId: string) => {
    if (socket) {
      socket.emit('leave-notebook', { notebookId });
    }
  };

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, joinNotebook, leaveNotebook }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
