#!/bin/bash
# Oracle Cloud Deployment Script
# Run this on your Oracle Cloud Ampere server

set -e

echo "🚀 Starting LiveKit deployment on Oracle Cloud..."

# 1. Update system and install Docker
sudo dnf update -y
sudo dnf install -y docker docker-compose git

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# 2. Install Docker Compose v2
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. Clone your repository (replace with your repo)
git clone https://github.com/your-username/your-repo.git livekit-app
cd livekit-app

# 4. Create Oracle Cloud environment file
cat > .env.oracle << EOF
# Oracle Cloud Configuration
NODE_ENV=production
PORT=3001

# Database
POSTGRES_USER=livekit
POSTGRES_PASSWORD=your-secure-password-here
DATABASE_URL=postgresql://livekit:your-secure-password-here@postgres:5432/livekit_conference

# Redis
REDIS_URL=redis://redis:6379

# LiveKit (you'll set these after LiveKit starts)
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_PUBLIC_URL=wss://your-domain.com

# Oracle Cloud Object Storage (S3-compatible)
S3_ENDPOINT=https://your-namespace.compat.objectstorage.us-ashburn-1.oraclecloud.com
S3_ACCESS_KEY=your-customer-secret-key
S3_SECRET_KEY=your-customer-secret-value
S3_BUCKET=livekit-recordings
S3_REGION=us-ashburn-1
S3_FORCE_PATH_STYLE=true
AWS_REGION=us-ashburn-1

# Oracle Cloud specific
OCI_REGION=us-ashburn-1
OCI_NAMESPACE=your-tenancy-namespace
EOF

# 5. Copy the Oracle Cloud docker-compose file
cp docker-compose.oracle.yml docker-compose.yml

# 6. Start services
docker-compose --env-file .env.oracle up -d

echo "✅ Deployment complete!"
echo "📝 Next steps:"
echo "1. Configure your domain DNS to point to this server"
echo "2. Set up SSL certificates (Let's Encrypt)"
echo "3. Update LiveKit credentials in .env.oracle"
echo "4. Configure Oracle Cloud Object Storage"
echo ""
echo "🔍 Check status: docker-compose ps"
echo "📋 View logs: docker-compose logs -f"