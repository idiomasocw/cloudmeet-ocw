#!/bin/bash
# Production Setup Script for LiveKit on Oracle Cloud
# Domain: live-lesson.onecultureworld.com
# Usage: ./setup-production.sh

set -e

# Default values
DOMAIN="live-lesson.onecultureworld.com"
EMAIL="admin@onecultureworld.com" # Default email, can be changed
ORACLE_COMPOSE_FILE="docker-compose.oracle.yml"
NGINX_CONF_FILE="nginx.oracle.conf"
ENV_FILE=".env"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting LiveKit Production Setup for $DOMAIN${NC}"

# Check for root/sudo
if [ "$EUID" -ne 0 ]; then 
  echo -e "${YELLOW}Please run as root or with sudo${NC}"
  exit 1
fi

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    dnf update -y
    dnf install -y docker docker-compose git
    systemctl start docker
    systemctl enable docker
    usermod -aG docker $USER
    # Install Docker Compose v2 if not present
    if ! command -v docker-compose &> /dev/null; then
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
else
    echo -e "${GREEN}Docker is already installed.${NC}"
fi

# 2. Environment Setup
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    
    # Generate secure passwords
    POSTGRES_PASSWORD=$(openssl rand -base64 12)
    LIVEKIT_API_KEY=$(openssl rand -hex 16)
    LIVEKIT_API_SECRET=$(openssl rand -base64 32)
    
    echo -e "Enter your AWS Access Key ID:"
    read AWS_ACCESS_KEY
    echo -e "Enter your AWS Secret Access Key:"
    read AWS_SECRET_KEY
    echo -e "Enter your AWS Region (default: us-east-1):"
    read AWS_REGION
    AWS_REGION=${AWS_REGION:-us-east-1}
    echo -e "Enter your storage bucket name (default: livekit-recordings):"
    read S3_BUCKET
    S3_BUCKET=${S3_BUCKET:-livekit-recordings}

    cat > $ENV_FILE << EOF
# Production Environment for $DOMAIN

# Application
NODE_ENV=production
PORT=3001
DOMAIN=$DOMAIN

# Database (PostgreSQL)
POSTGRES_USER=livekit
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=postgresql://livekit:$POSTGRES_PASSWORD@postgres:5432/livekit_conference

# Redis
REDIS_URL=redis://redis:6379

# LiveKit
LIVEKIT_API_KEY=$LIVEKIT_API_KEY
LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET
LIVEKIT_URL=wss://$DOMAIN
LIVEKIT_PUBLIC_URL=wss://$DOMAIN

# Object Storage (AWS S3)
S3_ACCESS_KEY=$AWS_ACCESS_KEY
S3_SECRET_KEY=$AWS_SECRET_KEY
S3_REGION=$AWS_REGION
S3_BUCKET=$S3_BUCKET
# AWS S3 standard endpoint
S3_ENDPOINT=https://s3.$AWS_REGION.amazonaws.com
# For standard AWS S3, forcePathStyle is usually false
S3_FORCE_PATH_STYLE=false
AWS_REGION=$AWS_REGION

EOF
    echo -e "${GREEN}.env file created with secure credentials.${NC}"
    echo -e "${YELLOW}IMPORTANT: Save these credentials locally!${NC}"
    echo "API Key: $LIVEKIT_API_KEY"
    echo "API Secret: $LIVEKIT_API_SECRET"
    echo "Postgres Password: $POSTGRES_PASSWORD"
else
    echo -e "${GREEN}.env file already exists. Skipping generation.${NC}"
fi

# 3. SSL Certificate Generation using Certbot
CERT_PATH="/etc/nginx/ssl/live/$DOMAIN"
if [ ! -f "$CERT_PATH/fullchain.pem" ]; then
    echo -e "${YELLOW}Generating SSL certificates for $DOMAIN...${NC}"
    
    # Stop any existing servers on port 80
    echo "Stopping any existing containers ensuring port 80 is free..."
    docker-compose -f $ORACLE_COMPOSE_FILE down || true
    
    echo "Running Certbot..."
    # We use a temporary standalone certbot run
    mkdir -p ./ssl
    
    docker run --rm \
      -p 80:80 \
      -v $(pwd)/ssl/letsencrypt:/etc/letsencrypt \
      certbot/certbot certonly --standalone \
      --preferred-challenges http \
      --non-interactive \
      --agree-tos \
      --email $EMAIL \
      -d $DOMAIN

    echo -e "${GREEN}SSL Certificates generated.${NC}"
    
    # We need to map the certs correctly for Nginx
    # The nginx.oracle.conf expects /etc/nginx/ssl/live/$DOMAIN/...
    # But we mounted ./ssl to /etc/nginx/ssl in docker-compose
    # So on host, they are in ./ssl/letsencrypt/live/$DOMAIN
    
    # We should update docker-compose.oracle.yml volume mapping
    # BUT, to be safe without editing yaml, we can copy them to a simpler structure or just ensure the yaml mounts ./ssl:/etc/nginx/ssl
    # The certbot output puts them in ./ssl/letsencrypt/live/...
    # Our nginx config points to /etc/nginx/ssl/live/... 
    # So we need to ensure the structure matches inside the container.
    
    # Let's organize the local ssl folder so it matches Nginx expectation
    # Nginx config: /etc/nginx/ssl/live/domain/fullchain.pem
    # Docker mount: ./ssl:/etc/nginx/ssl
    # So locally we need: ./ssl/live/domain/fullchain.pem
    
    # Certbot creates: ./ssl/letsencrypt/live/domain/fullchain.pem
    # Let's symlink or move
    
    mkdir -p ./ssl/live/$DOMAIN
    cp -L ./ssl/letsencrypt/live/$DOMAIN/fullchain.pem ./ssl/live/$DOMAIN/
    cp -L ./ssl/letsencrypt/live/$DOMAIN/privkey.pem ./ssl/live/$DOMAIN/
    
    echo -e "${GREEN}Certificates prepared for Nginx.${NC}"

else
    echo -e "${GREEN}SSL Certificates appear to exist. Skipping generation.${NC}"
fi

# 4. Firewall Configuration (Oracle Linux default is firewalld or iptables)
echo -e "${YELLOW}Configuring local firewall...${NC}"
# Allow HTTP, HTTPS, and LiveKit Ports
firewall-cmd --permanent --add-service=http || true
firewall-cmd --permanent --add-service=https || true
# LiveKit TCP ports
firewall-cmd --permanent --add-port=7880/tcp || true
firewall-cmd --permanent --add-port=7881/tcp || true
# LiveKit UDP ports range
firewall-cmd --permanent --add-port=50000-50100/udp || true
# Reload firewall
firewall-cmd --reload || true
echo -e "${GREEN}Firewall configured (Ensure Oracle Cloud Security List also allows these ports!).${NC}"

# 5. Deployment
echo -e "${GREEN}Deploying application stack...${NC}"
docker-compose -f $ORACLE_COMPOSE_FILE down || true
docker-compose -f $ORACLE_COMPOSE_FILE up -d

echo -e "${GREEN}✅ deployment completed successfully!${NC}"
echo -e "Access your server at: https://$DOMAIN"
echo -e "Backend API health: https://$DOMAIN/health"
