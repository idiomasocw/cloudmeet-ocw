# Git Strategy for LiveKit Video Conference Project

## Current Repository Structure

This project consists of three separate Git repositories plus root-level configuration:

```
06-livekit-videoconference-project/
├── .git/                          # ❌ NOT PRESENT - Need to create
├── livekit-backend-api/.git/      # ✅ Separate repo
├── livekit-meet-frontend/.git/    # ✅ Separate repo
├── livekit-meet-infrastructure/.git/ # ✅ Separate repo
├── docker-compose.yml             # Root-level orchestration
├── .env                           # Root-level config (DO NOT COMMIT)
├── localstack-init.sh             # Root-level script
├── livekit.yaml                   # Root-level config
├── egress.yaml                    # Root-level config
└── .kiro/                         # Kiro specs and documentation
```

## Recommended Strategy: Monorepo with Git Submodules

### Why This Approach?

1. **Unified Deployment**: All components deploy together to Oracle Cloud
2. **Shared Configuration**: docker-compose.yml, .env files, and configs are at root
3. **Independent Development**: Each service can still be developed independently
4. **Version Control**: Track which versions of each service work together

### Implementation Steps

#### 1. Initialize Root Repository

```bash
# Initialize root repo
git init

# Create .gitignore
cat > .gitignore << 'EOF'
# Environment files
.env
.env.local
*.env.backup

# Node modules (handled by submodules)
node_modules/
*/node_modules/

# Build outputs
dist/
build/
.next/

# Docker volumes
*-data/

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Temporary files
*.tmp
*.temp
bash.exe.stackdump
EOF

# Initial commit
git add .
git commit -m "Initial commit: Root orchestration and configuration"
```

#### 2. Convert Existing Repos to Submodules

```bash
# Remove existing .git directories from subfolders (backup first!)
# We'll re-add them as submodules

# Add each component as a submodule
git submodule add <backend-repo-url> livekit-backend-api
git submodule add <frontend-repo-url> livekit-meet-frontend
git submodule add <infrastructure-repo-url> livekit-meet-infrastructure

# Commit submodule configuration
git add .gitmodules
git commit -m "Add service submodules"
```

#### 3. Create Remote Repositories

You'll need to create repositories on GitHub/GitLab/Bitbucket:

1. **livekit-videoconference** (root/orchestration repo)
2. **livekit-backend-api** (if not already exists)
3. **livekit-meet-frontend** (if not already exists)
4. **livekit-meet-infrastructure** (if not already exists)

### Alternative Strategy: Single Monorepo

If you prefer simpler management without submodules:

```bash
# Remove existing .git directories from subfolders
rm -rf livekit-backend-api/.git
rm -rf livekit-meet-frontend/.git
rm -rf livekit-meet-infrastructure/.git

# Initialize single repo
git init

# Add all files
git add .
git commit -m "Initial commit: Complete LiveKit video conference system"

# Push to remote
git remote add origin <your-repo-url>
git push -u origin main
```

## Deployment Strategy

### Local Development

**Current Setup**: ✅ Working

- All services run via `docker-compose up`
- LocalStack for S3-compatible storage
- Hot-reloading for backend and frontend

### Oracle Cloud Deployment Options

#### Option 1: All-in-One Oracle Cloud (Recommended)

**Deploy everything to your Oracle Cloud server:**

**Pros:**

- Simpler architecture
- Lower latency (all services co-located)
- Free tier covers everything
- Single deployment target

**Cons:**

- Single point of failure
- Need to manage SSL/TLS yourself

**Implementation:**

```bash
# On Oracle Cloud server
git clone <root-repo-url>
cd livekit-videoconference
cp .env.example .env
# Edit .env with production values
docker-compose -f docker-compose.prod.yml up -d
```

#### Option 2: Hybrid (Frontend on AWS Amplify)

**Frontend on AWS Amplify, Backend on Oracle Cloud:**

**Pros:**

- CDN distribution for frontend
- Automatic SSL for frontend
- Amplify handles frontend scaling

**Cons:**

- More complex setup
- Cross-cloud latency
- Additional costs (Amplify not free)
- CORS configuration needed

**Implementation:**

- Deploy backend/LiveKit/DB to Oracle Cloud
- Deploy frontend to AWS Amplify
- Configure CORS on backend
- Update frontend env vars to point to Oracle Cloud backend

### Recommendation: Option 1 (All-in-One)

Given that:

1. You already have Oracle Cloud server provisioned
2. It's powerful enough for all services
3. Oracle free tier is generous
4. Simpler to manage and debug

**Deploy everything to Oracle Cloud.**

## Git Workflow

### Daily Development

```bash
# Pull latest changes
git pull
git submodule update --remote --merge

# Make changes to root config
git add docker-compose.yml
git commit -m "Update docker-compose configuration"

# Make changes to a service
cd livekit-backend-api
git checkout -b feature/new-endpoint
# ... make changes ...
git add .
git commit -m "Add new API endpoint"
git push origin feature/new-endpoint
cd ..

# Update submodule reference in root
git add livekit-backend-api
git commit -m "Update backend to include new endpoint"
git push
```

### Deployment Workflow

```bash
# Tag a release
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# On Oracle Cloud server
git fetch --tags
git checkout v1.0.0
git submodule update --init --recursive
docker-compose down
docker-compose up -d --build
```

## Environment Management

### Local Development (.env)

```bash
# Use local services
S3_ENDPOINT=http://localstack:4566
LIVEKIT_URL=ws://livekit:7880
```

### Production (.env.production)

```bash
# Use Oracle Cloud services
S3_ENDPOINT=https://namespace.compat.objectstorage.region.oraclecloud.com
LIVEKIT_URL=wss://yourdomain.com:7881
```

## Next Steps

1. **Fix current issues** (in progress)
2. **Choose Git strategy** (monorepo vs submodules)
3. **Create remote repositories**
4. **Initial commit and push**
5. **Set up Oracle Cloud deployment**
6. **Configure production environment**
7. **Test end-to-end deployment**

## Questions to Answer

1. **Do you want to keep services as separate repos?** (submodules) or **merge into one?** (monorepo)
2. **Do you have GitHub/GitLab accounts** for hosting repos?
3. **What's your Oracle Cloud server domain/IP?**
4. **Do you want to use a custom domain** or Oracle's provided IP?
