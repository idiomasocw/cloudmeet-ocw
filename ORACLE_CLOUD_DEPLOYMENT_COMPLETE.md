# Oracle Cloud Deployment Guide - Complete Step-by-Step

## Prerequisites Checklist

- ✅ Oracle Cloud account with Always Free tier
- ✅ Ampere A1 Compute instance (4 OCPU, 24GB RAM) running Ubuntu 22.04
- ✅ Domain name (e.g., yourdomain.com)
- ✅ SSH key pair for server access
- ✅ GitHub repository with your code

## Phase 1: Server Setup and Initial Configuration

### Step 1: Connect to Your Oracle Cloud Server

```bash
# SSH into your server (replace with your actual IP and key)
ssh -i ~/.ssh/your-key.pem ubuntu@your-server-ip

# Update the system
sudo apt update && sudo apt upgrade -y
```

### Step 2: Install Required Software

```bash
# Install Docker and Docker Compose
sudo apt install -y docker.io docker-compose git curl wget nginx certbot python3-certbot-nginx

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker ubuntu

# Log out and back in for group changes to take effect
exit
ssh -i ~/.ssh/your-key.pem ubuntu@your-server-ip
```

### Step 3: Clone Your Repository

```bash
# Clone your repository (replace with your actual repo)
git clone https://github.com/your-username/your-repo.git livekit-app
cd livekit-app

# Make deployment script executable
chmod +x oracle-cloud-deploy.sh
```

## Phase 2: Oracle Cloud Object Storage Setup

### Step 4: Create Object Storage Bucket

1. **Login to Oracle Cloud Console**
2. **Navigate to Object Storage & Archive Storage**
3. **Create Bucket**:
   - Name: `livekit-recordings`
   - Storage Tier: Standard
   - Object Events: Disabled
   - Object Versioning: Disabled

### Step 5: Generate Customer Secret Keys (S3-Compatible)

1. **Go to Identity & Security > Users**
2. **Click on your username**
3. **Scroll down to "Customer Secret Keys"**
4. **Click "Generate Secret Key"**
5. **Save both the Access Key and Secret Key** (you won't see the secret again!)

### Step 6: Get Your Tenancy Namespace

```bash
# In Oracle Cloud Console, go to Administration > Tenancy Details
# Copy the "Object Storage Namespace" value
```

## Phase 3: Environment Configuration

### Step 7: Create Production Environment File

```bash
# Create the production environment file
cat > .env.production << 'EOF'
# Production Configuration
NODE_ENV=production
PORT=3001

# Database
POSTGRES_USER=livekit
POSTGRES_PASSWORD=CHANGE_THIS_SECURE_PASSWORD_123!
DATABASE_URL=postgresql://livekit:CHANGE_THIS_SECURE_PASSWORD_123!@postgres:5432/livekit_conference

# Redis
REDIS_URL=redis://redis:6379

# LiveKit (generate these after first run)
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret
LIVEKIT_URL=ws://livekit:7880
LIVEKIT_PUBLIC_URL=wss://livekit.yourdomain.com

# Oracle Cloud Object Storage (REPLACE WITH YOUR VALUES)
S3_ENDPOINT=https://YOUR_NAMESPACE.compat.objectstorage.us-ashburn-1.oraclecloud.com
S3_ACCESS_KEY=YOUR_CUSTOMER_SECRET_ACCESS_KEY
S3_SECRET_KEY=YOUR_CUSTOMER_SECRET_VALUE
S3_BUCKET=livekit-recordings
S3_REGION=us-ashburn-1
S3_FORCE_PATH_STYLE=true
AWS_REGION=us-ashburn-1

# Oracle Cloud specific
OCI_REGION=us-ashburn-1
OCI_NAMESPACE=YOUR_TENANCY_NAMESPACE
EOF

# IMPORTANT: Replace the placeholder values with your actual values
nano .env.production
```

### Step 8: Update Configuration Files for Your Domain

```bash
# Update nginx configuration with your domain
sed -i 's/your-domain.com/yourdomain.com/g' nginx.oracle.conf

# Update LiveKit configuration
sed -i 's/your-domain.com/yourdomain.com/g' livekit.oracle.yaml
```

## Phase 4: SSL Certificate Setup

### Step 9: Configure DNS

Before getting SSL certificates, point your domains to your Oracle Cloud server:

```
A record: yourdomain.com -> YOUR_ORACLE_CLOUD_SERVER_IP
A record: livekit.yourdomain.com -> YOUR_ORACLE_CLOUD_SERVER_IP
```

### Step 10: Get SSL Certificates

```bash
# Stop nginx if it's running
sudo systemctl stop nginx

# Get certificates for both domains
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d livekit.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive

# Create SSL directory and copy certificates
mkdir -p ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/
sudo chown -R ubuntu:ubuntu ssl/
```

## Phase 5: Firewall Configuration

### Step 11: Configure Oracle Cloud Security Lists

In Oracle Cloud Console:

1. **Go to Networking > Virtual Cloud Networks**
2. **Click on your VCN**
3. **Click on your subnet's Security List**
4. **Add Ingress Rules**:

```
Source: 0.0.0.0/0, Protocol: TCP, Port: 80 (HTTP)
Source: 0.0.0.0/0, Protocol: TCP, Port: 443 (HTTPS)
Source: 0.0.0.0/0, Protocol: TCP, Port: 7880 (LiveKit)
Source: 0.0.0.0/0, Protocol: TCP, Port: 7881 (LiveKit API)
Source: 0.0.0.0/0, Protocol: UDP, Port Range: 50000-50100 (RTC)
Source: 0.0.0.0/0, Protocol: TCP, Port: 5349 (TURN TLS)
Source: 0.0.0.0/0, Protocol: UDP, Port: 3478 (TURN UDP)
```

### Step 12: Configure Ubuntu Firewall

```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 50000:50100/udp
sudo ufw allow 5349/tcp
sudo ufw allow 3478/udp
sudo ufw --force enable
```

## Phase 6: Application Deployment

### Step 13: Deploy the Application

```bash
# Use the Oracle Cloud docker-compose file
cp docker-compose.oracle.yml docker-compose.yml

# Start the services
docker-compose --env-file .env.production up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 14: Generate LiveKit API Keys

```bash
# Generate secure API keys
LIVEKIT_API_KEY=$(openssl rand -hex 16)
LIVEKIT_API_SECRET=$(openssl rand -hex 32)

echo "Generated keys:"
echo "LIVEKIT_API_KEY=$LIVEKIT_API_KEY"
echo "LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET"

# Update the environment file
sed -i "s/LIVEKIT_API_KEY=devkey/LIVEKIT_API_KEY=$LIVEKIT_API_KEY/" .env.production
sed -i "s/LIVEKIT_API_SECRET=devsecret/LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET/" .env.production

# Update LiveKit config
sed -i "s/devkey: devsecret/$LIVEKIT_API_KEY: $LIVEKIT_API_SECRET/" livekit.oracle.yaml

# Update egress config
sed -i "s/api_key: devkey/api_key: $LIVEKIT_API_KEY/" egress.oracle.yaml
sed -i "s/api_secret: devsecret/api_secret: $LIVEKIT_API_SECRET/" egress.oracle.yaml

# Restart services with new keys
docker-compose --env-file .env.production down
docker-compose --env-file .env.production up -d
```

## Phase 7: Nginx Reverse Proxy Setup

### Step 15: Configure and Start Nginx

```bash
# Copy our nginx config to the system
sudo cp nginx.oracle.conf /etc/nginx/sites-available/livekit
sudo ln -sf /etc/nginx/sites-available/livekit /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Phase 8: Testing and Verification

### Step 16: Test All Components

```bash
# Test backend health
curl https://yourdomain.com/health

# Test recording viewer
curl -I https://yourdomain.com/recordings.html

# Test LiveKit connection
curl -I https://livekit.yourdomain.com

# Check all services are running
docker-compose ps
```

### Step 17: Test Recording Functionality

1. **Open your frontend** (deployed on AWS Amplify)
2. **Update frontend environment variables** to point to your Oracle Cloud backend:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://yourdomain.com
   NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.yourdomain.com
   ```
3. **Join a room and test recording**
4. **Check recordings at**: `https://yourdomain.com/recordings.html`

## Phase 9: CI/CD Pipeline Setup (Optional but Recommended)

### Step 18: GitHub Actions Setup

1. **Add secrets to your GitHub repository**:
   - `ORACLE_CLOUD_HOST`: Your server IP
   - `ORACLE_CLOUD_USER`: `ubuntu`
   - `ORACLE_CLOUD_SSH_KEY`: Your private SSH key content

2. **Copy the CI/CD pipeline file**:

   ```bash
   mkdir -p .github/workflows
   cp ci-cd-pipeline.yml .github/workflows/deploy.yml
   ```

3. **Commit and push**:
   ```bash
   git add .
   git commit -m "Add Oracle Cloud deployment configuration"
   git push origin main
   ```

## Phase 10: Monitoring and Maintenance

### Step 19: Set Up Monitoring

```bash
# Create monitoring script
cat > monitor.sh << 'EOF'
#!/bin/bash
echo "=== System Resources ==="
free -h
df -h
echo "=== Docker Status ==="
docker-compose ps
echo "=== Service Health ==="
curl -s https://yourdomain.com/health | jq .
EOF

chmod +x monitor.sh

# Add to crontab for daily monitoring
(crontab -l 2>/dev/null; echo "0 9 * * * /home/ubuntu/livekit-app/monitor.sh >> /var/log/livekit-monitor.log 2>&1") | crontab -
```

### Step 20: Backup Strategy

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ubuntu/backups"
mkdir -p $BACKUP_DIR

# Backup database
docker exec livekit-postgres-prod pg_dump -U livekit livekit_conference > $BACKUP_DIR/db_backup_$DATE.sql

# Backup environment files
cp .env.production $BACKUP_DIR/env_backup_$DATE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "env_backup_*" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x backup.sh

# Add to crontab for daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/livekit-app/backup.sh >> /var/log/livekit-backup.log 2>&1") | crontab -
```

### Step 21: SSL Certificate Auto-Renewal

```bash
# Test certificate renewal
sudo certbot renew --dry-run

# Add to crontab for automatic renewal
(crontab -l 2>/dev/null; echo "0 3 1 * * /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
```

## Phase 11: AWS Amplify Frontend Deployment

### Step 22: Deploy Frontend to AWS Amplify

1. **Update your CDK stack** to deploy only the Amplify frontend:

   ```bash
   cd livekit-meet-infrastructure
   # Comment out all resources except Amplify in the stack
   cdk deploy --profile default
   ```

2. **Update Amplify environment variables**:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://yourdomain.com
   NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.yourdomain.com
   NEXT_PUBLIC_CONN_DETAILS_ENDPOINT=https://yourdomain.com/connection-details
   ```

## Troubleshooting Guide

### Common Issues and Solutions

1. **SSL Certificate Issues**:

   ```bash
   sudo certbot certificates
   sudo certbot renew --force-renewal
   ```

2. **Docker Permission Issues**:

   ```bash
   sudo usermod -aG docker ubuntu
   # Log out and back in
   ```

3. **Firewall Issues**:

   ```bash
   sudo ufw status
   # Check Oracle Cloud Security Lists
   ```

4. **Recording Not Working**:

   ```bash
   docker logs livekit-egress-prod
   # Check S3 credentials and bucket permissions
   ```

5. **LiveKit Connection Issues**:
   ```bash
   docker logs livekit-server-prod
   # Check API keys match between services
   ```

## Cost Optimization Tips

1. **Use Oracle Cloud Always Free resources**
2. **Monitor resource usage**: `docker stats`
3. **Set up log rotation**: `sudo logrotate -f /etc/logrotate.conf`
4. **Clean up old Docker images**: `docker system prune -a`

## Final Checklist

- ✅ All services running: `docker-compose ps`
- ✅ SSL certificates valid: `curl -I https://yourdomain.com`
- ✅ Recording functionality working
- ✅ Frontend deployed to AWS Amplify
- ✅ Monitoring and backups configured
- ✅ CI/CD pipeline working

## Expected Monthly Costs

- **Oracle Cloud**: $0 (Always Free tier)
- **Object Storage**: ~$1-2
- **AWS Amplify**: ~$5
- **Domain**: ~$10-15/year
- **Total**: ~$6-7/month

## Support and Maintenance

- **Monitor logs**: `docker-compose logs -f`
- **Update services**: `docker-compose pull && docker-compose up -d`
- **Check system resources**: `./monitor.sh`
- **Backup database**: `./backup.sh`

This setup gives you a production-ready, scalable LiveKit deployment on Oracle Cloud with minimal costs!
