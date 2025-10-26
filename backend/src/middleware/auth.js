const jwt = require('jsonwebtoken');
const { 
  CognitoIdentityProviderClient, 
  GetUserCommand 
} = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

// JWT secret for local development (use Cognito in production)
const JWT_SECRET = process.env.JWT_SECRET || 'academic-notebook-secret-key';

// Role definitions
const ROLES = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  RESEARCHER: 'researcher',
  ADMIN: 'admin'
};

// Permission matrix
const PERMISSIONS = {
  [ROLES.STUDENT]: [
    'read_own_notebooks',
    'write_own_notebooks',
    'collaborate_on_shared_notebooks'
  ],
  [ROLES.TEACHER]: [
    'read_own_notebooks',
    'write_own_notebooks',
    'read_student_notebooks',
    'grade_notebooks',
    'manage_class_notebooks',
    'collaborate_on_shared_notebooks'
  ],
  [ROLES.RESEARCHER]: [
    'read_own_notebooks',
    'write_own_notebooks',
    'read_research_notebooks',
    'write_research_notebooks',
    'collaborate_on_shared_notebooks',
    'export_data'
  ],
  [ROLES.ADMIN]: [
    'read_all_notebooks',
    'write_all_notebooks',
    'manage_users',
    'manage_system',
    'export_data',
    'analytics'
  ]
};

/**
 * Middleware to authenticate JWT tokens
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Access token required',
        code: 'NO_TOKEN'
      }
    });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // In production, you would verify with Cognito
    if (process.env.NODE_ENV === 'production') {
      await verifyCognitoToken(token);
    }

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role || ROLES.STUDENT,
      name: decoded.name
    };

    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(403).json({
      error: {
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      }
    });
  }
};

/**
 * Verify token with AWS Cognito
 */
const verifyCognitoToken = async (accessToken) => {
  try {
    const command = new GetUserCommand({
      AccessToken: accessToken
    });
    
    const response = await cognitoClient.send(command);
    return response;
  } catch (error) {
    throw new Error('Cognito token verification failed');
  }
};

/**
 * Middleware to check if user has required permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json({
        error: {
          message: 'User role not found',
          code: 'NO_ROLE'
        }
      });
    }

    const userPermissions = PERMISSIONS[userRole] || [];
    
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({
        error: {
          message: `Permission denied. Required: ${permission}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        }
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has required role
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    
    if (userRole !== requiredRole) {
      return res.status(403).json({
        error: {
          message: `Access denied. Required role: ${requiredRole}`,
          code: 'INSUFFICIENT_ROLE'
        }
      });
    }

    next();
  };
};

/**
 * Check if user can access specific notebook
 */
const canAccessNotebook = async (userId, userRole, notebookId, action = 'read') => {
  // Admin can access everything
  if (userRole === ROLES.ADMIN) {
    return true;
  }

  // Import here to avoid circular dependency
  const { DynamoDBService } = require('../config/aws');
  
  try {
    const notebook = await DynamoDBService.getNotebook(notebookId);
    
    if (!notebook) {
      return false;
    }

    // Owner can do everything
    if (notebook.owner === userId) {
      return true;
    }

    // Check if user is a collaborator
    if (notebook.collaborators.includes(userId)) {
      return true;
    }

    // Teachers can read student notebooks in their class
    if (userRole === ROLES.TEACHER && action === 'read') {
      // Additional logic would go here to check if student is in teacher's class
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking notebook access:', error);
    return false;
  }
};

/**
 * Middleware to check notebook access
 */
const requireNotebookAccess = (action = 'read') => {
  return async (req, res, next) => {
    const notebookId = req.params.notebookId || req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!notebookId) {
      return res.status(400).json({
        error: {
          message: 'Notebook ID required',
          code: 'NO_NOTEBOOK_ID'
        }
      });
    }

    const hasAccess = await canAccessNotebook(userId, userRole, notebookId, action);
    
    if (!hasAccess) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this notebook',
          code: 'NOTEBOOK_ACCESS_DENIED'
        }
      });
    }

    next();
  };
};

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name
  };

  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: process.env.JWT_EXPIRES_IN || '24h' 
  });
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireRole,
  requireNotebookAccess,
  generateToken,
  canAccessNotebook,
  ROLES,
  PERMISSIONS
};
