# Oracle Cloud Setup Guide

## Prerequisites

- Oracle Cloud account with Ampere server running
- Domain name pointing to your server
- SSH access to your server

## Step 1: Server Preparation

```bash
# SSH into your Oracle Cloud server
ssh ubuntu@your-server-ip

# Run the deployment script
curl -sSL https://raw.githubusercontent.com/your-repo/main/oracle-cloud-deploy.sh | bash
```

## Step 2: Oracle Object Storage Setup

1. **Create Object Storage Bucket**
   - Go to Oracle Cloud Console
   - Navigate to Object Storage
   - Create bucket named `livekit-recordings`
   - Set to Standard tier

2. **Generate Customer Secret Keys**
   - Go to Identity > Users > Your User
   - Click "Customer Secret Keys"
   - Generate new key pair
   - Save the Access Key and Secret Key

3. **Update Environment Variables**

   ```bash
   # Edit the environment file
   nano .env.oracle

   # Update these values:
   S3_ENDPOINT=https://your-namespace.compat.objectstorage.us-ashburn-1.oraclecloud.com
   S3_ACCESS_KEY=your-customer-secret-key
   S3_SECRET_KEY=your-customer-secret-value
   OCI_NAMESPACE=your-tenancy-namespace
   ```

## Step 3: Domain and SSL Setup

1. **Point your domain to Oracle Cloud server**

   ```
   A record: your-domain.com -> your-server-ip
   A record: livekit.your-domain.com -> your-server-ip
   ```

2. **Get SSL certificates (Let's Encrypt)**

   ```bash
   # Install certbot
   sudo dnf install -y certbot

   # Get certificates
   sudo certbot certonly --standalone -d your-domain.com -d livekit.your-domain.com

   # Copy certificates to nginx directory
   sudo mkdir -p ssl
   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/
   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/
   ```

3. **Update nginx configuration**

   ```bash
   # Edit nginx config
   nano nginx.oracle.conf

   # Replace 'your-domain.com' with your actual domain
   sed -i 's/your-domain.com/yourdomain.com/g' nginx.oracle.conf
   ```

## Step 4: Start Services

```bash
# Start all services
docker-compose --env-file .env.oracle up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
```

## Step 5: Configure LiveKit Keys

```bash
# Generate LiveKit keys
docker exec -it livekit-server-prod livekit-cli create-token \
  --api-key devkey --api-secret devsecret \
  --room test --identity test-user

# Update .env.oracle with the generated keys
nano .env.oracle
```

## Step 6: Test Everything

1. **Backend Health Check**

   ```bash
   curl https://your-domain.com/health
   ```

2. **Recording Viewer**

   ```
   https://your-domain.com/recordings.html
   ```

3. **LiveKit Connection**
   ```
   wss://livekit.your-domain.com
   ```

## Step 7: Deploy Frontend to AWS Amplify

1. **Update frontend environment variables**

   ```bash
   NEXT_PUBLIC_BACKEND_URL=https://your-domain.com
   NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.your-domain.com
   ```

2. **Deploy using CDK (frontend only)**
   ```bash
   cd livekit-meet-infrastructure
   # Comment out backend resources, keep only Amplify
   cdk deploy --profile default
   ```

## Cost Estimate

- Oracle Cloud Ampere (4 OCPU, 24GB RAM): **$0/month** (Always Free)
- Object Storage (50GB): **~$1/month**
- AWS Amplify: **~$5/month**
- **Total: ~$6/month** 🎉

## Monitoring and Maintenance

```bash
# Check resource usage
docker stats

# Update containers
docker-compose pull
docker-compose up -d

# Backup database
docker exec livekit-postgres-prod pg_dump -U livekit livekit_conference > backup.sql

# Renew SSL certificates (add to crontab)
0 0 1 * * /usr/bin/certbot renew --quiet
```
