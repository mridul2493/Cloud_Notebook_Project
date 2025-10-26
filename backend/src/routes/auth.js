const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { generateToken, ROLES } = require('../middleware/auth');
const { dynamoClient, DYNAMODB_CONFIG } = require('../config/aws');
const { DescribeTableCommand, CreateTableCommand } = require('@aws-sdk/client-dynamodb');

const AUTO_CREATE_TABLES = (process.env.AUTO_CREATE_DYNAMODB_TABLES || 'true').toLowerCase() === 'true';

async function ensureUsersTableExists() {
  if (!AUTO_CREATE_TABLES) return;
  try {
    await dynamoClient.send(new DescribeTableCommand({ TableName: DYNAMODB_CONFIG.USERS_TABLE }));
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      const command = new CreateTableCommand({
        TableName: DYNAMODB_CONFIG.USERS_TABLE,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' }
        ]
      });
      await dynamoClient.send(command);
      // Wait until table is ACTIVE
      const start = Date.now();
      const timeoutMs = 30000;
      while (true) {
        const desc = await dynamoClient.send(new DescribeTableCommand({ TableName: DYNAMODB_CONFIG.USERS_TABLE }));
        const status = desc?.Table?.TableStatus;
        if (status === 'ACTIVE') break;
        if (Date.now() - start > timeoutMs) {
          throw new Error(`DynamoDB table ${DYNAMODB_CONFIG.USERS_TABLE} not ACTIVE after ${timeoutMs}ms (status=${status})`);
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    } else {
      throw err;
    }
  }
}

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().required().min(2).max(100),
  role: Joi.string().valid(...Object.values(ROLES)).default(ROLES.STUDENT),
  institution: Joi.string().optional().max(200),
  department: Joi.string().optional().max(100)
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    await ensureUsersTableExists();
    const { error, value } = registerSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const { email, password, name, role, institution, department } = value;

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: {
          message: 'User already exists with this email',
          code: 'USER_EXISTS'
        }
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = uuidv4();
    const user = {
      id: userId,
      email,
      password: hashedPassword,
      name,
      role,
      institution: institution || '',
      department: department || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
      email_verified: false
    };

    // Save to DynamoDB
    await createUser(user);

    // Generate JWT token
    const token = generateToken({
      id: userId,
      email,
      role,
      name
    });

    // Remove password from response
    const { password: _, ...userResponse } = user;

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'development' && error?.message ? `Failed to register user: ${error.message}` : 'Failed to register user',
        code: 'REGISTRATION_ERROR',
        awsCode: error?.name || undefined
      }
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const { email, password } = value;

    // Get user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: {
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        error: {
          message: 'Account is not active',
          code: 'ACCOUNT_INACTIVE'
        }
      });
    }

    // Update last login
    await updateUser(user.id, {
      last_login: new Date().toISOString()
    });

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    });

    // Remove password from response
    const { password: _, ...userResponse } = user;

    res.json({
      message: 'Login successful',
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to authenticate user',
        code: 'LOGIN_ERROR'
      }
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: {
          message: 'Refresh token required',
          code: 'NO_REFRESH_TOKEN'
        }
      });
    }

    // In a production environment, you would verify the refresh token
    // and generate a new access token
    
    res.json({
      message: 'Token refresh not implemented - use Cognito in production',
      code: 'NOT_IMPLEMENTED'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to refresh token',
        code: 'REFRESH_ERROR'
      }
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (in production, this would invalidate tokens)
 */
router.post('/logout', (req, res) => {
  // In a stateless JWT setup, logout is handled client-side
  // In production with Cognito, you would revoke the token
  res.json({
    message: 'Logout successful'
  });
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Access token required',
          code: 'NO_TOKEN'
        }
      });
    }

    // Verify token and get user (simplified for demo)
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'academic-notebook-secret-key';
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      });
    }

    // Remove password from response
    const { password: _, ...userResponse } = user;

    res.json({
      user: userResponse
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get user profile',
        code: 'PROFILE_ERROR'
      }
    });
  }
});

/**
 * GET /api/auth/users
 * List users (for collaboration sharing)
 */
router.get('/users', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: { message: 'Access token required', code: 'NO_TOKEN' }
      });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'academic-notebook-secret-key';
    jwt.verify(token, JWT_SECRET);

    const search = (req.query.search || '').toString().toLowerCase();
    const users = await listUsers();
    const filtered = users.filter(u =>
      !search ||
      u.email.toLowerCase().includes(search) ||
      (u.name || '').toLowerCase().includes(search)
    );

    res.json({
      users: filtered.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role }))
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({
      error: { message: 'Failed to list users', code: 'LIST_USERS_ERROR' }
    });
  }
});

// Helper functions for user management
async function createUser(user) {
  const { PutItemCommand } = require('@aws-sdk/client-dynamodb');

  const command = new PutItemCommand({
    TableName: DYNAMODB_CONFIG.USERS_TABLE,
    Item: {
      id: { S: user.id },
      email: { S: user.email },
      password: { S: user.password },
      name: { S: user.name },
      role: { S: user.role },
      institution: { S: user.institution },
      department: { S: user.department },
      created_at: { S: user.created_at },
      updated_at: { S: user.updated_at },
      status: { S: user.status },
      email_verified: { BOOL: user.email_verified }
    }
  });

  const result = await dynamoClient.send(command);
  if (process.env.NODE_ENV === 'development') {
    // Log where the user was saved for troubleshooting
    console.log(
      `DynamoDB PutItem to table ${DYNAMODB_CONFIG.USERS_TABLE} in region ${process.env.AWS_REGION || 'us-east-1'} (RequestId: ${result?.$metadata?.requestId || 'n/a'})`
    );
  }
}

async function getUserByEmail(email) {
  const { ScanCommand } = require('@aws-sdk/client-dynamodb');
  await ensureUsersTableExists();

  const command = new ScanCommand({
    TableName: DYNAMODB_CONFIG.USERS_TABLE,
    FilterExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': { S: email }
    }
  });

  const result = await dynamoClient.send(command);
  
  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  const item = result.Items[0];
  return {
    id: item.id.S,
    email: item.email.S,
    password: item.password.S,
    name: item.name.S,
    role: item.role.S,
    institution: item.institution?.S || '',
    department: item.department?.S || '',
    created_at: item.created_at.S,
    updated_at: item.updated_at.S,
    status: item.status.S,
    email_verified: item.email_verified?.BOOL || false,
    last_login: item.last_login?.S
  };
}

async function getUserById(id) {
  const { GetItemCommand } = require('@aws-sdk/client-dynamodb');

  const command = new GetItemCommand({
    TableName: DYNAMODB_CONFIG.USERS_TABLE,
    Key: { id: { S: id } }
  });

  const result = await dynamoClient.send(command);
  
  if (!result.Item) {
    return null;
  }

  const item = result.Item;
  return {
    id: item.id.S,
    email: item.email.S,
    password: item.password.S,
    name: item.name.S,
    role: item.role.S,
    institution: item.institution?.S || '',
    department: item.department?.S || '',
    created_at: item.created_at.S,
    updated_at: item.updated_at.S,
    status: item.status.S,
    email_verified: item.email_verified?.BOOL || false,
    last_login: item.last_login?.S
  };
}

async function updateUser(id, updates) {
  const { UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

  const updateExpression = [];
  const expressionAttributeValues = {};

  Object.keys(updates).forEach(key => {
    updateExpression.push(`${key} = :${key}`);
    expressionAttributeValues[`:${key}`] = { S: updates[key] };
  });

  updateExpression.push('updated_at = :updated_at');
  expressionAttributeValues[':updated_at'] = { S: new Date().toISOString() };

  const command = new UpdateItemCommand({
    TableName: DYNAMODB_CONFIG.USERS_TABLE,
    Key: { id: { S: id } },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeValues: expressionAttributeValues
  });

  await dynamoClient.send(command);
}

async function listUsers() {
  const { ScanCommand } = require('@aws-sdk/client-dynamodb');
  const { DYNAMODB_CONFIG } = require('../config/aws');

  const command = new ScanCommand({
    TableName: DYNAMODB_CONFIG.USERS_TABLE
  });

  const result = await dynamoClient.send(command);
  return (result.Items || []).map(item => ({
    id: item.id.S,
    email: item.email.S,
    name: item.name?.S || '',
    role: item.role?.S || 'student'
  }));
}

module.exports = router;
