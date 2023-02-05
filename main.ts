// Get the default configuration file under config/ dir. This is a node module: https://www.npmjs.com/package/config
// Additional configuration can be added for different env for development, staging and production
// To use additional configuration you need to set the node env variable NODE_ENV eg export NODE_ENV=development
import { get as getConfig } from 'config';

// Node module https://www.npmjs.com/package/construct
// Construct provides a way to create a new instance of an object 
// Makes the code cleaner and less cluttered
import { Construct } from 'constructs';

// Example of cluster constructs
import { Cluster } from './constructs/Cluster';
import { App, S3Backend, TerraformOutput, TerraformStack } from 'cdktf';

// Typescript modules used to define and setup aws resources for EKS env
import { Subnet } from './.gen/providers/aws/vpc/subnet';
import { AwsProvider } from './.gen/providers/aws'
import { EksNodeGroupConfig } from './.gen/providers/aws/eks/eks-node-group';
import { idTokenList } from './idTokens';

// Get the configuration to setup AWS resources.
// This information is stored in the default.json. However can be overridden by adding additional
// configuration for different environments
const region = getConfig<string>('aws.region');
const backendConfig = getConfig<{ bucket: string, key: string, region: string, encrypt: boolean }>('cdktfBackend.s3');
const vpcId = getConfig<string>('aws.vpcId');
const vpcCidrBlock = getConfig<string>('aws.vpcCidrBlock');
const availabilityZones = getConfig<string[]>('aws.availabilityZones');
const publicSubnetCidrBlocks = getConfig<string[]>('aws.publicSubnetCidrBlocks');
const eksClusterName = getConfig<string>('eks.clusterName');
const eksClusterVersion = getConfig<string>('eks.clusterVersion');
const eksNodeGroups = getConfig<{ [key: string]: Partial<EksNodeGroupConfig> }>('eks.nodeGroups');

class AwsCloud extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, 'aws' , { region });

    this.initBackEnd();
    this.defineResources();
  }

  // Initialzing the s3 bucket where the terraform state files are stored
  initBackEnd() {
    console.log('bucket config', backendConfig)
    new S3Backend(this, backendConfig);
  }

  defineResources() {

    const publicSubnets = this.createSubnets(publicSubnetCidrBlocks, 'public');
    // private subnets route outgoing traffic via Nat's

    new Cluster(this, 'demo-cluster', {
      vpcId,
      vpcCidrBlock,
      publicSubnets: idTokenList(publicSubnets), // Get the subnetID to pass to cluster
      eksClusterName,
      eksClusterVersion,
      eksNodeGroups
    });


  }

  createSubnets(cidrBlocks: string[], prefix: string): Subnet[] {
    // for each cidrblock create subnet
    return cidrBlocks.map((cidrBlock, subnetNumber) => {
      const subnet = new Subnet(this, `demo-${prefix}-${subnetNumber + 1}`, {
        vpcId,
        cidrBlock,
        availabilityZone: availabilityZones[subnetNumber],
      });
      subnet.mapPublicIpOnLaunch = true;
      
      // Grab the output and return subnet array
      new TerraformOutput(this, `${prefix}Subnet${subnetNumber + 1}`, { value: subnet.id });
      return subnet;
    });
  }
}

const app = new App();
new AwsCloud(app, 'eks-aws-1');
app.synth();