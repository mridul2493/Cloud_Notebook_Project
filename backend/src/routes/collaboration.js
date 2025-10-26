const express = require('express');
const { requireNotebookAccess } = require('../middleware/auth');
const { DynamoDBService } = require('../config/aws');

const router = express.Router();

/**
 * GET /api/collaboration/:notebookId/status
 * Get real-time collaboration status for a notebook
 */
router.get('/:notebookId/status', requireNotebookAccess('read'), async (req, res) => {
  try {
    const notebookId = req.params.notebookId;
    
    // Get active collaborators (mock data - in production, this would come from WebSocket connections)
    const activeCollaborators = await getActiveCollaborators(notebookId);
    
    // Get collaboration history
    const collaborationHistory = await getCollaborationHistory(notebookId);
    
    res.json({
      notebookId,
      activeCollaborators,
      collaborationHistory,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting collaboration status:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get collaboration status',
        code: 'COLLABORATION_STATUS_ERROR'
      }
    });
  }
});

/**
 * POST /api/collaboration/:notebookId/join
 * Join a collaborative editing session
 */
router.post('/:notebookId/join', requireNotebookAccess('read'), async (req, res) => {
  try {
    const notebookId = req.params.notebookId;
    const userId = req.user.id;
    const userName = req.user.name;
    
    // Record collaboration session
    await recordCollaborationEvent(notebookId, userId, 'join', {
      userName,
      timestamp: new Date().toISOString()
    });
    
    // Get notebook data for the session
    const notebook = await DynamoDBService.getNotebook(notebookId);
    if (!notebook) {
      return res.status(404).json({
        error: {
          message: 'Notebook not found',
          code: 'NOTEBOOK_NOT_FOUND'
        }
      });
    }
    
    // Get current active collaborators
    const activeCollaborators = await getActiveCollaborators(notebookId);
    
    res.json({
      message: 'Successfully joined collaboration session',
      notebookId,
      notebook: {
        id: notebook.id,
        title: notebook.title,
        content: notebook.content,
        version: notebook.version
      },
      activeCollaborators,
      sessionId: generateSessionId(notebookId, userId)
    });
  } catch (error) {
    console.error('Error joining collaboration:', error);
    res.status(500).json({
      error: {
        message: 'Failed to join collaboration session',
        code: 'JOIN_COLLABORATION_ERROR'
      }
    });
  }
});

/**
 * POST /api/collaboration/:notebookId/leave
 * Leave a collaborative editing session
 */
router.post('/:notebookId/leave', requireNotebookAccess('read'), async (req, res) => {
  try {
    const notebookId = req.params.notebookId;
    const userId = req.user.id;
    const userName = req.user.name;
    
    // Record collaboration event
    await recordCollaborationEvent(notebookId, userId, 'leave', {
      userName,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      message: 'Successfully left collaboration session',
      notebookId
    });
  } catch (error) {
    console.error('Error leaving collaboration:', error);
    res.status(500).json({
      error: {
        message: 'Failed to leave collaboration session',
        code: 'LEAVE_COLLABORATION_ERROR'
      }
    });
  }
});

/**
 * POST /api/collaboration/:notebookId/operations
 * Submit operational transformation operations for real-time collaboration
 */
router.post('/:notebookId/operations', requireNotebookAccess('write'), async (req, res) => {
  try {
    const notebookId = req.params.notebookId;
    const userId = req.user.id;
    const { operations, baseVersion } = req.body;
    
    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({
        error: {
          message: 'Operations array is required',
          code: 'NO_OPERATIONS'
        }
      });
    }
    
    // Get current notebook version
    const notebook = await DynamoDBService.getNotebook(notebookId);
    if (!notebook) {
      return res.status(404).json({
        error: {
          message: 'Notebook not found',
          code: 'NOTEBOOK_NOT_FOUND'
        }
      });
    }
    
    // Check for version conflicts
    if (baseVersion && baseVersion !== notebook.version) {
      return res.status(409).json({
        error: {
          message: 'Version conflict detected',
          code: 'VERSION_CONFLICT',
          currentVersion: notebook.version,
          baseVersion
        }
      });
    }
    
    // Apply operations (simplified - in production, use proper OT library)
    const updatedContent = applyOperations(notebook.content, operations);
    const newVersion = notebook.version + 1;
    
    // Update notebook
    await DynamoDBService.updateNotebook(notebookId, {
      content: updatedContent,
      version: newVersion
    });
    
    // Record collaboration event
    await recordCollaborationEvent(notebookId, userId, 'edit', {
      operations: operations.length,
      version: newVersion,
      timestamp: new Date().toISOString()
    });
    
    // Broadcast to other collaborators via WebSocket
    const io = require('../services/websocket').getIO();
    if (io) {
      io.to(`notebook-${notebookId}`).emit('operations', {
        notebookId,
        operations,
        version: newVersion,
        userId,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      message: 'Operations applied successfully',
      version: newVersion,
      operationsApplied: operations.length
    });
  } catch (error) {
    console.error('Error applying operations:', error);
    res.status(500).json({
      error: {
        message: 'Failed to apply operations',
        code: 'APPLY_OPERATIONS_ERROR'
      }
    });
  }
});

/**
 * GET /api/collaboration/:notebookId/conflicts
 * Get any unresolved conflicts for the notebook
 */
router.get('/:notebookId/conflicts', requireNotebookAccess('read'), async (req, res) => {
  try {
    const notebookId = req.params.notebookId;
    
    // Get conflicts (mock data - in production, this would track actual conflicts)
    const conflicts = await getNotebookConflicts(notebookId);
    
    res.json({
      notebookId,
      conflicts,
      hasConflicts: conflicts.length > 0
    });
  } catch (error) {
    console.error('Error getting conflicts:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get notebook conflicts',
        code: 'GET_CONFLICTS_ERROR'
      }
    });
  }
});

/**
 * POST /api/collaboration/:notebookId/resolve-conflict
 * Resolve a collaboration conflict
 */
router.post('/:notebookId/resolve-conflict', requireNotebookAccess('write'), async (req, res) => {
  try {
    const notebookId = req.params.notebookId;
    const userId = req.user.id;
    const { conflictId, resolution } = req.body;
    
    if (!conflictId || !resolution) {
      return res.status(400).json({
        error: {
          message: 'Conflict ID and resolution are required',
          code: 'MISSING_CONFLICT_DATA'
        }
      });
    }
    
    // Resolve conflict (simplified implementation)
    await resolveConflict(notebookId, conflictId, resolution, userId);
    
    // Record resolution event
    await recordCollaborationEvent(notebookId, userId, 'resolve_conflict', {
      conflictId,
      resolution: resolution.type,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      message: 'Conflict resolved successfully',
      conflictId,
      resolution
    });
  } catch (error) {
    console.error('Error resolving conflict:', error);
    res.status(500).json({
      error: {
        message: 'Failed to resolve conflict',
        code: 'RESOLVE_CONFLICT_ERROR'
      }
    });
  }
});

/**
 * GET /api/collaboration/:notebookId/analytics
 * Get collaboration analytics for a notebook
 */
router.get('/:notebookId/analytics', requireNotebookAccess('read'), async (req, res) => {
  try {
    const notebookId = req.params.notebookId;
    
    // Get collaboration analytics
    const analytics = await getCollaborationAnalytics(notebookId);
    
    res.json({
      notebookId,
      analytics
    });
  } catch (error) {
    console.error('Error getting collaboration analytics:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get collaboration analytics',
        code: 'COLLABORATION_ANALYTICS_ERROR'
      }
    });
  }
});

// Helper functions
async function getActiveCollaborators(notebookId) {
  // Mock data - in production, this would track WebSocket connections
  return [
    {
      userId: 'user-1',
      userName: 'Alice Johnson',
      joinedAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      cursorPosition: { line: 10, column: 15 },
      isTyping: false
    },
    {
      userId: 'user-2',
      userName: 'Bob Smith',
      joinedAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
      cursorPosition: { line: 25, column: 8 },
      isTyping: true
    }
  ];
}

async function getCollaborationHistory(notebookId) {
  // Mock data - in production, this would come from DynamoDB
  return [
    {
      eventId: 'event-1',
      userId: 'user-1',
      userName: 'Alice Johnson',
      action: 'join',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      metadata: {}
    },
    {
      eventId: 'event-2',
      userId: 'user-2',
      userName: 'Bob Smith',
      action: 'join',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      metadata: {}
    },
    {
      eventId: 'event-3',
      userId: 'user-1',
      userName: 'Alice Johnson',
      action: 'edit',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      metadata: { operations: 3, version: 5 }
    }
  ];
}

async function recordCollaborationEvent(notebookId, userId, action, metadata) {
  // In production, this would save to DynamoDB collaboration table
  console.log('Recording collaboration event:', {
    notebookId,
    userId,
    action,
    metadata,
    timestamp: new Date().toISOString()
  });
}

function generateSessionId(notebookId, userId) {
  return `${notebookId}-${userId}-${Date.now()}`;
}

function applyOperations(content, operations) {
  // Simplified operational transformation
  // In production, use a proper OT library like ShareJS or Yjs
  let updatedContent = { ...content };
  
  operations.forEach(op => {
    switch (op.type) {
      case 'insert':
        // Apply insert operation
        break;
      case 'delete':
        // Apply delete operation
        break;
      case 'retain':
        // Apply retain operation
        break;
      default:
        console.log('Unknown operation type:', op.type);
    }
  });
  
  return updatedContent;
}

async function getNotebookConflicts(notebookId) {
  // Mock conflicts - in production, this would track actual conflicts
  return [
    {
      conflictId: 'conflict-1',
      type: 'concurrent_edit',
      description: 'Two users edited the same paragraph simultaneously',
      users: ['user-1', 'user-2'],
      timestamp: new Date(Date.now() - 30000).toISOString(),
      resolved: false
    }
  ];
}

async function resolveConflict(notebookId, conflictId, resolution, userId) {
  // In production, this would update the conflict resolution in the database
  console.log('Resolving conflict:', {
    notebookId,
    conflictId,
    resolution,
    resolvedBy: userId,
    timestamp: new Date().toISOString()
  });
}

async function getCollaborationAnalytics(notebookId) {
  // Mock analytics - in production, this would aggregate real data
  return {
    totalCollaborators: 5,
    activeCollaborators: 2,
    totalSessions: 23,
    averageSessionDuration: '00:45:30',
    totalEdits: 156,
    conflictsResolved: 3,
    collaborationScore: 8.5, // Out of 10
    topContributors: [
      { userId: 'user-1', userName: 'Alice Johnson', edits: 45 },
      { userId: 'user-2', userName: 'Bob Smith', edits: 38 },
      { userId: 'user-3', userName: 'Carol Davis', edits: 32 }
    ],
    activityTimeline: [
      { date: '2024-01-01', sessions: 3, edits: 12 },
      { date: '2024-01-02', sessions: 5, edits: 18 },
      { date: '2024-01-03', sessions: 2, edits: 8 },
      { date: '2024-01-04', sessions: 4, edits: 15 },
      { date: '2024-01-05', sessions: 3, edits: 11 }
    ]
  };
}

module.exports = router;
