const jwt = require('jsonwebtoken');
const { canAccessNotebook } = require('../middleware/auth');

let io = null;

// Store active connections and their notebook subscriptions
const activeConnections = new Map();
const notebookRooms = new Map();

/**
 * Setup WebSocket server for real-time collaboration
 */
function setupWebSocket(socketIO) {
  io = socketIO;

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const JWT_SECRET = process.env.JWT_SECRET || 'academic-notebook-secret-key';
      const decoded = jwt.verify(token, JWT_SECRET);
      
      socket.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name
      };

      next();
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.name} connected via WebSocket`);
    
    // Store connection
    activeConnections.set(socket.id, {
      socket,
      user: socket.user,
      notebooks: new Set(),
      lastActivity: Date.now()
    });

    // Handle notebook subscription
    socket.on('join-notebook', async (data) => {
      await handleJoinNotebook(socket, data);
    });

    // Handle leaving notebook
    socket.on('leave-notebook', async (data) => {
      await handleLeaveNotebook(socket, data);
    });

    // Handle real-time operations
    socket.on('operation', async (data) => {
      await handleOperation(socket, data);
    });

    // Handle cursor position updates
    socket.on('cursor-position', async (data) => {
      await handleCursorPosition(socket, data);
    });

    // Handle typing indicators
    socket.on('typing', async (data) => {
      await handleTyping(socket, data);
    });

    // Handle user presence updates
    socket.on('presence', async (data) => {
      await handlePresence(socket, data);
    });

    // Handle chat messages in collaborative sessions
    socket.on('chat-message', async (data) => {
      await handleChatMessage(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      handleDisconnect(socket);
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`WebSocket error for user ${socket.user.name}:`, error);
    });
  });

  // Cleanup inactive connections periodically
  setInterval(cleanupInactiveConnections, 30000); // Every 30 seconds

  console.log('🔌 WebSocket server initialized for real-time collaboration');
}

/**
 * Handle user joining a notebook for collaboration
 */
async function handleJoinNotebook(socket, data) {
  try {
    const { notebookId } = data;
    const userId = socket.user.id;
    const userRole = socket.user.role;

    if (!notebookId) {
      socket.emit('error', { message: 'Notebook ID required' });
      return;
    }

    // Check if user has access to the notebook
    const hasAccess = await canAccessNotebook(userId, userRole, notebookId, 'read');
    if (!hasAccess) {
      socket.emit('error', { message: 'Access denied to notebook' });
      return;
    }

    // Join the notebook room
    const roomName = `notebook-${notebookId}`;
    socket.join(roomName);

    // Update connection tracking
    const connection = activeConnections.get(socket.id);
    if (connection) {
      connection.notebooks.add(notebookId);
      connection.lastActivity = Date.now();
    }

    // Update notebook room tracking
    if (!notebookRooms.has(notebookId)) {
      notebookRooms.set(notebookId, new Map());
    }
    
    const notebookRoom = notebookRooms.get(notebookId);
    notebookRoom.set(userId, {
      socketId: socket.id,
      user: socket.user,
      joinedAt: new Date().toISOString(),
      cursorPosition: null,
      isTyping: false
    });

    // Notify other users in the room
    socket.to(roomName).emit('user-joined', {
      notebookId,
      user: {
        id: socket.user.id,
        name: socket.user.name,
        email: socket.user.email
      },
      timestamp: new Date().toISOString()
    });

    // Send current room status to the joining user
    const activeUsers = Array.from(notebookRoom.values()).map(conn => ({
      id: conn.user.id,
      name: conn.user.name,
      email: conn.user.email,
      joinedAt: conn.joinedAt,
      cursorPosition: conn.cursorPosition,
      isTyping: conn.isTyping
    }));

    socket.emit('notebook-joined', {
      notebookId,
      activeUsers,
      roomSize: notebookRoom.size
    });

    console.log(`User ${socket.user.name} joined notebook ${notebookId}`);
  } catch (error) {
    console.error('Error handling join notebook:', error);
    socket.emit('error', { message: 'Failed to join notebook' });
  }
}

/**
 * Handle user leaving a notebook
 */
async function handleLeaveNotebook(socket, data) {
  try {
    const { notebookId } = data;
    const userId = socket.user.id;

    if (!notebookId) {
      socket.emit('error', { message: 'Notebook ID required' });
      return;
    }

    const roomName = `notebook-${notebookId}`;
    socket.leave(roomName);

    // Update connection tracking
    const connection = activeConnections.get(socket.id);
    if (connection) {
      connection.notebooks.delete(notebookId);
    }

    // Update notebook room tracking
    const notebookRoom = notebookRooms.get(notebookId);
    if (notebookRoom) {
      notebookRoom.delete(userId);
      
      // Clean up empty rooms
      if (notebookRoom.size === 0) {
        notebookRooms.delete(notebookId);
      }
    }

    // Notify other users
    socket.to(roomName).emit('user-left', {
      notebookId,
      user: {
        id: socket.user.id,
        name: socket.user.name
      },
      timestamp: new Date().toISOString()
    });

    socket.emit('notebook-left', { notebookId });
    console.log(`User ${socket.user.name} left notebook ${notebookId}`);
  } catch (error) {
    console.error('Error handling leave notebook:', error);
    socket.emit('error', { message: 'Failed to leave notebook' });
  }
}

/**
 * Handle real-time operations for collaborative editing
 */
async function handleOperation(socket, data) {
  try {
    const { notebookId, operations, baseVersion } = data;
    const userId = socket.user.id;
    const userRole = socket.user.role;

    if (!notebookId || !operations) {
      socket.emit('error', { message: 'Notebook ID and operations required' });
      return;
    }

    // Check write access
    const hasAccess = await canAccessNotebook(userId, userRole, notebookId, 'write');
    if (!hasAccess) {
      socket.emit('error', { message: 'Write access denied' });
      return;
    }

    // Update connection activity
    const connection = activeConnections.get(socket.id);
    if (connection) {
      connection.lastActivity = Date.now();
    }

    // Broadcast operations to other users in the notebook
    const roomName = `notebook-${notebookId}`;
    socket.to(roomName).emit('operation', {
      notebookId,
      operations,
      userId,
      userName: socket.user.name,
      timestamp: new Date().toISOString()
    });

    // Update notebook room with latest activity
    const notebookRoom = notebookRooms.get(notebookId);
    if (notebookRoom && notebookRoom.has(userId)) {
      const userInfo = notebookRoom.get(userId);
      userInfo.lastOperation = new Date().toISOString();
    }

    console.log(`Operation applied by ${socket.user.name} in notebook ${notebookId}`);
  } catch (error) {
    console.error('Error handling operation:', error);
    socket.emit('error', { message: 'Failed to apply operation' });
  }
}

/**
 * Handle cursor position updates
 */
async function handleCursorPosition(socket, data) {
  try {
    const { notebookId, position } = data;
    const userId = socket.user.id;

    if (!notebookId || !position) {
      return;
    }

    // Update cursor position in room tracking
    const notebookRoom = notebookRooms.get(notebookId);
    if (notebookRoom && notebookRoom.has(userId)) {
      const userInfo = notebookRoom.get(userId);
      userInfo.cursorPosition = position;
    }

    // Broadcast cursor position to other users
    const roomName = `notebook-${notebookId}`;
    socket.to(roomName).emit('cursor-position', {
      notebookId,
      userId,
      userName: socket.user.name,
      position,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error handling cursor position:', error);
  }
}

/**
 * Handle typing indicators
 */
async function handleTyping(socket, data) {
  try {
    const { notebookId, isTyping } = data;
    const userId = socket.user.id;

    if (!notebookId) {
      return;
    }

    // Update typing status in room tracking
    const notebookRoom = notebookRooms.get(notebookId);
    if (notebookRoom && notebookRoom.has(userId)) {
      const userInfo = notebookRoom.get(userId);
      userInfo.isTyping = isTyping;
    }

    // Broadcast typing status
    const roomName = `notebook-${notebookId}`;
    socket.to(roomName).emit('typing', {
      notebookId,
      userId,
      userName: socket.user.name,
      isTyping,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error handling typing indicator:', error);
  }
}

/**
 * Handle user presence updates
 */
async function handlePresence(socket, data) {
  try {
    const { notebookId, status } = data;
    const userId = socket.user.id;

    if (!notebookId || !status) {
      return;
    }

    // Broadcast presence update
    const roomName = `notebook-${notebookId}`;
    socket.to(roomName).emit('presence', {
      notebookId,
      userId,
      userName: socket.user.name,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error handling presence update:', error);
  }
}

/**
 * Handle chat messages in collaborative sessions
 */
async function handleChatMessage(socket, data) {
  try {
    const { notebookId, message } = data;
    const userId = socket.user.id;

    if (!notebookId || !message) {
      socket.emit('error', { message: 'Notebook ID and message required' });
      return;
    }

    // Validate message content
    if (typeof message !== 'string' || message.trim().length === 0) {
      socket.emit('error', { message: 'Invalid message content' });
      return;
    }

    // Broadcast chat message to room
    const roomName = `notebook-${notebookId}`;
    const chatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      notebookId,
      userId,
      userName: socket.user.name,
      message: message.trim(),
      timestamp: new Date().toISOString()
    };

    io.to(roomName).emit('chat-message', chatMessage);
    console.log(`Chat message from ${socket.user.name} in notebook ${notebookId}`);
  } catch (error) {
    console.error('Error handling chat message:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
}

/**
 * Handle user disconnection
 */
function handleDisconnect(socket) {
  try {
    const connection = activeConnections.get(socket.id);
    if (!connection) {
      return;
    }

    const userId = socket.user.id;
    console.log(`User ${socket.user.name} disconnected`);

    // Notify all notebooks the user was in
    connection.notebooks.forEach(notebookId => {
      const roomName = `notebook-${notebookId}`;
      socket.to(roomName).emit('user-left', {
        notebookId,
        user: {
          id: userId,
          name: socket.user.name
        },
        reason: 'disconnect',
        timestamp: new Date().toISOString()
      });

      // Clean up notebook room tracking
      const notebookRoom = notebookRooms.get(notebookId);
      if (notebookRoom) {
        notebookRoom.delete(userId);
        
        // Clean up empty rooms
        if (notebookRoom.size === 0) {
          notebookRooms.delete(notebookId);
        }
      }
    });

    // Remove connection
    activeConnections.delete(socket.id);
  } catch (error) {
    console.error('Error handling disconnect:', error);
  }
}

/**
 * Clean up inactive connections
 */
function cleanupInactiveConnections() {
  const now = Date.now();
  const inactivityThreshold = 5 * 60 * 1000; // 5 minutes

  activeConnections.forEach((connection, socketId) => {
    if (now - connection.lastActivity > inactivityThreshold) {
      console.log(`Cleaning up inactive connection for ${connection.user.name}`);
      connection.socket.disconnect(true);
      activeConnections.delete(socketId);
    }
  });
}

/**
 * Get current WebSocket IO instance
 */
function getIO() {
  return io;
}

/**
 * Get active connections count
 */
function getActiveConnectionsCount() {
  return activeConnections.size;
}

/**
 * Get notebook room information
 */
function getNotebookRoomInfo(notebookId) {
  const room = notebookRooms.get(notebookId);
  if (!room) {
    return null;
  }

  return {
    notebookId,
    activeUsers: Array.from(room.values()).map(conn => ({
      id: conn.user.id,
      name: conn.user.name,
      email: conn.user.email,
      joinedAt: conn.joinedAt,
      cursorPosition: conn.cursorPosition,
      isTyping: conn.isTyping
    })),
    roomSize: room.size
  };
}

/**
 * Broadcast system message to a notebook room
 */
function broadcastToNotebook(notebookId, event, data) {
  if (!io) {
    console.error('WebSocket not initialized');
    return;
  }

  const roomName = `notebook-${notebookId}`;
  io.to(roomName).emit(event, data);
}

module.exports = {
  setupWebSocket,
  getIO,
  getActiveConnectionsCount,
  getNotebookRoomInfo,
  broadcastToNotebook
};
