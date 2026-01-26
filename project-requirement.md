### **Project Charter: Standalone LiveKit Videoconferencing System on AWS**

**Project Objective:**
To plan, code, and deploy a fully-standalone, scalable, and cost-optimized videoconferencing system using LiveKit. The system must function independently but be designed to integrate with external clients, such as a Moodle plugin, via a secure API. The entire infrastructure must be defined and deployed using the **AWS CDK (TypeScript)**.

**Core Architecture (Microservices):**

1. **Frontend (UI):** The `livekit-meet` React application.
2. **Custom Backend API (The "Brain"):** The `livekit-token-server` (Node.js/TypeScript) API. This is the central, secure hub for all business logic.
3. **Core Media Server (The "Engine"):** The LiveKit Server and Egress services.
4. **Storage:** A dedicated object storage for recordings.

**Deployment Stack & AWS Service Implementation:**

The AWS CDK script (the primary deliverable) must provision the following:

1. **Frontend (AWS Amplify):**
   - Provision an Amplify App.
   - Configure it to connect to a Git repository (e.g., GitHub) for the `livekit-meet` frontend.
   - Enable CI/CD for automatic builds and deployments on `git push`.
2. **Custom Backend API (AWS Fargate - "Scale-to-Zero"):**
   - Provision an **Amazon ECR** repository to host the Docker image for the `livekit-token-server`.
   - Provision a **Fargate Service** (on Fargate Spot for cost-saving, if appropriate for this stateless API) with a "Desired Count" of 0.
   - Provision an **API Gateway (HTTP API)** as the public entry point.
   - Provision a **Lambda Function** (the "kicker") that is triggered by API Gateway. Its sole job is to "wake up" a Fargate task by changing the "Desired Count" to 1. The Fargate task will then handle the request. This ensures a $0 idle cost.
   - Configure the Fargate service to scale back down to 0 after 15 minutes of inactivity.
   - Securely inject the `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` into the Fargate task from **AWS Secrets Manager**.
3. **Core Media Server (Amazon EC2):**
   - Provision an **EC2 Instance** (Ubuntu, `t3.`small or similar). Do _not_ use a "micro" instance.
   - Provision an **EC2 User Data** script to:
     1. Install Docker and Docker Compose.
     2. Run the `livekit/generate` tool to create the `docker-compose.yaml`, `livekit.yaml`, and `caddy.yaml` files. The script must answer the prompts to enable Egress, use Caddy for SSL, and configure the correct domain name.
     3. Run `docker-compose up -d` to start the services.
   - Provision a **Security Group** opening the necessary LiveKit ports (TCP/UDP 50000-60000, TCP 7881, TCP/UDP 443) .
   - Provision an **Elastic IP** and associate it with the instance.
   - _Note:_ The CDK script will also output the recommended **AWS Savings Plan** to purchase for this instance.
4. **State (Amazon ElastiCache):**
   - Provision an ElastiCache for **Redis** cluster (`cache.t3.micro`).
   - Configure its Security Group to only allow connections from the EC2 instance and the Fargate service.
5. **Storage (Amazon S3):**
   - Provision an **S3 Bucket** (e.g., `livekit-recordings-bucket`).
   - Provision an **IAM Role** for the EC2 instance's Egress container.
   - This IAM Role must have `s3:PutObject` permissions _only_ for this specific bucket. The `egress.yaml` (generated on the EC2 instance) will be configured to use this IAM Role for authentication instead of a static key.

**Required AI Deliverables (Code & Artifacts):**

1. **AWS CDK Project (TypeScript):**
   - A complete CDK project in TypeScript that defines all AWS resources as specified above.
   - The stack must be well-organized and include outputs (like the API Gateway URL and EC2 IP).
2. **Custom Backend API Project (Node.js/TypeScript):**
   - The `livekit-token-server` project, including a `Dockerfile` for ECR.
   - The API must include endpoints for:
     - `/get-token`: Receives `roomName` and `identity`, returns a valid LiveKit token.
     - `/start-recording`: Receives `roomName`, uses the Server SDK to start Egress, and saves to the S3 bucket.
     - `/stop-recording`: Receives an `egressID` and stops the recording.
     - `/list-recordings`: Receives `roomName` and lists the corresponding MP4 files from the S3 bucket.
3. **Frontend (`livekit-meet`) Customization Guide:**
   - Provide the code snippets needed to add a "Start/Stop Recording" button to the React UI.
   - This button must call the new `/start-recording` and `/stop-recording` endpoints on the Fargate API.
4. **`README.md` (Deployment Guide):**
   - A step-by-step guide on how to deploy this entire system, from building the Docker image to running `cdk deploy`
