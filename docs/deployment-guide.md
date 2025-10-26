# Academic Notebook Cloud Platform - Deployment Guide

## 🚀 Quick Start

This guide will help you deploy the Academic Notebook Cloud Platform in various environments, from local development to production-ready cloud infrastructure.

## 📋 Prerequisites

### Required Tools
- **Node.js 18+** with npm
- **Docker** and Docker Compose
- **AWS CLI** configured with appropriate permissions
- **kubectl** for Kubernetes deployments
- **AWS CDK** for infrastructure deployment
- **Git** for version control

### AWS Permissions Required
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:*",
        "dynamodb:*",
        "lambda:*",
        "cognito-idp:*",
        "es:*",
        "cloudfront:*",
        "apigateway:*",
        "iam:*",
        "eks:*",
        "ec2:*",
        "logs:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## 🏠 Local Development Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-org/academic-notebook-cloud.git
cd academic-notebook-cloud

# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install infrastructure dependencies
cd infrastructure && npm install && cd ..
```

### 2. Environment Configuration

Create environment files:

```bash
# Root .env file
cp .env.example .env

# Backend .env file
cp backend/.env.example backend/.env

# Frontend .env file
cp frontend/.env.example frontend/.env
```

### 3. Configure Environment Variables

**Root `.env` file:**
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# Application Configuration
NODE_ENV=development
JWT_SECRET=your-jwt-secret-key
REDIS_PASSWORD=your-redis-password

# Database Configuration
S3_BUCKET_NAME=academic-notebooks-dev
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-cognito-client-id
```

**Backend `.env` file:**
```bash
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# AWS Services
S3_BUCKET_NAME=academic-notebooks-dev
DYNAMODB_NOTEBOOKS_TABLE=AcademicNotebooks-dev
DYNAMODB_USERS_TABLE=AcademicUsers-dev
DYNAMODB_VERSIONS_TABLE=NotebookVersions-dev
DYNAMODB_COLLABORATIONS_TABLE=NotebookCollaborations-dev

# Authentication
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h

# OpenSearch
OPENSEARCH_DOMAIN_ENDPOINT=https://search-academic-notebooks-dev.us-east-1.es.amazonaws.com

# Lambda Functions
BACKUP_LAMBDA_FUNCTION_NAME=academic-notebook-backup-dev
```

**Frontend `.env` file:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_WS_URL=ws://localhost:5000
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-cognito-client-id
```

### 4. Start Development Environment

**Option 1: Using npm scripts**
```bash
# Start all services
npm run dev

# Or start individually
npm run dev:backend    # Backend on port 5000
npm run dev:frontend   # Frontend on port 3000
```

**Option 2: Using Docker Compose**
```bash
# Start all services with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 5. Verify Local Setup

```bash
# Check backend health
curl http://localhost:5000/health

# Check frontend
curl http://localhost:3000

# Check Redis
redis-cli -h localhost -p 6379 ping
```

## ☁️ AWS Infrastructure Deployment

### 1. Bootstrap AWS CDK

```bash
cd infrastructure

# Bootstrap CDK (one-time setup per AWS account/region)
cdk bootstrap aws://ACCOUNT-NUMBER/REGION

# Example
cdk bootstrap aws://123456789012/us-east-1
```

### 2. Deploy Infrastructure

```bash
# Review changes
cdk diff

# Deploy all stacks
cdk deploy --all

# Or deploy specific stack
cdk deploy AcademicNotebook-prod
```

### 3. Verify Infrastructure Deployment

```bash
# List deployed stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE

# Get stack outputs
aws cloudformation describe-stacks --stack-name AcademicNotebook-prod --query 'Stacks[0].Outputs'
```

### 4. Configure Post-Deployment

After infrastructure deployment, update your environment variables with the actual resource ARNs and endpoints:

```bash
# Get S3 bucket name
aws cloudformation describe-stacks --stack-name AcademicNotebook-prod --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text

# Get Cognito User Pool ID
aws cloudformation describe-stacks --stack-name AcademicNotebook-prod --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text

# Get API Gateway URL
aws cloudformation describe-stacks --stack-name AcademicNotebook-prod --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text
```

## 🐳 Docker Deployment

### 1. Build Docker Images

```bash
# Build backend image
docker build -t academic-notebook-backend:latest ./backend

# Build frontend image
docker build -t academic-notebook-frontend:latest ./frontend

# Tag for registry (replace with your registry)
docker tag academic-notebook-backend:latest your-registry/academic-notebook-backend:latest
docker tag academic-notebook-frontend:latest your-registry/academic-notebook-frontend:latest
```

### 2. Push to Container Registry

**AWS ECR:**
```bash
# Create repositories
aws ecr create-repository --repository-name academic-notebook-backend
aws ecr create-repository --repository-name academic-notebook-frontend

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com

# Push images
docker push ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/academic-notebook-backend:latest
docker push ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/academic-notebook-frontend:latest
```

**Docker Hub:**
```bash
# Login to Docker Hub
docker login

# Push images
docker push your-username/academic-notebook-backend:latest
docker push your-username/academic-notebook-frontend:latest
```

### 3. Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  backend:
    image: your-registry/academic-notebook-backend:latest
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - AWS_REGION=${AWS_REGION}
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
      # ... other production environment variables
    restart: unless-stopped
    
  frontend:
    image: your-registry/academic-notebook-frontend:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=${API_URL}
      # ... other production environment variables
    restart: unless-stopped
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
```

## ☸️ Kubernetes Deployment

### 1. Set Up EKS Cluster

```bash
# Create EKS cluster (using eksctl)
eksctl create cluster \
  --name academic-notebook-cluster \
  --version 1.27 \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 10 \
  --managed

# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name academic-notebook-cluster
```

### 2. Install Required Add-ons

```bash
# AWS Load Balancer Controller
kubectl apply -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller/crds?ref=master"

helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=academic-notebook-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller

# Metrics Server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Cluster Autoscaler
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml
```

### 3. Configure Kubernetes Secrets

```bash
# Create namespace
kubectl apply -f kubernetes/namespace.yaml

# Create AWS credentials secret
kubectl create secret generic aws-credentials \
  --namespace=academic-notebook \
  --from-literal=access-key-id=$AWS_ACCESS_KEY_ID \
  --from-literal=secret-access-key=$AWS_SECRET_ACCESS_KEY

# Create application secrets
kubectl create secret generic academic-notebook-secrets \
  --namespace=academic-notebook \
  --from-literal=jwt-secret=$JWT_SECRET \
  --from-literal=db-encryption-key=$DB_ENCRYPTION_KEY
```

### 4. Update Kubernetes Manifests

Update the image URLs in deployment files:

```bash
# Update backend deployment
sed -i 's|academic-notebook-backend:latest|your-registry/academic-notebook-backend:latest|g' kubernetes/backend-deployment.yaml

# Update frontend deployment
sed -i 's|academic-notebook-frontend:latest|your-registry/academic-notebook-frontend:latest|g' kubernetes/frontend-deployment.yaml
```

### 5. Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f kubernetes/

# Check deployment status
kubectl get pods -n academic-notebook
kubectl get services -n academic-notebook
kubectl get ingress -n academic-notebook

# View logs
kubectl logs -f deployment/academic-notebook-backend -n academic-notebook
kubectl logs -f deployment/academic-notebook-frontend -n academic-notebook
```

### 6. Configure Domain and SSL

```bash
# Get load balancer URL
kubectl get ingress academic-notebook-ingress -n academic-notebook -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Update DNS record to point to the load balancer
# Configure SSL certificate in AWS Certificate Manager
# Update ingress.yaml with your certificate ARN
```

## 🔧 Configuration Management

### Environment-Specific Configurations

**Development:**
```yaml
# kubernetes/overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: academic-notebook-dev

resources:
  - ../../base

patchesStrategicMerge:
  - deployment-patch.yaml
  - service-patch.yaml

configMapGenerator:
  - name: academic-notebook-config
    literals:
      - node-env=development
      - log-level=debug
```

**Production:**
```yaml
# kubernetes/overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: academic-notebook

resources:
  - ../../base

patchesStrategicMerge:
  - deployment-patch.yaml
  - hpa-patch.yaml

configMapGenerator:
  - name: academic-notebook-config
    literals:
      - node-env=production
      - log-level=info
```

### Apply Environment-Specific Configs

```bash
# Deploy to development
kubectl apply -k kubernetes/overlays/dev

# Deploy to production
kubectl apply -k kubernetes/overlays/prod
```

## 📊 Monitoring Setup

### 1. Deploy Prometheus and Grafana

```bash
# Add Helm repositories
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values monitoring/prometheus-values.yaml

# Install Grafana
helm install grafana grafana/grafana \
  --namespace monitoring \
  --values monitoring/grafana-values.yaml
```

### 2. Configure Dashboards

```bash
# Import custom dashboards
kubectl apply -f monitoring/dashboards/
```

### 3. Set Up Alerts

```bash
# Configure alert rules
kubectl apply -f monitoring/alerts/
```

## 🔒 Security Configuration

### 1. Network Policies

```bash
# Apply network policies
kubectl apply -f security/network-policies.yaml
```

### 2. Pod Security Standards

```bash
# Apply pod security policies
kubectl apply -f security/pod-security-standards.yaml
```

### 3. RBAC Configuration

```bash
# Create service accounts and roles
kubectl apply -f security/rbac.yaml
```

## 🔍 Troubleshooting

### Common Issues

**1. Pod Startup Issues:**
```bash
# Check pod status
kubectl get pods -n academic-notebook

# View pod logs
kubectl logs <pod-name> -n academic-notebook

# Describe pod for events
kubectl describe pod <pod-name> -n academic-notebook
```

**2. Service Connectivity Issues:**
```bash
# Test service connectivity
kubectl exec -it <pod-name> -n academic-notebook -- curl http://service-name

# Check service endpoints
kubectl get endpoints -n academic-notebook
```

**3. Ingress Issues:**
```bash
# Check ingress status
kubectl describe ingress academic-notebook-ingress -n academic-notebook

# View ingress controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller
```

### Health Checks

```bash
# Backend health check
curl https://your-domain.com/api/health

# Frontend health check
curl https://your-domain.com/

# Database connectivity
kubectl exec -it <backend-pod> -n academic-notebook -- node -e "
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB();
dynamodb.listTables().promise().then(console.log);
"
```

## 📈 Scaling

### Manual Scaling

```bash
# Scale backend deployment
kubectl scale deployment academic-notebook-backend --replicas=5 -n academic-notebook

# Scale frontend deployment
kubectl scale deployment academic-notebook-frontend --replicas=3 -n academic-notebook
```

### Auto-scaling Configuration

The HPA (Horizontal Pod Autoscaler) is already configured in the manifests. Monitor scaling:

```bash
# Check HPA status
kubectl get hpa -n academic-notebook

# View HPA details
kubectl describe hpa academic-notebook-backend-hpa -n academic-notebook
```

## 🔄 Updates and Rollbacks

### Rolling Updates

```bash
# Update backend image
kubectl set image deployment/academic-notebook-backend backend=your-registry/academic-notebook-backend:v2.0.0 -n academic-notebook

# Check rollout status
kubectl rollout status deployment/academic-notebook-backend -n academic-notebook
```

### Rollbacks

```bash
# View rollout history
kubectl rollout history deployment/academic-notebook-backend -n academic-notebook

# Rollback to previous version
kubectl rollout undo deployment/academic-notebook-backend -n academic-notebook

# Rollback to specific revision
kubectl rollout undo deployment/academic-notebook-backend --to-revision=2 -n academic-notebook
```

## 🧹 Cleanup

### Remove Kubernetes Resources

```bash
# Delete all resources in namespace
kubectl delete namespace academic-notebook

# Delete cluster (if using eksctl)
eksctl delete cluster --name academic-notebook-cluster
```

### Remove AWS Infrastructure

```bash
cd infrastructure

# Destroy CDK stacks
cdk destroy --all

# Confirm deletion
aws cloudformation list-stacks --stack-status-filter DELETE_COMPLETE
```

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [EKS User Guide](https://docs.aws.amazon.com/eks/)
- [Project GitHub Repository](https://github.com/your-org/academic-notebook-cloud)

---

For additional help, please check the [troubleshooting guide](./troubleshooting.md) or open an issue in the project repository.
