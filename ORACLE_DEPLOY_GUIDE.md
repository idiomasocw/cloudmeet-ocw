# Oracle Cloud Deployment Guide

## Prerequisites

1.  **Oracle Cloud Instance**: An Ampere (ARM) or AMD instance running Oracle Linux 8/9 or Ubuntu.
2.  **Domain Name**: `live-lesson.onecultureworld.com` must be pointing to your instance's **Public IP Address** (A Record). This is crucial for SSL generation.
3.  **Oracle Cloud Security List**: In the Oracle Cloud Console (Networking -> VCN -> Security Lists), start by allowing Ingress logic for the following ports:
    *   TCP: 80, 443 (Web)
    *   TCP: 7880, 7881 (LiveKit)
    *   UDP: 50000-50100 (WebRTC Audio/Video)
    *   TCP: 22 (SSH - likely already open)

## Quick Start

1.  **SSH into your server**:
    ```bash
    ssh opc@your-server-ip
    ```
2.  **Pull the latest code** (if not already there):
    ```bash
    cd livekit-app
    git pull
    ```
3.  **Run the Setup Script**:
    ```bash
    sudo chmod +x setup-production.sh
    sudo ./setup-production.sh
    ```

## What the Script Does

1.  **Installs Docker**: If not found on the system.
2.  **Generates `.env`**:
    *   It creates a production `.env` file.
    *   **Postgres**: It generates a secure random password for the `livekit` database user.
    *   **LiveKit**: It generates random API Keys and Secrets.
    *   **AWS**: It asks you for your AWS Access Key, Secret, Region, and Bucket name for storing recordings.
3.  **Generates SSL**:
    *   It uses `certbot` to generate a real Let's Encrypt certificate for `live-lesson.onecultureworld.com`.
4.  **Configures Firewall**:
    *   It opens the necessary ports on the *local* server firewall (`firewalld`).
5.  **Deploys**:
    *   Starts the Docker containers for Postgres, Redis, LiveKit, Backend, and Nginx.

## Post-Deployment Checks

1.  **Check Status**:
    ```bash
    docker-compose -f docker-compose.oracle.yml ps
    ```
    All services (`livekit-server-prod`, `livekit-postgres-prod`, etc.) should be `Up (healthy)`.

2.  **View Logs**:
    ```bash
    docker-compose -f docker-compose.oracle.yml logs -f
    ```

3.  **Get Credentials**:
    If you lost the printed credentials, you can find them in the `.env` file:
    ```bash
    cat .env
    ```
    You will need `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` for your local frontend development `.env`.

## Troubleshooting

-   **SSL Failure**: Ensure your DNS is fully propagated and pointing to the correct IP. Try pinging your domain from the server: `ping live-lesson.onecultureworld.com`.
-   **502 Bad Gateway**: This usually means the Backend or LiveKit service isn't fully ready yet. Wait 30 seconds. If it persists, check logs: `docker logs livekit-nginx-prod`.
-   **Postgres Connection Error**: Ensure the `.env` `POSTGRES_PASSWORD` matches what is inside the running container. If you changed the password in `.env` *after* the first run, you must delete the postgres volume to reset it: `docker volume rm livekit-postgres-data-prod`.
