#!/bin/bash

# Academic Notebook Cloud Platform - Setup Script
# This script helps set up the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Node.js version
check_node_version() {
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            print_success "Node.js version $(node --version) is compatible"
        else
            print_error "Node.js version 18+ is required. Current version: $(node --version)"
            exit 1
        fi
    else
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    check_node_version
    
    # Check npm
    if command_exists npm; then
        print_success "npm is available"
    else
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check Docker
    if command_exists docker; then
        print_success "Docker is available"
    else
        print_warning "Docker is not installed. Some features may not work."
    fi
    
    # Check AWS CLI
    if command_exists aws; then
        print_success "AWS CLI is available"
    else
        print_warning "AWS CLI is not installed. Cloud deployment features will not work."
    fi
    
    # Check kubectl
    if command_exists kubectl; then
        print_success "kubectl is available"
    else
        print_warning "kubectl is not installed. Kubernetes deployment features will not work."
    fi
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing project dependencies..."
    
    # Root dependencies
    print_status "Installing root dependencies..."
    npm install
    
    # Backend dependencies
    print_status "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    
    # Frontend dependencies
    print_status "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    
    # Infrastructure dependencies
    print_status "Installing infrastructure dependencies..."
    cd infrastructure
    npm install
    cd ..
    
    print_success "All dependencies installed successfully!"
}

# Function to setup environment files
setup_environment() {
    print_status "Setting up environment files..."
    
    # Root environment file
    if [ ! -f ".env" ]; then
        if [ -f "env.example" ]; then
            cp env.example .env
            print_success "Created .env from env.example"
        else
            print_warning ".env.example not found, creating basic .env file"
            cat > .env << EOF
NODE_ENV=development
AWS_REGION=us-east-1
JWT_SECRET=development-jwt-secret-change-in-production
EOF
        fi
    else
        print_warning ".env already exists, skipping creation"
    fi
    
    # Backend environment file
    if [ ! -f "backend/.env" ]; then
        cat > backend/.env << EOF
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET=development-jwt-secret-change-in-production
AWS_REGION=us-east-1
EOF
        print_success "Created backend/.env"
    else
        print_warning "backend/.env already exists, skipping creation"
    fi
    
    # Frontend environment file
    if [ ! -f "frontend/.env.local" ]; then
        cat > frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_WS_URL=ws://localhost:5000
NEXT_PUBLIC_AWS_REGION=us-east-1
EOF
        print_success "Created frontend/.env.local"
    else
        print_warning "frontend/.env.local already exists, skipping creation"
    fi
}

# Function to create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    directories=(
        "backend/logs"
        "frontend/.next"
        "docs/generated"
        "scripts/logs"
        "monitoring/data"
    )
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_success "Created directory: $dir"
        fi
    done
}

# Function to setup Git hooks
setup_git_hooks() {
    print_status "Setting up Git hooks..."
    
    if [ -d ".git" ]; then
        # Pre-commit hook
        cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Run linting before commit
npm run lint
if [ $? -ne 0 ]; then
    echo "Linting failed. Please fix the issues before committing."
    exit 1
fi
EOF
        chmod +x .git/hooks/pre-commit
        print_success "Git pre-commit hook installed"
    else
        print_warning "Not a Git repository, skipping Git hooks setup"
    fi
}

# Function to verify setup
verify_setup() {
    print_status "Verifying setup..."
    
    # Check if we can build the project
    print_status "Testing backend build..."
    cd backend
    npm run build 2>/dev/null || print_warning "Backend build test failed"
    cd ..
    
    print_status "Testing frontend build..."
    cd frontend
    npm run build 2>/dev/null || print_warning "Frontend build test failed"
    cd ..
    
    print_success "Setup verification completed!"
}

# Function to display next steps
show_next_steps() {
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "📝 Next Steps:"
    echo "1. Configure your AWS credentials:"
    echo "   aws configure"
    echo ""
    echo "2. Update environment variables in .env files with your actual values"
    echo ""
    echo "3. Start the development environment:"
    echo "   npm run dev"
    echo ""
    echo "4. Or use Docker Compose:"
    echo "   docker-compose up -d"
    echo ""
    echo "5. Access the application:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend:  http://localhost:5000"
    echo ""
    echo "📚 Documentation:"
    echo "   - README: ./README.md"
    echo "   - Deployment Guide: ./docs/deployment-guide.md"
    echo "   - Research Analysis: ./docs/research-gap-analysis.md"
    echo ""
    echo "🔧 Useful Commands:"
    echo "   npm run dev          - Start development servers"
    echo "   npm run build        - Build for production"
    echo "   npm run test         - Run tests"
    echo "   npm run lint         - Run linting"
    echo "   docker-compose up -d - Start with Docker"
    echo ""
}

# Main execution
main() {
    echo "🚀 Academic Notebook Cloud Platform Setup"
    echo "=========================================="
    echo ""
    
    check_prerequisites
    install_dependencies
    setup_environment
    create_directories
    setup_git_hooks
    verify_setup
    show_next_steps
}

# Run main function
main "$@"
