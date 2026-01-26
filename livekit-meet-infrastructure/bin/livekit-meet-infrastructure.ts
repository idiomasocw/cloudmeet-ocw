#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LivekitMeetInfrastructureStack } from '../lib/livekit-meet-infrastructure-stack';

const app = new cdk.App();

// Configuration for Intellectif deployment
const region = 'us-east-1'; // North Virginia as specified
const account = app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;

// Domain configuration
const domainConfig = {
  frontendDomain: 'cloumeet.intellectif.com',
  livekitDomain: 'livekit.intellectif.com', 
  apiDomain: 'api.intellectif.com',
  githubRepo: 'https://github.com/intellectif-llc/cloumeet.git'
};

new LivekitMeetInfrastructureStack(app, 'LivekitMeetInfrastructureStack', {
  env: {
    account: account,
    region: region,
  },
  description: 'LiveKit videoconferencing system infrastructure on AWS',
  domainConfig,
});