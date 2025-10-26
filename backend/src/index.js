const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
// Load env from backend/env explicitly so local creds are picked up
require('dotenv').config({ path: path.resolve(__dirname, '..', 'env') });

const notebookRoutes = require('./routes/notebooks');
const authRoutes = require('./routes/auth');
const collaborationRoutes = require('./routes/collaboration');
const searchRoutes = require('./routes/search');
const versionRoutes = require('./routes/versions');
const { authenticateToken } = require('./middleware/auth');
const { setupWebSocket } = require('./services/websocket');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://localhost:3001", // Next.js fallback port
    "http://localhost:3000"  // Original port
  ],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'academic-notebook-backend'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/notebooks', authenticateToken, notebookRoutes);
app.use('/api/collaboration', authenticateToken, collaborationRoutes);
app.use('/api/search', authenticateToken, searchRoutes);
app.use('/api/versions', authenticateToken, versionRoutes);

// WebSocket setup
setupWebSocket(io);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      status: 404
    }
  });
});

const PORT = process.env.PORT || 5003;

server.listen(PORT, () => {
  console.log(`🚀 Academic Notebook Backend running on port ${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 WebSocket enabled for real-time collaboration`);
});
