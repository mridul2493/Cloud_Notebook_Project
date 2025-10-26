const { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  RestoreObjectCommand
} = require('@aws-sdk/client-s3');
const { 
  DynamoDBClient, 
  PutItemCommand, 
  GetItemCommand, 
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
  ScanCommand
} = require('@aws-sdk/client-dynamodb');
const { 
  LambdaClient, 
  InvokeCommand 
} = require('@aws-sdk/client-lambda');
const { 
  OpenSearchClient,
  SearchCommand,
  IndexCommand
} = require('@aws-sdk/client-opensearch');

// AWS Configuration
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
};

// Initialize AWS clients
const s3Client = new S3Client(awsConfig);
const dynamoClient = new DynamoDBClient(awsConfig);
const lambdaClient = new LambdaClient(awsConfig);
const openSearchClient = new OpenSearchClient(awsConfig);

// S3 Configuration
const S3_CONFIG = {
  BUCKET_NAME: process.env.S3_BUCKET_NAME || 'academic-notebooks-storage',
  VERSIONING_ENABLED: true,
  ENCRYPTION: 'AES256'
};

// DynamoDB Configuration
const DYNAMODB_CONFIG = {
  NOTEBOOKS_TABLE: process.env.DYNAMODB_NOTEBOOKS_TABLE || 'AcademicNotebooks',
  USERS_TABLE: process.env.DYNAMODB_USERS_TABLE || 'AcademicUsers',
  VERSIONS_TABLE: process.env.DYNAMODB_VERSIONS_TABLE || 'NotebookVersions',
  COLLABORATIONS_TABLE: process.env.DYNAMODB_COLLABORATIONS_TABLE || 'NotebookCollaborations'
};

// OpenSearch Configuration
const OPENSEARCH_CONFIG = {
  DOMAIN_ENDPOINT: process.env.OPENSEARCH_DOMAIN_ENDPOINT,
  INDEX_NAME: 'academic-notebooks'
};

// S3 Operations
class S3Service {
  static async uploadNotebook(notebookId, content, metadata) {
    const key = `notebooks/${notebookId}/${Date.now()}.json`;
    
    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key,
      Body: JSON.stringify({ content, metadata }),
      ContentType: 'application/json',
      ServerSideEncryption: S3_CONFIG.ENCRYPTION,
      Metadata: {
        notebookId,
        timestamp: new Date().toISOString(),
        contributor: metadata.contributor || 'system'
      }
    });

    const result = await s3Client.send(command);
    return { key, versionId: result.VersionId };
  }

  static async getNotebook(key, versionId = null) {
    const command = new GetObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key,
      VersionId: versionId
    });

    const result = await s3Client.send(command);
    const content = await result.Body.transformToString();
    return JSON.parse(content);
  }

  static async listVersions(notebookId) {
    const command = new ListObjectVersionsCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Prefix: `notebooks/${notebookId}/`
    });

    const result = await s3Client.send(command);
    return result.Versions || [];
  }

  static async restoreVersion(key, versionId) {
    const command = new RestoreObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key,
      VersionId: versionId
    });

    return await s3Client.send(command);
  }
}

// DynamoDB Operations
class DynamoDBService {
  static async createNotebook(notebook) {
    const command = new PutItemCommand({
      TableName: DYNAMODB_CONFIG.NOTEBOOKS_TABLE,
      Item: {
        id: { S: notebook.id },
        title: { S: notebook.title },
        content: { S: JSON.stringify(notebook.content) },
        owner: { S: notebook.owner },
        ...(Array.isArray(notebook.collaborators)
          ? { collaborators: { L: notebook.collaborators.map(c => ({ S: c })) } }
          : {}),
        created_at: { S: new Date().toISOString() },
        updated_at: { S: new Date().toISOString() },
        version: { N: '1' },
        status: { S: 'active' }
      }
    });

    await dynamoClient.send(command);
    return notebook;
  }

  static async getNotebook(id) {
    const command = new GetItemCommand({
      TableName: DYNAMODB_CONFIG.NOTEBOOKS_TABLE,
      Key: { id: { S: id } }
    });

    const result = await dynamoClient.send(command);
    if (!result.Item) return null;

    return {
      id: result.Item.id.S,
      title: result.Item.title.S,
      content: JSON.parse(result.Item.content.S),
      owner: result.Item.owner.S,
      collaborators: result.Item.collaborators?.L?.map(v => v.S) || [],
      created_at: result.Item.created_at.S,
      updated_at: result.Item.updated_at.S,
      version: parseInt(result.Item.version.N),
      status: result.Item.status.S
    };
  }

  static async updateNotebook(id, updates) {
    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.keys(updates).forEach(key => {
      if (key === 'content') {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = { S: JSON.stringify(updates[key]) };
        expressionAttributeNames[`#${key}`] = key;
      } else if (key === 'collaborators') {
        updateExpression.push(`#${key} = :${key}`);
        const listValue = Array.isArray(updates[key]) ? updates[key].map(c => ({ S: c })) : [];
        expressionAttributeValues[`:${key}`] = { L: listValue };
        expressionAttributeNames[`#${key}`] = key;
      } else if (key === 'version') {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = { N: updates[key].toString() };
        expressionAttributeNames[`#${key}`] = key;
      } else {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = { S: updates[key] };
        expressionAttributeNames[`#${key}`] = key;
      }
    });

    // Always update the timestamp
    updateExpression.push('updated_at = :updated_at');
    expressionAttributeValues[':updated_at'] = { S: new Date().toISOString() };

    const command = new UpdateItemCommand({
      TableName: DYNAMODB_CONFIG.NOTEBOOKS_TABLE,
      Key: { id: { S: id } },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW'
    });

    const result = await dynamoClient.send(command);
    return result.Attributes;
  }

  static async createNotebookVersion(notebookId, versionData) {
    const command = new PutItemCommand({
      TableName: DYNAMODB_CONFIG.VERSIONS_TABLE,
      Item: {
        id: { S: `${notebookId}-v${versionData.version}` },
        notebookId: { S: notebookId },
        version: { N: versionData.version.toString() },
        content: { S: JSON.stringify(versionData.content) },
        title: { S: versionData.title },
        contributor: { S: versionData.contributor },
        contributorName: { S: versionData.contributorName || versionData.contributor },
        action: { S: versionData.action },
        created_at: { S: new Date().toISOString() },
        metadata: { S: JSON.stringify(versionData.metadata || {}) }
      }
    });

    const result = await dynamoClient.send(command);
    return versionData;
  }

  static async getNotebookVersions(notebookId) {
    const command = new ScanCommand({
      TableName: DYNAMODB_CONFIG.VERSIONS_TABLE,
      FilterExpression: 'notebookId = :notebookId',
      ExpressionAttributeValues: {
        ':notebookId': { S: notebookId }
      }
    });

    const result = await dynamoClient.send(command);
    
    const versions = result.Items?.map(item => ({
      id: item.id.S,
      notebookId: item.notebookId.S,
      version: parseInt(item.version.N),
      content: JSON.parse(item.content.S),
      title: item.title.S,
      contributor: item.contributor.S,
      contributorName: item.contributorName?.S || item.contributor.S,
      action: item.action.S,
      created_at: item.created_at.S,
      metadata: JSON.parse(item.metadata.S)
    })).sort((a, b) => b.version - a.version) || [];
    
    return versions;
  }

  static async getNotebookVersion(notebookId, version) {
    const command = new GetItemCommand({
      TableName: DYNAMODB_CONFIG.VERSIONS_TABLE,
      Key: { id: { S: `${notebookId}-v${version}` } }
    });

    const result = await dynamoClient.send(command);
    if (!result.Item) return null;

    return {
      id: result.Item.id.S,
      notebookId: result.Item.notebookId.S,
      version: parseInt(result.Item.version.N),
      content: JSON.parse(result.Item.content.S),
      title: result.Item.title.S,
      contributor: result.Item.contributor.S,
      contributorName: result.Item.contributorName?.S || result.Item.contributor.S,
      action: result.Item.action.S,
      created_at: result.Item.created_at.S,
      metadata: JSON.parse(result.Item.metadata.S)
    };
  }

  static async deleteNotebook(id) {
    const command = new DeleteItemCommand({
      TableName: DYNAMODB_CONFIG.NOTEBOOKS_TABLE,
      Key: { id: { S: id } }
    });

    await dynamoClient.send(command);
    return { id };
  }

  static async getUserById(id) {
    const command = new GetItemCommand({
      TableName: DYNAMODB_CONFIG.USERS_TABLE,
      Key: { id: { S: id } }
    });

    const result = await dynamoClient.send(command);
    
    if (!result.Item) {
      return null;
    }

    return {
      id: result.Item.id.S,
      name: result.Item.name?.S || '',
      email: result.Item.email.S,
      created_at: result.Item.created_at.S
    };
  }

  static async getUserNotebooks(userId) {
    const command = new ScanCommand({
      TableName: DYNAMODB_CONFIG.NOTEBOOKS_TABLE,
      FilterExpression: '#owner = :userId OR contains(#collaborators, :userId)',
      ExpressionAttributeNames: {
        '#owner': 'owner',
        '#collaborators': 'collaborators'
      },
      ExpressionAttributeValues: {
        ':userId': { S: userId }
      }
    });

    const result = await dynamoClient.send(command);
    return result.Items?.map(item => ({
      id: item.id.S,
      title: item.title.S,
      content: item.content ? JSON.parse(item.content.S) : {},
      owner: item.owner.S,
      collaborators: item.collaborators?.L?.map(v => v.S) || [],
      created_at: item.created_at.S,
      updated_at: item.updated_at.S,
      version: parseInt(item.version.N),
      status: item.status.S,
      subject: item.subject?.S || '',
      course: item.course?.S || '',
      tags: item.tags?.L?.map(v => v.S) || []
    })) || [];
  }
}

// OpenSearch Operations
class SearchService {
  static async indexNotebook(notebook) {
    const document = {
      id: notebook.id,
      title: notebook.title,
      content: typeof notebook.content === 'string' ? notebook.content : JSON.stringify(notebook.content),
      owner: notebook.owner,
      collaborators: notebook.collaborators,
      created_at: notebook.created_at,
      updated_at: notebook.updated_at,
      tags: notebook.tags || [],
      subject: notebook.subject || '',
      course: notebook.course || ''
    };

    console.log('Indexing notebook:', document.id);
    return document;
  }

  static async searchNotebooks(query, userId, filters = {}) {
    try {
      const { DynamoDBService } = require('./aws');
      
      // Get all notebooks the user has access to
      const userNotebooks = await DynamoDBService.getUserNotebooks(userId);
      
      const results = [];
      const queryLower = query.toLowerCase();
      
      for (const notebook of userNotebooks) {
        let score = 0;
        const highlights = [];
        const matchedFields = [];
        
        // Search in title (highest weight)
        if (notebook.title && notebook.title.toLowerCase().includes(queryLower)) {
          score += 10;
          highlights.push(notebook.title);
          matchedFields.push('title');
        }
        
        // Search in content
        if (notebook.content) {
          let contentStr = '';
          
          // Handle different content formats
          if (typeof notebook.content === 'string') {
            contentStr = notebook.content;
          } else if (typeof notebook.content === 'object') {
            // Extract body text from content object
            if (notebook.content.body) {
              contentStr = notebook.content.body;
            } else {
              // Fallback to JSON string if no body field
              contentStr = JSON.stringify(notebook.content);
            }
          }
          
          // Debug logging
          if (process.env.NODE_ENV === 'development') {
            console.log(`Searching notebook ${notebook.id}:`, {
              hasContent: !!notebook.content,
              contentType: typeof notebook.content,
              hasBody: !!(notebook.content && notebook.content.body),
              bodyLength: contentStr.length,
              query: queryLower
            });
          }
          
          if (contentStr && contentStr.toLowerCase().includes(queryLower)) {
            score += 5;
            // Extract relevant snippet
            const snippet = this.extractSnippet(contentStr, queryLower);
            if (snippet) highlights.push(snippet);
            matchedFields.push('content');
          }
        }
        
        // Search in subject
        if (notebook.subject && notebook.subject.toLowerCase().includes(queryLower)) {
          score += 3;
          highlights.push(notebook.subject);
          matchedFields.push('subject');
        }
        
        // Search in course
        if (notebook.course && notebook.course.toLowerCase().includes(queryLower)) {
          score += 3;
          highlights.push(notebook.course);
          matchedFields.push('course');
        }
        
        // Search in tags
        if (notebook.tags && Array.isArray(notebook.tags)) {
          const matchingTags = notebook.tags.filter(tag => 
            tag.toLowerCase().includes(queryLower)
          );
          if (matchingTags.length > 0) {
            score += 2;
            highlights.push(...matchingTags);
            matchedFields.push('tags');
          }
        }
        
        // Search in attachments (if content has attachments)
        if (notebook.content && typeof notebook.content === 'object' && notebook.content.attachments) {
          const attachmentMatches = notebook.content.attachments.filter(att => 
            att.name && att.name.toLowerCase().includes(queryLower)
          );
          if (attachmentMatches.length > 0) {
            score += 1;
            highlights.push(...attachmentMatches.map(att => att.name));
            matchedFields.push('attachments');
          }
        }
        
        if (score > 0) {
          results.push({
            notebookId: notebook.id,
            score: score / 10, // Normalize to 0-1
            highlights: [...new Set(highlights)].slice(0, 3), // Remove duplicates, limit to 3
            matchedFields: [...new Set(matchedFields)],
            notebook: notebook
          });
        }
      }
      
      // Sort by relevance score
      results.sort((a, b) => b.score - a.score);
      
      return results;
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }
  
  static extractSnippet(text, query, maxLength = 150) {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    const index = textLower.indexOf(queryLower);
    
    if (index === -1) return null;
    
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + query.length + 50);
    let snippet = text.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    return snippet;
  }
}

module.exports = {
  s3Client,
  dynamoClient,
  lambdaClient,
  openSearchClient,
  S3Service,
  DynamoDBService,
  SearchService,
  S3_CONFIG,
  DYNAMODB_CONFIG,
  OPENSEARCH_CONFIG
};
