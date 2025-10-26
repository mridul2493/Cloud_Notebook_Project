const express = require('express');
const { S3Service } = require('../config/aws');
const { requireNotebookAccess } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/versions/:notebookId
 * Get all versions of a notebook
 */
router.get('/:notebookId', requireNotebookAccess('read'), async (req, res) => {
  try {
    const notebookId = req.params.notebookId;
    
    // Get all versions from S3
    const versions = await S3Service.listVersions(notebookId);
    
    const versionList = versions.map(version => ({
      versionId: version.VersionId,
      lastModified: version.LastModified,
      size: version.Size,
      isLatest: version.IsLatest,
      etag: version.ETag,
      storageClass: version.StorageClass,
      contributor: version.Metadata?.contributor || 'unknown',
      action: version.Metadata?.action || 'update'
    })).sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    res.json({
      notebookId,
      versions: versionList,
      totalVersions: versionList.length
    });
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch notebook versions',
        code: 'FETCH_VERSIONS_ERROR'
      }
    });
  }
});

/**
 * GET /api/versions/:notebookId/:versionId
 * Get a specific version of a notebook
 */
router.get('/:notebookId/:versionId', requireNotebookAccess('read'), async (req, res) => {
  try {
    const { notebookId, versionId } = req.params;
    
    // Get the specific version from S3
    const key = `notebooks/${notebookId}/${versionId}.json`;
    const versionData = await S3Service.getNotebook(key, versionId);
    
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
      versionId,
      data: versionData
    });
  } catch (error) {
    console.error('Error fetching version:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch notebook version',
        code: 'FETCH_VERSION_ERROR'
      }
    });
  }
});

/**
 * POST /api/versions/:notebookId/:versionId/restore
 * Restore a notebook to a specific version
 */
router.post('/:notebookId/:versionId/restore', requireNotebookAccess('write'), async (req, res) => {
  try {
    const { notebookId, versionId } = req.params;
    const userId = req.user.id;
    
    // Get the version to restore
    const key = `notebooks/${notebookId}/${versionId}.json`;
    const versionData = await S3Service.getNotebook(key, versionId);
    
    if (!versionData) {
      return res.status(404).json({
        error: {
          message: 'Version not found',
          code: 'VERSION_NOT_FOUND'
        }
      });
    }

    // Import DynamoDB service
    const { DynamoDBService } = require('../config/aws');
    
    // Get current notebook to increment version
    const currentNotebook = await DynamoDBService.getNotebook(notebookId);
    if (!currentNotebook) {
      return res.status(404).json({
        error: {
          message: 'Notebook not found',
          code: 'NOTEBOOK_NOT_FOUND'
        }
      });
    }

    const newVersion = currentNotebook.version + 1;

    // Update notebook with restored content
    await DynamoDBService.updateNotebook(notebookId, {
      content: versionData.content,
      version: newVersion
    });

    // Create new backup with restored content
    const backupResult = await S3Service.uploadNotebook(notebookId, versionData.content, {
      contributor: userId,
      action: 'restore',
      restoredFromVersion: versionId,
      version: newVersion
    });

    // Update search index
    const { SearchService } = require('../config/aws');
    const updatedNotebook = await DynamoDBService.getNotebook(notebookId);
    await SearchService.indexNotebook(updatedNotebook);

    res.json({
      message: 'Notebook restored successfully',
      restoredFromVersion: versionId,
      newVersion: newVersion,
      backup: {
        key: backupResult.key,
        versionId: backupResult.versionId
      }
    });
  } catch (error) {
    console.error('Error restoring version:', error);
    res.status(500).json({
      error: {
        message: 'Failed to restore notebook version',
        code: 'RESTORE_VERSION_ERROR'
      }
    });
  }
});

/**
 * GET /api/versions/:notebookId/compare/:versionId1/:versionId2
 * Compare two versions of a notebook
 */
router.get('/:notebookId/compare/:versionId1/:versionId2', requireNotebookAccess('read'), async (req, res) => {
  try {
    const { notebookId, versionId1, versionId2 } = req.params;
    
    // Get both versions
    const key1 = `notebooks/${notebookId}/${versionId1}.json`;
    const key2 = `notebooks/${notebookId}/${versionId2}.json`;
    
    const [version1Data, version2Data] = await Promise.all([
      S3Service.getNotebook(key1, versionId1),
      S3Service.getNotebook(key2, versionId2)
    ]);

    if (!version1Data || !version2Data) {
      return res.status(404).json({
        error: {
          message: 'One or both versions not found',
          code: 'VERSIONS_NOT_FOUND'
        }
      });
    }

    // Basic comparison (in production, you'd use a proper diff library)
    const comparison = {
      notebookId,
      version1: {
        versionId: versionId1,
        data: version1Data
      },
      version2: {
        versionId: versionId2,
        data: version2Data
      },
      differences: compareContent(version1Data.content, version2Data.content)
    };

    res.json(comparison);
  } catch (error) {
    console.error('Error comparing versions:', error);
    res.status(500).json({
      error: {
        message: 'Failed to compare notebook versions',
        code: 'COMPARE_VERSIONS_ERROR'
      }
    });
  }
});

/**
 * DELETE /api/versions/:notebookId/:versionId
 * Delete a specific version (admin only)
 */
router.delete('/:notebookId/:versionId', requireNotebookAccess('write'), async (req, res) => {
  try {
    const { notebookId, versionId } = req.params;
    const userRole = req.user.role;
    
    // Only admins can delete versions
    if (userRole !== 'admin') {
      return res.status(403).json({
        error: {
          message: 'Only administrators can delete versions',
          code: 'INSUFFICIENT_PERMISSIONS'
        }
      });
    }

    // In S3 with versioning, you can't actually delete versions
    // This would be handled by lifecycle policies
    res.json({
      message: 'Version deletion is handled by S3 lifecycle policies',
      note: 'Versions are automatically archived based on retention policies'
    });
  } catch (error) {
    console.error('Error deleting version:', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete notebook version',
        code: 'DELETE_VERSION_ERROR'
      }
    });
  }
});

/**
 * GET /api/versions/:notebookId/analytics
 * Get version analytics for a notebook
 */
router.get('/:notebookId/analytics', requireNotebookAccess('read'), async (req, res) => {
  try {
    const notebookId = req.params.notebookId;
    
    // Get all versions
    const versions = await S3Service.listVersions(notebookId);
    
    // Calculate analytics
    const analytics = {
      totalVersions: versions.length,
      totalSize: versions.reduce((sum, version) => sum + (version.Size || 0), 0),
      contributors: [...new Set(versions.map(v => v.Metadata?.contributor).filter(Boolean))],
      versionHistory: versions.map(version => ({
        versionId: version.VersionId,
        lastModified: version.LastModified,
        size: version.Size,
        contributor: version.Metadata?.contributor,
        action: version.Metadata?.action
      })).sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified)),
      activityByDay: getActivityByDay(versions),
      contributorStats: getContributorStats(versions)
    };

    res.json({
      notebookId,
      analytics
    });
  } catch (error) {
    console.error('Error fetching version analytics:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch version analytics',
        code: 'FETCH_ANALYTICS_ERROR'
      }
    });
  }
});

// Helper functions
function compareContent(content1, content2) {
  // Basic content comparison
  // In production, you'd use a proper diff library like 'diff' or 'jsdiff'
  const str1 = JSON.stringify(content1, null, 2);
  const str2 = JSON.stringify(content2, null, 2);
  
  return {
    identical: str1 === str2,
    size1: str1.length,
    size2: str2.length,
    sizeDifference: str2.length - str1.length,
    summary: str1 === str2 ? 'No changes' : 'Content has changed'
  };
}

function getActivityByDay(versions) {
  const activityMap = {};
  
  versions.forEach(version => {
    const date = new Date(version.LastModified).toDateString();
    activityMap[date] = (activityMap[date] || 0) + 1;
  });
  
  return Object.entries(activityMap).map(([date, count]) => ({
    date,
    versions: count
  })).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getContributorStats(versions) {
  const contributorMap = {};
  
  versions.forEach(version => {
    const contributor = version.Metadata?.contributor || 'unknown';
    if (!contributorMap[contributor]) {
      contributorMap[contributor] = {
        contributor,
        versions: 0,
        totalSize: 0,
        lastActivity: null
      };
    }
    
    contributorMap[contributor].versions++;
    contributorMap[contributor].totalSize += version.Size || 0;
    
    const activityDate = new Date(version.LastModified);
    if (!contributorMap[contributor].lastActivity || 
        activityDate > new Date(contributorMap[contributor].lastActivity)) {
      contributorMap[contributor].lastActivity = version.LastModified;
    }
  });
  
  return Object.values(contributorMap).sort((a, b) => b.versions - a.versions);
}

module.exports = router;
