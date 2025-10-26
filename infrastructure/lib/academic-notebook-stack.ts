import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export class AcademicNotebookStack extends cdk.Stack {
  public readonly s3Bucket: s3.Bucket;
  public readonly userPool: cognito.UserPool;
  public readonly api: apigateway.RestApi;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for notebook storage with versioning
    this.s3Bucket = new s3.Bucket(this, 'NotebookStorageBucket', {
      bucketName: `academic-notebooks-storage-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'ArchiveOldVersions',
          enabled: true,
          noncurrentVersionTransitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30)
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90)
            },
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(365)
            }
          ],
          noncurrentVersionExpiration: cdk.Duration.days(2555) // 7 years for academic retention
        }
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT, s3.HttpMethods.DELETE],
          allowedOrigins: ['*'], // In production, specify your domain
          allowedHeaders: ['*'],
          maxAge: 3000
        }
      ]
    });

    // DynamoDB Tables
    const notebooksTable = new dynamodb.Table(this, 'NotebooksTable', {
      tableName: 'AcademicNotebooks',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          indexName: 'OwnerIndex',
          partitionKey: { name: 'owner', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'updated_at', type: dynamodb.AttributeType.STRING }
        },
        {
          indexName: 'SubjectIndex',
          partitionKey: { name: 'subject', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'updated_at', type: dynamodb.AttributeType.STRING }
        }
      ]
    });

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'AcademicUsers',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          indexName: 'EmailIndex',
          partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING }
        }
      ]
    });

    const versionsTable = new dynamodb.Table(this, 'VersionsTable', {
      tableName: 'NotebookVersions',
      partitionKey: { name: 'notebook_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    const collaborationsTable = new dynamodb.Table(this, 'CollaborationsTable', {
      tableName: 'NotebookCollaborations',
      partitionKey: { name: 'notebook_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'event_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl', // Auto-delete old collaboration events
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // Cognito User Pool for Authentication
    this.userPool = new cognito.UserPool(this, 'AcademicUserPool', {
      userPoolName: 'academic-notebook-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
        preferredUsername: { required: false, mutable: true }
      },
      customAttributes: {
        role: new cognito.StringAttribute({ 
          minLen: 1, 
          maxLen: 20, 
          mutable: true 
        }),
        institution: new cognito.StringAttribute({ 
          minLen: 1, 
          maxLen: 200, 
          mutable: true 
        }),
        department: new cognito.StringAttribute({ 
          minLen: 1, 
          maxLen: 100, 
          mutable: true 
        })
      }
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'AcademicUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'academic-notebook-client',
      generateSecret: false,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE
        ],
        callbackUrls: [
          'http://localhost:3000/auth/callback',
          'https://your-domain.com/auth/callback' // Replace with your domain
        ]
      }
    });

    // OpenSearch Serverless Collection for AI-powered search
    const searchCollection = new opensearch.CfnCollection(this, 'NotebookSearchCollection', {
      name: 'academic-notebooks',
      type: 'SEARCH',
      description: 'Search collection for academic notebooks'
    });

    // Lambda Functions
    
    // Backup Lambda Function
    const backupLambda = new lambda.Function(this, 'BackupLambda', {
      functionName: 'academic-notebook-backup',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const s3 = new AWS.S3();
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        exports.handler = async (event) => {
          console.log('Backup Lambda triggered:', JSON.stringify(event, null, 2));
          
          const { notebookId, action, timestamp, metadata } = event;
          
          try {
            switch (action) {
              case 'create':
              case 'update':
                await performBackup(notebookId, metadata);
                break;
              case 'delete':
                await archiveNotebook(notebookId, metadata);
                break;
              case 'restore':
                await logRestore(notebookId, metadata);
                break;
              default:
                console.log('Unknown action:', action);
            }
            
            return {
              statusCode: 200,
              body: JSON.stringify({ message: 'Backup operation completed', notebookId, action })
            };
          } catch (error) {
            console.error('Backup operation failed:', error);
            throw error;
          }
        };
        
        async function performBackup(notebookId, metadata) {
          // Implementation would go here
          console.log('Performing backup for notebook:', notebookId);
        }
        
        async function archiveNotebook(notebookId, metadata) {
          // Implementation would go here
          console.log('Archiving notebook:', notebookId);
        }
        
        async function logRestore(notebookId, metadata) {
          // Implementation would go here
          console.log('Logging restore for notebook:', notebookId);
        }
      `),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        S3_BUCKET_NAME: this.s3Bucket.bucketName,
        NOTEBOOKS_TABLE: notebooksTable.tableName,
        VERSIONS_TABLE: versionsTable.tableName
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // Search Indexing Lambda
    const searchIndexLambda = new lambda.Function(this, 'SearchIndexLambda', {
      functionName: 'academic-notebook-search-index',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Search index Lambda triggered:', JSON.stringify(event, null, 2));
          
          // Process DynamoDB stream events to update search index
          for (const record of event.Records) {
            const { eventName, dynamodb } = record;
            
            switch (eventName) {
              case 'INSERT':
              case 'MODIFY':
                await indexNotebook(dynamodb.NewImage);
                break;
              case 'REMOVE':
                await removeFromIndex(dynamodb.OldImage.id.S);
                break;
            }
          }
          
          return { statusCode: 200, body: 'Search index updated' };
        };
        
        async function indexNotebook(item) {
          // Implementation would integrate with OpenSearch
          console.log('Indexing notebook:', item.id.S);
        }
        
        async function removeFromIndex(notebookId) {
          // Implementation would remove from OpenSearch
          console.log('Removing from index:', notebookId);
        }
      `),
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      environment: {
        OPENSEARCH_ENDPOINT: searchCollection.attrCollectionEndpoint
      },
      logRetention: logs.RetentionDays.ONE_WEEK
    });

    // Grant permissions
    this.s3Bucket.grantReadWrite(backupLambda);
    notebooksTable.grantReadWriteData(backupLambda);
    versionsTable.grantReadWriteData(backupLambda);
    
    notebooksTable.grantStreamRead(searchIndexLambda);
    
    // DynamoDB Stream for search indexing
    notebooksTable.addGlobalSecondaryIndex({
      indexName: 'StreamIndex',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING }
    });

    // API Gateway
    this.api = new apigateway.RestApi(this, 'AcademicNotebookApi', {
      restApiName: 'academic-notebook-api',
      description: 'API for Academic Notebook Cloud Platform',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token']
      },
      deployOptions: {
        stageName: 'prod',
        throttle: {
          rateLimit: 1000,
          burstLimit: 2000
        },
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true
      }
    });

    // CloudFront Distribution for global CDN
    this.distribution = new cloudfront.Distribution(this, 'AcademicNotebookDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.s3Bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.RestApiOrigin(this.api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER
        }
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      enableIpv6: true,
      comment: 'Academic Notebook Cloud Platform CDN'
    });

    // EventBridge Rules for automated tasks
    const backupRule = new events.Rule(this, 'BackupRule', {
      description: 'Trigger backup operations',
      eventPattern: {
        source: ['academic.notebook'],
        detailType: ['Notebook Updated', 'Notebook Created']
      }
    });
    
    backupRule.addTarget(new targets.LambdaFunction(backupLambda));

    // IAM Roles and Policies
    const apiExecutionRole = new iam.Role(this, 'ApiExecutionRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs')
      ]
    });

    // Output important values
    new cdk.CfnOutput(this, 'S3BucketName', {
      value: this.s3Bucket.bucketName,
      description: 'S3 bucket for notebook storage'
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID'
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID'
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API Gateway endpoint'
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain'
    });

    new cdk.CfnOutput(this, 'OpenSearchEndpoint', {
      value: searchCollection.attrCollectionEndpoint,
      description: 'OpenSearch collection endpoint'
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'AcademicNotebookCloud');
    cdk.Tags.of(this).add('Environment', 'Production');
    cdk.Tags.of(this).add('Owner', 'AcademicTeam');
  }
}
