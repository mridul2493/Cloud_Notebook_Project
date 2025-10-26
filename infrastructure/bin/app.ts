#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AcademicNotebookStack } from '../lib/academic-notebook-stack';

const app = new cdk.App();

// Get environment configuration
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';
const environment = process.env.ENVIRONMENT || 'prod';

if (!account) {
  throw new Error('AWS account ID must be specified via CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID environment variable');
}

// Create the main stack
new AcademicNotebookStack(app, `AcademicNotebook-${environment}`, {
  env: {
    account,
    region
  },
  description: `Academic Notebook Cloud Platform - ${environment} environment`,
  tags: {
    Project: 'AcademicNotebookCloud',
    Environment: environment,
    ManagedBy: 'AWS-CDK',
    CostCenter: 'Research',
    Owner: 'AcademicTeam'
  }
});

// Add stack-level metadata
app.node.setContext('@aws-cdk/core:enableStackNameDuplicates', true);
app.node.setContext('@aws-cdk/aws-s3:createDefaultLoggingPolicy', true);
app.node.setContext('@aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId', true);
app.node.setContext('@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021', true);
