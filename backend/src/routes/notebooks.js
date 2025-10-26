const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { DynamoDBService, S3Service, SearchService, DYNAMODB_CONFIG, dynamoClient } = require('../config/aws');
const { DescribeTableCommand, CreateTableCommand } = require('@aws-sdk/client-dynamodb');
const { requirePermission, requireNotebookAccess, ROLES } = require('../middleware/auth');
const { triggerBackupLambda } = require('../services/backup');

const router = express.Router();

const AUTO_CREATE_TABLES = (process.env.AUTO_CREATE_DYNAMODB_TABLES || 'true').toLowerCase() === 'true';

async function ensureNotebooksTableExists() {
  if (!AUTO_CREATE_TABLES) return;
  const tableName = DYNAMODB_CONFIG.NOTEBOOKS_TABLE;
  try {
    await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      await dynamoClient.send(new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' }
        ]
      }));
      // wait until ACTIVE
      const start = Date.now();
      const timeoutMs = 30000;
      while (true) {
        const desc = await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
        const status = desc?.Table?.TableStatus;
        if (status === 'ACTIVE') break;
        if (Date.now() - start > timeoutMs) {
          throw new Error(`DynamoDB table ${tableName} not ACTIVE after ${timeoutMs}ms (status=${status})`);
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    } else {
      throw err;
    }
  }
}

async function ensureVersionsTableExists() {
  if (!AUTO_CREATE_TABLES) return;
  const tableName = DYNAMODB_CONFIG.VERSIONS_TABLE;
  try {
    await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      await dynamoClient.send(new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' }
        ]
      }));
      // wait until ACTIVE
      const start = Date.now();
      const timeoutMs = 30000;
      while (true) {
        const desc = await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
        const status = desc?.Table?.TableStatus;
        if (status === 'ACTIVE') break;
        if (Date.now() - start > timeoutMs) {
          throw new Error(`DynamoDB table ${tableName} not ACTIVE after ${timeoutMs}ms (status=${status})`);
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    } else {
      throw err;
    }
  }
}

// Validation schemas
const notebookSchema = Joi.object({
  title: Joi.string().required().min(1).max(255),
  content: Joi.object().required(),
  subject: Joi.string().allow('').optional().max(100),
  course: Joi.string().allow('').optional().max(100),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  collaborators: Joi.array().items(Joi.string().email()).optional()
});

const updateNotebookSchema = Joi.object({
  title: Joi.string().optional().min(1).max(255),
  content: Joi.object().optional(),
  subject: Joi.string().allow('').optional().max(100),
  course: Joi.string().allow('').optional().max(100),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  collaborators: Joi.array().items(Joi.string().email()).optional()
});

/**
 * GET /api/notebooks
 * Get all notebooks for the authenticated user
 */
router.get('/', requirePermission('read_own_notebooks'), async (req, res) => {
  try {
    await ensureNotebooksTableExists();
    const { page = 1, limit = 20, search, subject, course } = req.query;
    const userId = req.user.id;

    // Get user's notebooks from DynamoDB
    let notebooks = await DynamoDBService.getUserNotebooks(userId);

    // Apply filters
    if (search) {
      notebooks = notebooks.filter(notebook => 
        notebook.title.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (subject) {
      notebooks = notebooks.filter(notebook => 
        notebook.subject === subject
      );
    }

    if (course) {
      notebooks = notebooks.filter(notebook => 
        notebook.course === course
      );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedNotebooks = notebooks.slice(startIndex, endIndex);

    res.json({
      notebooks: paginatedNotebooks,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(notebooks.length / limit),
        totalItems: notebooks.length,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notebooks:', error);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'development' && error?.message ? `Failed to fetch notebooks: ${error.message}` : 'Failed to fetch notebooks',
        code: 'FETCH_NOTEBOOKS_ERROR',
        awsCode: error?.name || undefined
      }
    });
  }
});

/**
 * GET /api/notebooks/:id
 * Get a specific notebook by ID
 */
router.get('/:id', requireNotebookAccess('read'), async (req, res) => {
  try {
    await ensureNotebooksTableExists();
    const notebookId = req.params.id;
    const notebook = await DynamoDBService.getNotebook(notebookId);

    if (!notebook) {
      return res.status(404).json({
        error: {
          message: 'Notebook not found',
          code: 'NOTEBOOK_NOT_FOUND'
        }
      });
    }

    res.json({ notebook });
  } catch (error) {
    console.error('Error fetching notebook:', error);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'development' && error?.message ? `Failed to fetch notebook: ${error.message}` : 'Failed to fetch notebook',
        code: 'FETCH_NOTEBOOK_ERROR',
        awsCode: error?.name || undefined
      }
    });
  }
});

/**
 * POST /api/notebooks
 * Create a new notebook
 */
router.post('/', requirePermission('write_own_notebooks'), async (req, res) => {
  try {
    await ensureNotebooksTableExists();
    const { error, value } = notebookSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const notebookId = uuidv4();
    const userId = req.user.id;

    const notebook = {
      id: notebookId,
      title: value.title,
      content: value.content,
      owner: userId,
      collaborators: value.collaborators || [],
      subject: value.subject || '',
      course: value.course || '',
      tags: value.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      status: 'active'
    };

    // Save to DynamoDB (authoritative source)
    await DynamoDBService.createNotebook(notebook);

    // Best-effort secondary operations
    const warnings = [];
    let backup = undefined;

    try {
      const backupResult = await S3Service.uploadNotebook(notebookId, notebook.content, {
        contributor: userId,
        action: 'create',
        version: 1
      });
      backup = { key: backupResult.key, versionId: backupResult.versionId };
    } catch (e) {
      console.warn('S3 backup failed (non-fatal):', e?.message || e);
      warnings.push('Backup to S3 failed');
    }

    try {
      await SearchService.indexNotebook(notebook);
    } catch (e) {
      console.warn('Search indexing failed (non-fatal):', e?.message || e);
      warnings.push('Search indexing failed');
    }

    try {
      await triggerBackupLambda(notebookId, 'create');
    } catch (e) {
      console.warn('Backup lambda trigger failed (non-fatal):', e?.message || e);
      warnings.push('Backup processing trigger failed');
    }

    res.status(201).json({
      notebook,
      backup,
      warnings
    });
  } catch (error) {
    console.error('Error creating notebook:', error);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'development' && error?.message ? `Failed to create notebook: ${error.message}` : 'Failed to create notebook',
        code: 'CREATE_NOTEBOOK_ERROR',
        awsCode: error?.name || undefined
      }
    });
  }
});

/**
 * PUT /api/notebooks/:id
 * Update an existing notebook
 */
router.put('/:id', requireNotebookAccess('write'), async (req, res) => {
  try {
    await ensureNotebooksTableExists();
    const { error, value } = updateNotebookSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const notebookId = req.params.id;
    const userId = req.user.id;

    // Get current notebook
    const currentNotebook = await DynamoDBService.getNotebook(notebookId);
    if (!currentNotebook) {
      return res.status(404).json({
        error: {
          message: 'Notebook not found',
          code: 'NOTEBOOK_NOT_FOUND'
        }
      });
    }

    // Prepare updates
    const updates = { ...value };
    if (updates.content) {
      updates.version = currentNotebook.version + 1;
      
      // Create version snapshot before updating
      try {
        
        // Get user info for display
        let contributorName = userId; // fallback to user ID
        try {
          const user = await DynamoDBService.getUserById(userId);
          contributorName = user?.name || user?.email || userId;
        } catch (userError) {
          console.warn('Failed to fetch user info for version:', userError?.message || userError);
        }
        
        await DynamoDBService.createNotebookVersion(notebookId, {
          version: currentNotebook.version,
          content: currentNotebook.content,
          title: currentNotebook.title,
          contributor: userId,
          contributorName: contributorName,
          action: 'update',
          metadata: {
            previousVersion: currentNotebook.version,
            newVersion: updates.version,
            changeType: 'content_update',
            timestamp: new Date().toISOString()
          }
        });
      } catch (e) {
        console.warn('Version tracking failed (non-fatal):', e?.message || e);
      }
    }

    // Update in DynamoDB (authoritative)
    await DynamoDBService.updateNotebook(notebookId, updates);

    const warnings = [];

    // Best-effort backup and processing
    if (updates.content) {
      try {
        const backupResult = await S3Service.uploadNotebook(notebookId, updates.content, {
          contributor: userId,
          action: 'update',
          version: updates.version,
          previousVersion: currentNotebook.version
        });
      } catch (e) {
        console.warn('S3 backup (update) failed (non-fatal):', e?.message || e);
        warnings.push('Backup to S3 failed');
      }

      try {
        await triggerBackupLambda(notebookId, 'update');
      } catch (e) {
        console.warn('Backup lambda (update) failed (non-fatal):', e?.message || e);
        warnings.push('Backup processing trigger failed');
      }
    }

    // Get updated notebook
    const updatedNotebook = await DynamoDBService.getNotebook(notebookId);

    try {
      await SearchService.indexNotebook(updatedNotebook);
    } catch (e) {
      console.warn('Search indexing (update) failed (non-fatal):', e?.message || e);
      warnings.push('Search indexing failed');
    }

    res.json({
      notebook: updatedNotebook,
      message: 'Notebook updated successfully',
      warnings
    });
  } catch (error) {
    console.error('Error updating notebook:', error);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'development' && error?.message ? `Failed to update notebook: ${error.message}` : 'Failed to update notebook',
        code: 'UPDATE_NOTEBOOK_ERROR',
        awsCode: error?.name || undefined
      }
    });
  }
});

/**
 * DELETE /api/notebooks/:id
 * Delete a notebook (hard delete by owner; removed for all)
 */
router.delete('/:id', requireNotebookAccess('write'), async (req, res) => {
  try {
    console.log('Delete request for notebook:', req.params.id, 'by user:', req.user.id);
    await ensureNotebooksTableExists();
    const notebookId = req.params.id;
    const userId = req.user.id;

    // Only owner can delete
    const notebook = await DynamoDBService.getNotebook(notebookId);
    if (!notebook) {
      console.log('Notebook not found:', notebookId);
      return res.status(404).json({ error: { message: 'Notebook not found', code: 'NOTEBOOK_NOT_FOUND' } });
    }
    if (notebook.owner !== userId) {
      console.log('User not owner:', userId, 'notebook owner:', notebook.owner);
      return res.status(403).json({ error: { message: 'Only the owner can delete this notebook', code: 'NOT_OWNER' } });
    }

    console.log('Deleting notebook:', notebookId);
    // Hard delete from DynamoDB
    await DynamoDBService.deleteNotebook(notebookId);
    console.log('Notebook deleted successfully');

    // Best-effort cleanup trigger
    try { await triggerBackupLambda(notebookId, 'delete'); } catch {}

    res.json({ message: 'Notebook deleted successfully' });
  } catch (error) {
    console.error('Error deleting notebook:', error);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'development' && error?.message ? `Failed to delete notebook: ${error.message}` : 'Failed to delete notebook',
        code: 'DELETE_NOTEBOOK_ERROR',
        awsCode: error?.name || undefined
      }
    });
  }
});

/**
 * POST /api/notebooks/:id/collaborate
 * Add collaborators to a notebook
 */
router.post('/:id/collaborate', requireNotebookAccess('write'), async (req, res) => {
  try {
    await ensureNotebooksTableExists();
    const notebookId = req.params.id;
    const { collaborators, collaboratorIds } = req.body;
    const collaboratorList = collaborators || collaboratorIds;

    if (!Array.isArray(collaboratorList)) {
      return res.status(400).json({
        error: {
          message: 'Collaborators must be an array',
          code: 'INVALID_COLLABORATORS'
        }
      });
    }

    // Get current notebook
    const notebook = await DynamoDBService.getNotebook(notebookId);
    if (!notebook) {
      return res.status(404).json({
        error: {
          message: 'Notebook not found',
          code: 'NOTEBOOK_NOT_FOUND'
        }
      });
    }

    // Merge collaborators (avoid duplicates)
    const updatedCollaborators = [...new Set([...notebook.collaborators, ...collaboratorList])];

    // Update notebook
    await DynamoDBService.updateNotebook(notebookId, {
      collaborators: updatedCollaborators
    });

    res.json({
      message: 'Collaborators added successfully',
      collaborators: updatedCollaborators
    });
  } catch (error) {
    console.error('Error adding collaborators:', error);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'development' && error?.message ? `Failed to add collaborators: ${error.message}` : 'Failed to add collaborators',
        code: 'ADD_COLLABORATORS_ERROR',
        awsCode: error?.name || undefined
      }
    });
  }
});

/**
 * GET /api/notebooks/:id/activity
 * Get notebook activity log
 */
router.get('/:id/activity', requireNotebookAccess('read'), async (req, res) => {
  try {
    await ensureNotebooksTableExists();
    const notebookId = req.params.id;
    
    // Get S3 versions for activity tracking
    const versions = await S3Service.listVersions(notebookId);
    
    const activity = versions.map(version => ({
      versionId: version.VersionId,
      lastModified: version.LastModified,
      size: version.Size,
      contributor: version.Metadata?.contributor || 'unknown'
    })).sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    res.json({
      notebookId,
      activity,
      totalVersions: activity.length
    });
  } catch (error) {
    console.error('Error fetching notebook activity:', error);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'development' && error?.message ? `Failed to fetch notebook activity: ${error.message}` : 'Failed to fetch notebook activity',
        code: 'FETCH_ACTIVITY_ERROR',
        awsCode: error?.name || undefined
      }
    });
  }
});

/**
 * GET /api/notebooks/:id/versions
 * Get version history for a notebook
 */
router.get('/:id/versions', requireNotebookAccess('read'), async (req, res) => {
  try {
    await ensureNotebooksTableExists();
    await ensureVersionsTableExists();
    const notebookId = req.params.id;
    
    const versions = await DynamoDBService.getNotebookVersions(notebookId);
    
    res.json({
      notebookId,
      versions,
      totalVersions: versions.length
    });
  } catch (error) {
    console.error('Error fetching notebook versions:', error);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'development' && error?.message ? `Failed to fetch versions: ${error.message}` : 'Failed to fetch versions',
        code: 'FETCH_VERSIONS_ERROR',
        awsCode: error?.name || undefined
      }
    });
  }
});

/**
 * GET /api/notebooks/:id/versions/:version
 * Get a specific version of a notebook
 */
router.get('/:id/versions/:version', requireNotebookAccess('read'), async (req, res) => {
  try {
    await ensureNotebooksTableExists();
    await ensureVersionsTableExists();
    const notebookId = req.params.id;
    const version = parseInt(req.params.version);
    
    const versionData = await DynamoDBService.getNotebookVersion(notebookId, version);
    
    if (!versionData) {
      return res.status(404).json({
        error: {
          message: 'Version not found',
          code: 'VERSION_NOT_FOUND'
        }
      });
    }
    
    res.json({
      notebookId,
      version: versionData
    });
  } catch (error) {
    console.error('Error fetching notebook version:', error);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'development' && error?.message ? `Failed to fetch version: ${error.message}` : 'Failed to fetch version',
        code: 'FETCH_VERSION_ERROR',
        awsCode: error?.name || undefined
      }
    });
  }
});

/**
 * POST /api/notebooks/:id/versions/:version/restore
 * Restore a notebook to a specific version
 */
router.post('/:id/versions/:version/restore', requireNotebookAccess('write'), async (req, res) => {
  try {
    await ensureNotebooksTableExists();
    await ensureVersionsTableExists();
    const notebookId = req.params.id;
    const version = parseInt(req.params.version);
    const userId = req.user.id;
    
    // Get the version to restore
    const versionData = await DynamoDBService.getNotebookVersion(notebookId, version);
    if (!versionData) {
      return res.status(404).json({
        error: {
          message: 'Version not found',
          code: 'VERSION_NOT_FOUND'
        }
      });
    }
    
    // Get current notebook
    const currentNotebook = await DynamoDBService.getNotebook(notebookId);
    if (!currentNotebook) {
      return res.status(404).json({
        error: {
          message: 'Notebook not found',
          code: 'NOTEBOOK_NOT_FOUND'
        }
      });
    }
    
    // Create version snapshot of current state before restore
    try {
      let contributorName = userId; // fallback to user ID
      try {
        const user = await DynamoDBService.getUserById(userId);
        contributorName = user?.name || user?.email || userId;
      } catch (userError) {
        console.warn('Failed to fetch user info for restore backup:', userError?.message || userError);
      }
      
      await DynamoDBService.createNotebookVersion(notebookId, {
        version: currentNotebook.version,
        content: currentNotebook.content,
        title: currentNotebook.title,
        contributor: userId,
        contributorName: contributorName,
        action: 'restore_backup',
        metadata: {
          restoredToVersion: version,
          changeType: 'restore_backup',
          timestamp: new Date().toISOString()
        }
      });
    } catch (e) {
      console.warn('Version backup failed (non-fatal):', e?.message || e);
    }
    
    // Restore to the specified version
    const newVersion = currentNotebook.version + 1;
    await DynamoDBService.updateNotebook(notebookId, {
      content: versionData.content,
      title: versionData.title,
      version: newVersion
    });
    
    // Create version entry for the restore action
    let contributorName = userId; // fallback to user ID
    try {
      const user = await DynamoDBService.getUserById(userId);
      contributorName = user?.name || user?.email || userId;
    } catch (userError) {
      console.warn('Failed to fetch user info for restore:', userError?.message || userError);
    }
    
    await DynamoDBService.createNotebookVersion(notebookId, {
      version: newVersion,
      content: versionData.content,
      title: versionData.title,
      contributor: userId,
      contributorName: contributorName,
      action: 'restore',
      metadata: {
        restoredFromVersion: version,
        changeType: 'restore',
        timestamp: new Date().toISOString()
      }
    });
    
    res.json({
      message: `Notebook restored to version ${version}`,
      restoredVersion: version,
      newVersion: newVersion
    });
  } catch (error) {
    console.error('Error restoring notebook version:', error);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'development' && error?.message ? `Failed to restore version: ${error.message}` : 'Failed to restore version',
        code: 'RESTORE_VERSION_ERROR',
        awsCode: error?.name || undefined
      }
    });
  }
});
router.post('/:id/duplicate', requireNotebookAccess('read'), async (req, res) => {
  try {
    await ensureNotebooksTableExists();
    const sourceNotebookId = req.params.id;
    const userId = req.user.id;
    const { title } = req.body;

    // Get source notebook
    const sourceNotebook = await DynamoDBService.getNotebook(sourceNotebookId);
    if (!sourceNotebook) {
      return res.status(404).json({
        error: {
          message: 'Source notebook not found',
          code: 'NOTEBOOK_NOT_FOUND'
        }
      });
    }

    // Create new notebook
    const newNotebookId = uuidv4();
    const duplicatedNotebook = {
      id: newNotebookId,
      title: title || `Copy of ${sourceNotebook.title}`,
      content: sourceNotebook.content,
      owner: userId,
      collaborators: [],
      subject: sourceNotebook.subject,
      course: sourceNotebook.course,
      tags: sourceNotebook.tags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      status: 'active'
    };

    // Save to DynamoDB
    await DynamoDBService.createNotebook(duplicatedNotebook);

    // Create backup in S3
    await S3Service.uploadNotebook(newNotebookId, duplicatedNotebook.content, {
      contributor: userId,
      action: 'duplicate',
      sourceNotebook: sourceNotebookId
    });

    // Index in OpenSearch
    await SearchService.indexNotebook(duplicatedNotebook);

    res.status(201).json({
      notebook: duplicatedNotebook,
      message: 'Notebook duplicated successfully'
    });
  } catch (error) {
    console.error('Error duplicating notebook:', error);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'development' && error?.message ? `Failed to duplicate notebook: ${error.message}` : 'Failed to duplicate notebook',
        code: 'DUPLICATE_NOTEBOOK_ERROR',
        awsCode: error?.name || undefined
      }
    });
  }
});

module.exports = router;
