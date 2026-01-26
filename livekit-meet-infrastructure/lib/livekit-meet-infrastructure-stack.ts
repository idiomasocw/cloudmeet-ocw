import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as amplify from "@aws-cdk/aws-amplify-alpha";
import * as logs from "aws-cdk-lib/aws-logs";
import * as applicationautoscaling from "aws-cdk-lib/aws-applicationautoscaling";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import {
  HttpLambdaIntegration,
  HttpUrlIntegration,
} from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

interface DomainConfig {
  frontendDomain: string;
  livekitDomain: string;
  apiDomain: string;
  githubRepo: string;
}

interface LivekitMeetInfrastructureStackProps extends cdk.StackProps {
  domainConfig: DomainConfig;
}

export class LivekitMeetInfrastructureStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: LivekitMeetInfrastructureStackProps
  ) {
    super(scope, id, props);

    const { domainConfig } = props;

    // Stage 1: VPC and Networking Foundation
    const vpc = new ec2.Vpc(this, "LivekitVpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Create secret with placeholder values that can be manually updated
    const livekitSecret = new secretsmanager.Secret(this, "LivekitCredentials", {
      secretName: "livekit-credentials",
      description: "LiveKit credentials - manually configured to match server",
      secretObjectValue: {
        LIVEKIT_URL: cdk.SecretValue.unsafePlainText(`https://${domainConfig.livekitDomain}`),
        LIVEKIT_API_KEY: cdk.SecretValue.unsafePlainText(""),
        LIVEKIT_API_SECRET: cdk.SecretValue.unsafePlainText(""),
      },
    });

    // Stage 2: S3 Bucket for recordings
    const recordingsBucket = new s3.Bucket(this, "LivekitRecordingsBucket", {
      bucketName: "cloumeet-recordings",
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "DeleteOldRecordings",
          enabled: true,
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    // Create the Origin Access Identity
    const oai = new cloudfront.OriginAccessIdentity(this, "RecordingsOAI");

    // Stage 2: CloudFront Distribution for Recordings
    const recordingsDistribution = new cloudfront.Distribution(
      this,
      "RecordingsDistribution",
      {
        defaultBehavior: {
          // Pass the OAI to the S3Origin constructor
          origin: new origins.S3Origin(recordingsBucket, {
            originAccessIdentity: oai,
          }),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy:
            cloudfront.CachePolicy.CACHING_OPTIMIZED_FOR_UNCOMPRESSED_OBJECTS,
        },
        comment: "CloudFront distribution for LiveKit recordings",
      }
    );

    // Stage 2: IAM Role for EC2 instance
    const ec2Role = new iam.Role(this, "LivekitEc2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      description: "Role for LiveKit EC2 instance",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
    });

    // Add EC2 Instance Connect permissions
    ec2Role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ec2-instance-connect:SendSSHPublicKey"],
        resources: [`arn:aws:ec2:${this.region}:${this.account}:instance/*`],
        conditions: {
          StringEquals: {
            "ec2:osuser": "ec2-user",
          },
        },
      })
    );

    recordingsBucket.grantWrite(ec2Role);
    livekitSecret.grantRead(ec2Role);

    // Stage 3: Security Groups
    const redisSecurityGroup = new ec2.SecurityGroup(
      this,
      "RedisSecurityGroup",
      {
        vpc,
        description: "Security group for Redis cache",
        allowAllOutbound: false,
      }
    );

    const livekitServerSecurityGroup = new ec2.SecurityGroup(
      this,
      "LivekitServerSecurityGroup",
      {
        vpc,
        description: "Security group for LiveKit server",
        allowAllOutbound: true,
      }
    );

    const fargateSecurityGroup = new ec2.SecurityGroup(
      this,
      "FargateSecurityGroup",
      {
        vpc,
        description: "Security group for Fargate backend API",
        allowAllOutbound: true,
      }
    );

    // LiveKit server ports
    livekitServerSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "HTTPS/WSS"
    );
    livekitServerSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(7881),
      "LiveKit API"
    );
    livekitServerSecurityGroup.addIngressRule(
      fargateSecurityGroup,
      ec2.Port.tcp(443),
      "Fargate to LiveKit API"
    );
    livekitServerSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.udpRange(50000, 60000),
      "UDP media"
    );
    livekitServerSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcpRange(50000, 60000),
      "TCP media"
    );

    // TURN server ports
    livekitServerSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5349),
      "TURN TLS"
    );
    livekitServerSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.udp(3478),
      "TURN UDP"
    );

    // Redis access
    redisSecurityGroup.addIngressRule(
      livekitServerSecurityGroup,
      ec2.Port.tcp(6379),
      "Redis from EC2"
    );
    redisSecurityGroup.addIngressRule(
      fargateSecurityGroup,
      ec2.Port.tcp(6379),
      "Redis from Fargate"
    );

    // Allow Lambda to connect to Fargate on port 3001
    fargateSecurityGroup.addIngressRule(
      fargateSecurityGroup,
      ec2.Port.tcp(3001),
      "Lambda to Fargate API"
    );

    // Stage 3: ElastiCache Redis
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(
      this,
      "RedisSubnetGroup",
      {
        description: "Subnet group for Redis",
        subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),
      }
    );

    const redisCluster = new elasticache.CfnCacheCluster(
      this,
      "LivekitRedisCluster",
      {
        cacheNodeType: "cache.t3.micro",
        engine: "redis",
        numCacheNodes: 1,
        cacheSubnetGroupName: redisSubnetGroup.ref,
        vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
        port: 6379,
      }
    );

    // Stage 4: EC2 LiveKit Server with fully automated cloud-init setup
    const elasticIp = new ec2.CfnEIP(this, "LivekitServerEip", {
      domain: "vpc",
    });

    // This is the correct, automated UserData script for Amazon Linux 2023
    const userDataScript = `#!/bin/bash
set -e # Exit immediately if a command fails

# 1. Install Docker
sudo dnf update -y
sudo dnf install docker jq -y
sudo systemctl start docker
sudo systemctl enable docker

# 2. Install Docker Compose v2 Plugin (to /usr/libexec, the correct path)
sudo mkdir -p /usr/libexec/docker/cli-plugins/
sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o /usr/libexec/docker/cli-plugins/docker-compose
sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose

# 3. Create directories
sudo mkdir -p /opt/livekit/${domainConfig.livekitDomain}

# 4. Fetch the real configuration values from AWS
# The EC2 Role (ec2Role) already has permissions for this
SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id ${
      livekitSecret.secretArn
    } --region ${this.region} --query SecretString --output text)
# Use jq for robust parsing - all values from single secret
LIVEKIT_API_KEY=$(echo $SECRET_JSON | jq -r .LIVEKIT_API_KEY)
LIVEKIT_API_SECRET=$(echo $SECRET_JSON | jq -r .LIVEKIT_API_SECRET)
LIVEKIT_URL=$(echo $SECRET_JSON | jq -r .LIVEKIT_URL)

# (FIX 2: Use CDK-injected values for Redis, removing failed AWS CLI call)
REDIS_HOST="${redisCluster.attrRedisEndpointAddress}"
REDIS_PORT="${redisCluster.attrRedisEndpointPort}"
S3_BUCKET_NAME="${recordingsBucket.bucketName}"

# 5. Write the configuration files with the REAL values
sudo tee /opt/livekit/${
      domainConfig.livekitDomain
    }/livekit.yaml > /dev/null << EOL
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
redis:
  address: \${REDIS_HOST}:\${REDIS_PORT}
turn:
  enabled: true
  domain: ${domainConfig.livekitDomain.replace("livekit.", "livekit-turn.")}
  tls_port: 5349
  udp_port: 3478
  external_tls: true
keys:
  \${LIVEKIT_API_KEY}: \${LIVEKIT_API_SECRET}
EOL

sudo tee /opt/livekit/${
      domainConfig.livekitDomain
    }/egress.yaml > /dev/null << EOL
redis:
  address: \${REDIS_HOST}:\${REDIS_PORT}
api_key: \${LIVEKIT_API_KEY}
api_secret: \${LIVEKIT_API_SECRET}
ws_url: wss://${domainConfig.livekitDomain}
s3:
  access_key: ""
  secret: ""
  region: ${this.region}
  bucket: \${S3_BUCKET_NAME}
EOL

sudo tee /opt/livekit/${
      domainConfig.livekitDomain
    }/caddy.yaml > /dev/null << EOL
logging:
  logs:
    default:
      level: INFO
storage:
  "module": "file_system"
  "root": "/data"
apps:
  tls:
    certificates:
      automate:
        - ${domainConfig.livekitDomain}
        - ${domainConfig.livekitDomain.replace("livekit.", "livekit-turn.")}
  layer4:
    servers:
      main:
        listen: [":443"]
        routes:
          - match:
            - tls:
                sni:
                  - "${domainConfig.livekitDomain.replace(
                    "livekit.",
                    "livekit-turn."
                  )}"
            handle:
              - handler: tls
              - handler: proxy
                upstreams:
                  - dial: ["localhost:5349"]
          - match:
            - tls:
                sni:
                  - "${domainConfig.livekitDomain}"
            handle:
              - handler: tls
                connection_policies:
                  - alpn: ["http/1.1"]
              - handler: proxy
                upstreams:
                  - dial: ["localhost:7880"]
EOL

sudo tee /opt/livekit/${
      domainConfig.livekitDomain
    }/docker-compose.yaml > /dev/null << EOL
services:
  caddy:
    image: livekit/caddyl4
    command: run --config /etc/caddy.yaml --adapter yaml
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./caddy.yaml:/etc/caddy.yaml
      - ./caddy_data:/data
  livekit:
    image: livekit/livekit-server:latest
    command: --config /etc/livekit.yaml
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml
  egress:
    image: livekit/egress:latest
    restart: unless-stopped
    environment:
      - EGRESS_CONFIG_FILE=/etc/egress.yaml
    network_mode: "host"
    volumes:
      - ./egress.yaml:/etc/egress.yaml
    cap_add:
      - CAP_SYS_ADMIN
EOL

# 6. Start services
cd /opt/livekit/${domainConfig.livekitDomain}
sudo docker compose up -d
`;

    // Create a UserData object and add the script
    const userData = ec2.UserData.forLinux();
    userData.addCommands(userDataScript);

    // This is where you replace the old, flawed "livekitServer" definition
    const livekitServer = new ec2.Instance(this, "LivekitServer", {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: livekitServerSecurityGroup,
      role: ec2Role,
      userData, // <-- Use the new, corrected UserData script
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // Add the Retain policies to protect the manually-configured instance
    // (This is the instruction you gave me, which is a great safety net)
    (
      livekitServer.node.defaultChild as ec2.CfnInstance
    ).cfnOptions.deletionPolicy = cdk.CfnDeletionPolicy.RETAIN;
    (
      livekitServer.node.defaultChild as ec2.CfnInstance
    ).cfnOptions.updateReplacePolicy = cdk.CfnDeletionPolicy.RETAIN;

    new ec2.CfnEIPAssociation(this, "LivekitServerEipAssociation", {
      eip: elasticIp.ref,
      instanceId: livekitServer.instanceId,
    });

    // Stage 5: ECR Repository
    const ecrRepository = new ecr.Repository(this, "LivekitTokenServerRepo", {
      repositoryName: "livekit-token-server",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Stage 5: ECS Cluster and Service Discovery
    const cluster = new ecs.Cluster(this, "LivekitCluster", {
      vpc,
      clusterName: "livekit-cluster",
    });

    const namespace = new servicediscovery.PrivateDnsNamespace(
      this,
      "ServiceNamespace",
      {
        name: "livekit.local",
        vpc,
      }
    );

    const taskRole = new iam.Role(this, "FargateTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const executionRole = new iam.Role(this, "FargateExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    livekitSecret.grantRead(executionRole); // Execution role needs this for secrets injection
    recordingsBucket.grantReadWrite(taskRole); // Task role needs this for runtime S3 access

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TokenServerTaskDef",
      {
        memoryLimitMiB: 512,
        cpu: 256,
        taskRole,
        executionRole,
      }
    );

    const logGroup = new logs.LogGroup(this, "TokenServerLogGroup", {
      logGroupName: "/ecs/livekit-token-server",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    taskDefinition.addContainer("TokenServerContainer", {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository, "latest"),
      environment: {
        PORT: "3001",
        REDIS_URL: `redis://${redisCluster.attrRedisEndpointAddress}:6379`,
        S3_BUCKET: recordingsBucket.bucketName,
        AWS_REGION: this.region,
      },
      secrets: {
        LIVEKIT_API_KEY: ecs.Secret.fromSecretsManager(
          livekitSecret,
          "LIVEKIT_API_KEY"
        ),
        LIVEKIT_API_SECRET: ecs.Secret.fromSecretsManager(
          livekitSecret,
          "LIVEKIT_API_SECRET"
        ),
        LIVEKIT_URL: ecs.Secret.fromSecretsManager(
          livekitSecret,
          "LIVEKIT_URL"
        ),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "token-server",
        logGroup,
      }),
      portMappings: [{ containerPort: 3001 }],
    });

    const fargateService = new ecs.FargateService(this, "TokenServerService", {
      cluster,
      taskDefinition,
      desiredCount: 0,
      securityGroups: [fargateSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      capacityProviderStrategies: [
        {
          capacityProvider: "FARGATE_SPOT",
          weight: 1,
        },
      ],
    });

    // Create service discovery service
    const serviceDiscovery = namespace.createService("TokenServerService", {
      name: "api",
      dnsRecordType: servicediscovery.DnsRecordType.A,
    });

    // Associate service with discovery
    fargateService.associateCloudMapService({
      service: serviceDiscovery,
    });

    // Auto-scaling configuration
    const scalableTarget = new applicationautoscaling.ScalableTarget(
      this,
      "TokenServerScalableTarget",
      {
        serviceNamespace: applicationautoscaling.ServiceNamespace.ECS,
        resourceId: `service/${cluster.clusterName}/${fargateService.serviceName}`,
        scalableDimension: "ecs:service:DesiredCount",
        minCapacity: 0,
        maxCapacity: 5,
      }
    );

    scalableTarget.scaleToTrackMetric("TokenServerTargetTracking", {
      targetValue: 70,
      predefinedMetric:
        applicationautoscaling.PredefinedMetric
          .ECS_SERVICE_AVERAGE_CPU_UTILIZATION,
      scaleOutCooldown: cdk.Duration.minutes(2),
      scaleInCooldown: cdk.Duration.minutes(15),
    });

    // Stage 6: Lambda Proxy Function
    const proxyFunction = new lambda.Function(this, "FargateProxyFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(30),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [fargateSecurityGroup],
      code: lambda.Code.fromInline(`
        const https = require('https');
        const http = require('http');
        
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          // Get Fargate service endpoint from environment
          const fargateEndpoint = process.env.FARGATE_ENDPOINT;
          if (!fargateEndpoint) {
            return {
              statusCode: 500,
              headers: { 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ error: 'Fargate endpoint not configured' })
            };
          }
          
          try {
            // Proxy request to Fargate service
            const path = event.rawPath || event.path || '/';
            const queryString = event.rawQueryString || '';
            const fullPath = queryString ? \`\${path}?\${queryString}\` : path;
            
            const options = {
              hostname: fargateEndpoint,
              port: 3001,
              path: fullPath,
              method: event.httpMethod || event.requestContext?.http?.method || 'GET',
              headers: {
                ...event.headers,
                'Host': fargateEndpoint
              }
            };
            
            const response = await new Promise((resolve, reject) => {
              const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                  resolve({
                    statusCode: res.statusCode,
                    headers: {
                      'Access-Control-Allow-Origin': '*',
                      'Content-Type': res.headers['content-type'] || 'application/json'
                    },
                    body: data
                  });
                });
              });
              
              req.on('error', reject);
              
              if (event.body) {
                req.write(event.body);
              }
              
              req.end();
            });
            
            return response;
          } catch (error) {
            console.error('Proxy error:', error);
            return {
              statusCode: 500,
              headers: { 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ error: 'Proxy failed: ' + error.message })
            };
          }
        };
      `),
      environment: {
        FARGATE_ENDPOINT: "api.livekit.local",
      },
    });

    // Stage 6: SSL Certificate for API domain
    const apiCertificate = new certificatemanager.Certificate(
      this,
      "ApiCertificate",
      {
        domainName: domainConfig.apiDomain,
        validation: certificatemanager.CertificateValidation.fromDns(),
      }
    );

    // Stage 6: API Gateway with custom domain
    const httpApi = new HttpApi(this, "LivekitApi", {
      apiName: "livekit-api",
      description: "API Gateway for LiveKit token server",
    });

    const apiDomainName = new apigatewayv2.DomainName(this, "ApiDomain", {
      domainName: domainConfig.apiDomain,
      certificate: apiCertificate,
    });

    new apigatewayv2.ApiMapping(this, "ApiMapping", {
      api: httpApi,
      domainName: apiDomainName,
    });

    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [HttpMethod.ANY],
      integration: new HttpLambdaIntegration("ProxyIntegration", proxyFunction),
    });

    // Stage 7: Amplify App
    const amplifyApp = new amplify.App(this, "LivekitFrontendApp", {
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: "intellectif-llc",
        repository: "cloumeet",
        oauthToken: cdk.SecretValue.secretsManager("github-token", {
          jsonField: "github-token",
        }),
      }),
      platform: amplify.Platform.WEB_COMPUTE,
      environmentVariables: {
        NEXT_PUBLIC_LIVEKIT_URL: `wss://${domainConfig.livekitDomain}`,
        NEXT_PUBLIC_API_URL: `https://${domainConfig.apiDomain}`,
        NEXT_PUBLIC_CONN_DETAILS_ENDPOINT: `https://${domainConfig.apiDomain}/connection-details`,
        NEXT_PUBLIC_SHOW_SETTINGS_MENU: "true",
      },
      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        version: "1.0",
        applications: [
          {
            frontend: {
              phases: {
                preBuild: {
                  commands: [
                    "npm install -g pnpm",
                    "pnpm install --frozen-lockfile",
                  ],
                },
                build: {
                  commands: ["pnpm run build"],
                },
              },
              artifacts: {
                baseDirectory: ".next",
                files: ["**/*"],
              },
              cache: {
                paths: ["node_modules/**/*", ".next/cache/**/*"],
              },
            },
          },
        ],
      }),
    });

    const mainBranch = amplifyApp.addBranch("main", {
      autoBuild: true,
    });

    // Add custom domain
    const domain = amplifyApp.addDomain(domainConfig.frontendDomain, {
      subDomains: [
        {
          branch: mainBranch,
          prefix: "",
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, "VpcId", {
      value: vpc.vpcId,
      description: "VPC ID",
    });

    new cdk.CfnOutput(this, "LivekitServerPublicIp", {
      value: elasticIp.ref,
      description:
        "LiveKit server public IP - Point livekit.intellectif.com to this IP",
    });

    new cdk.CfnOutput(this, "ApiGatewayUrl", {
      value: `https://${domainConfig.apiDomain}`,
      description: "API Gateway custom domain URL",
    });

    new cdk.CfnOutput(this, "ApiGatewayDefaultUrl", {
      value: httpApi.apiEndpoint,
      description: "API Gateway default URL (for testing)",
    });

    new cdk.CfnOutput(this, "AmplifyAppUrl", {
      value: `https://${mainBranch.branchName}.${amplifyApp.defaultDomain}`,
      description:
        "Amplify app URL - Point cloumeet.intellectif.com to this URL",
    });

    new cdk.CfnOutput(this, "ECRRepositoryUri", {
      value: ecrRepository.repositoryUri,
      description: "ECR repository URI for backend API",
    });

    new cdk.CfnOutput(this, "RecordingsBucketName", {
      value: recordingsBucket.bucketName,
      description: "S3 bucket for recordings",
    });

    new cdk.CfnOutput(this, "LivekitSecretArn", {
      value: livekitSecret.secretArn,
      description: "LiveKit credentials secret ARN",
    });

    new cdk.CfnOutput(this, "RecordingsCloudFrontUrl", {
      value: `https://${recordingsDistribution.distributionDomainName}`,
      description: "CloudFront URL for fast recordings delivery",
    });

    new cdk.CfnOutput(this, "SavingsPlanRecommendation", {
      value:
        "Consider purchasing a 1-year Compute Savings Plan for t3.medium instance (~30% savings)",
      description: "Cost optimization recommendation",
    });
  }
}
