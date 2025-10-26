const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { S3Service, DynamoDBService } = require('../config/aws');

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

/**
 * Trigger Lambda function for backup processing
 */
async function triggerBackupLambda(notebookId, action, metadata = {}) {
  try {
    const payload = {
      notebookId,
      action, // 'create', 'update', 'delete', 'restore'
      timestamp: new Date().toISOString(),
      metadata
    };

    const command = new InvokeCommand({
      FunctionName: process.env.BACKUP_LAMBDA_FUNCTION_NAME || 'academic-notebook-backup',
      InvocationType: 'Event', // Asynchronous invocation
      Payload: JSON.stringify(payload)
    });

    const result = await lambdaClient.send(command);
    console.log(`Backup Lambda triggered for notebook ${notebookId}, action: ${action}`);
    
    return {
      success: true,
      statusCode: result.StatusCode,
      payload
    };
  } catch (error) {
    console.error('Error triggering backup Lambda:', error);
    
    // Fallback to direct backup if Lambda fails
    await performDirectBackup(notebookId, action, metadata);
    
    return {
      success: false,
      error: error.message,
      fallbackUsed: true
    };
  }
}

/**
 * Perform direct backup without Lambda (fallback)
 */
async function performDirectBackup(notebookId, action, metadata = {}) {
  try {
    console.log(`Performing direct backup for notebook ${notebookId}`);
    
    switch (action) {
      case 'create':
      case 'update':
        await createBackupSnapshot(notebookId, metadata);
        break;
      case 'delete':
        await archiveDeletedNotebook(notebookId, metadata);
        break;
      case 'restore':
        await logRestoreOperation(notebookId, metadata);
        break;
      default:
        console.log(`Unknown backup action: ${action}`);
    }
  } catch (error) {
    console.error('Error in direct backup:', error);
    throw error;
  }
}

/**
 * Create a backup snapshot of the notebook
 */
async function createBackupSnapshot(notebookId, metadata) {
  try {
    // Get current notebook data
    const notebook = await DynamoDBService.getNotebook(notebookId);
    if (!notebook) {
      throw new Error('Notebook not found for backup');
    }

    // Create comprehensive backup data
    const backupData = {
      notebook,
      metadata: {
        ...metadata,
        backupType: 'snapshot',
        backupTimestamp: new Date().toISOString(),
        version: notebook.version
      },
      systemInfo: {
        backupSource: 'direct',
        nodeVersion: process.version,
        platform: process.platform
      }
    };

    // Upload to S3 with backup-specific key
    const backupKey = `backups/${notebookId}/${Date.now()}-v${notebook.version}.json`;
    
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || 'academic-notebooks-storage',
      Key: backupKey,
      Body: JSON.stringify(backupData, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
      Metadata: {
        notebookId,
        backupType: 'snapshot',
        version: notebook.version.toString(),
        timestamp: new Date().toISOString()
      }
    });

    const result = await s3Client.send(command);
    
    console.log(`Backup snapshot created: ${backupKey}`);
    return {
      backupKey,
      versionId: result.VersionId,
      etag: result.ETag
    };
  } catch (error) {
    console.error('Error creating backup snapshot:', error);
    throw error;
  }
}

/**
 * Archive a deleted notebook
 */
async function archiveDeletedNotebook(notebookId, metadata) {
  try {
    // Get notebook data before it's fully deleted
    const notebook = await DynamoDBService.getNotebook(notebookId);
    if (!notebook) {
      console.log('Notebook already deleted, creating archive from metadata');
    }

    // Create archive data
    const archiveData = {
      notebookId,
      originalNotebook: notebook,
      deletionInfo: {
        deletedBy: metadata.deletedBy || 'system',
        deletedAt: new Date().toISOString(),
        reason: metadata.reason || 'user_deletion'
      },
      archiveMetadata: {
        archiveType: 'deletion',
        retentionPeriod: '7 years', // Academic retention requirement
        canRestore: true,
        restoreDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      }
    };

    // Upload to S3 archive location
    const archiveKey = `archives/deleted/${notebookId}/${Date.now()}-deletion-archive.json`;
    
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || 'academic-notebooks-storage',
      Key: archiveKey,
      Body: JSON.stringify(archiveData, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
      StorageClass: 'STANDARD_IA', // Infrequent Access for cost optimization
      Metadata: {
        notebookId,
        archiveType: 'deletion',
        deletedAt: new Date().toISOString(),
        canRestore: 'true'
      }
    });

    await s3Client.send(command);
    
    console.log(`Deletion archive created: ${archiveKey}`);
    return { archiveKey };
  } catch (error) {
    console.error('Error archiving deleted notebook:', error);
    throw error;
  }
}

/**
 * Log restore operation
 */
async function logRestoreOperation(notebookId, metadata) {
  try {
    const restoreLog = {
      notebookId,
      restoreInfo: {
        restoredBy: metadata.contributor || 'system',
        restoredAt: new Date().toISOString(),
        restoredFromVersion: metadata.restoredFromVersion,
        newVersion: metadata.version
      },
      operationMetadata: {
        operationType: 'restore',
        success: true,
        processingTime: metadata.processingTime || 0
      }
    };

    // Upload restore log
    const logKey = `logs/restore/${notebookId}/${Date.now()}-restore-log.json`;
    
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || 'academic-notebooks-storage',
      Key: logKey,
      Body: JSON.stringify(restoreLog, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
      StorageClass: 'STANDARD_IA',
      Metadata: {
        notebookId,
        operationType: 'restore',
        timestamp: new Date().toISOString()
      }
    });

    await s3Client.send(command);
    
    console.log(`Restore operation logged: ${logKey}`);
    return { logKey };
  } catch (error) {
    console.error('Error logging restore operation:', error);
    throw error;
  }
}

/**
 * Get backup history for a notebook
 */
async function getBackupHistory(notebookId) {
  try {
    const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    // List backup files
    const command = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET_NAME || 'academic-notebooks-storage',
      Prefix: `backups/${notebookId}/`,
      MaxKeys: 100
    });

    const result = await s3Client.send(command);
    
    if (!result.Contents || result.Contents.length === 0) {
      return [];
    }

    const backups = result.Contents.map(obj => ({
      key: obj.Key,
      lastModified: obj.LastModified,
      size: obj.Size,
      etag: obj.ETag,
      storageClass: obj.StorageClass
    })).sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    return backups;
  } catch (error) {
    console.error('Error getting backup history:', error);
    return [];
  }
}

/**
 * Restore notebook from backup
 */
async function restoreFromBackup(notebookId, backupKey) {
  try {
    // Get backup data from S3
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || 'academic-notebooks-storage',
      Key: backupKey
    });

    const result = await s3Client.send(command);
    const backupData = JSON.parse(await result.Body.transformToString());

    if (!backupData.notebook) {
      throw new Error('Invalid backup data structure');
    }

    // Restore notebook to DynamoDB
    const restoredNotebook = backupData.notebook;
    restoredNotebook.version = restoredNotebook.version + 1; // Increment version
    restoredNotebook.updated_at = new Date().toISOString();

    await DynamoDBService.updateNotebook(notebookId, {
      content: restoredNotebook.content,
      version: restoredNotebook.version,
      title: restoredNotebook.title,
      subject: restoredNotebook.subject,
      course: restoredNotebook.course,
      tags: restoredNotebook.tags
    });

    // Create new backup of the restored state
    await createBackupSnapshot(notebookId, {
      action: 'restore',
      restoredFromBackup: backupKey,
      contributor: 'system'
    });

    console.log(`Notebook ${notebookId} restored from backup ${backupKey}`);
    
    return {
      success: true,
      restoredNotebook,
      backupKey
    };
  } catch (error) {
    console.error('Error restoring from backup:', error);
    throw error;
  }
}

/**
 * Cleanup old backups based on retention policy
 */
async function cleanupOldBackups(notebookId, retentionDays = 90) {
  try {
    const backups = await getBackupHistory(notebookId);
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const backupsToDelete = backups.filter(backup => 
      new Date(backup.lastModified) < cutoffDate
    );

    if (backupsToDelete.length === 0) {
      console.log(`No old backups to cleanup for notebook ${notebookId}`);
      return { deletedCount: 0 };
    }

    const { S3Client, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    // Delete old backups in batches
    const batchSize = 1000; // S3 delete limit
    let deletedCount = 0;

    for (let i = 0; i < backupsToDelete.length; i += batchSize) {
      const batch = backupsToDelete.slice(i, i + batchSize);
      
      const command = new DeleteObjectsCommand({
        Bucket: process.env.S3_BUCKET_NAME || 'academic-notebooks-storage',
        Delete: {
          Objects: batch.map(backup => ({ Key: backup.key })),
          Quiet: true
        }
      });

      const result = await s3Client.send(command);
      deletedCount += batch.length - (result.Errors?.length || 0);
    }

    console.log(`Cleaned up ${deletedCount} old backups for notebook ${notebookId}`);
    
    return { deletedCount };
  } catch (error) {
    console.error('Error cleaning up old backups:', error);
    return { deletedCount: 0, error: error.message };
  }
}

module.exports = {
  triggerBackupLambda,
  performDirectBackup,
  createBackupSnapshot,
  archiveDeletedNotebook,
  logRestoreOperation,
  getBackupHistory,
  restoreFromBackup,
  cleanupOldBackups
};
