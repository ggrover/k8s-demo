import { Construct } from 'constructs';
import { EksNodeGroupConfig, EksNodeGroup } from '../.gen/providers/aws/eks/eks-node-group';
import { IamRole, IamRolePolicyAttachment } from '../.gen/providers/aws/iam';
import { EksCluster } from '../.gen/providers/aws/eks';
import { idToken } from '../idTokens';


// Interface describes the shape of an object 
// They can be used to provide information about
// object property names and the datatypes their values can hold 
interface Props {
  vpcId: string
  vpcCidrBlock: string
  publicSubnets: string[]
  eksClusterName: string
  eksClusterVersion: string
  eksNodeGroups: { [key: string]: Partial<EksNodeGroupConfig> }
}

export class Cluster extends Construct {
  // Assigning values to be used within the class
  vpcId: string;
  vpcCidrBlock: string;
  publicSubnets: string[];
  eksClusterName: string;
  eksClusterVersion: string;
  eksNodeGroups: { [key: string]: Partial<EksNodeGroupConfig> };

  constructor(scope: Construct, name: string, props: Props) {
    super(scope, name);
    // assigning props parameter that been called by main.ts
    this.vpcId = props.vpcId;
    this.vpcCidrBlock = props.vpcCidrBlock;
    this.publicSubnets = props.publicSubnets;
    this.eksClusterName = props.eksClusterName;
    this.eksClusterVersion = props.eksClusterVersion;
    this.eksNodeGroups = props.eksNodeGroups;

    this.defineEksResources();
  }

  defineEksResources() {

    // Creating the Amazon EKS cluster role
    // https://docs.aws.amazon.com/eks/latest/userguide/service_IAM_role.html#create-service-role
    const clusterServiceRole = new IamRole(this, 'eks-cluster-role', {
      name: 'scbEksClusterService',
      assumeRolePolicy: JSON.stringify({
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Principal": {
              "Service": "eks.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
          }
        ]
      }),
    });

    
    // https://docs.aws.amazon.com/eks/latest/userguide/create-node-role.html
    // The Amazon EKS node kubelet daemon makes calls to AWS APIs on your behalf. 
    // Nodes receive permissions for these API calls through an IAM instance profile and associated policies.
    // Before you can launch nodes and register them into a cluster, 
    // you must create an IAM role for those nodes to use when they are launched. 
    // This requirement applies to nodes launched with the Amazon EKS optimized AMI provided by Amazon, 
    // or with any other node AMIs that you intend to use
    // https://www.terraform.io/docs/providers/aws/r/iam_role
    const eksNodeRole = new IamRole(this, 'eks-nodes-role', {
      name: 'EksNodes',
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: "ec2.amazonaws.com"
            },
            Action: "sts:AssumeRole"
          }
        ]
      }),
    });

    const clusterPolicy = this.eksClusterPolicy(clusterServiceRole);

    // Create cluster
    // https://www.terraform.io/docs/providers/aws/r/eks_cluster aws_eks_cluster
    const cluster = new EksCluster(this, 'k8s-cluster', {
      version: this.eksClusterVersion,
      name: this.eksClusterName,
      roleArn: clusterServiceRole.arn,
      vpcConfig: {
        endpointPublicAccess: true,
        endpointPrivateAccess: true,
        subnetIds: [...this.publicSubnets ],
      },
      enabledClusterLogTypes: ['api', 'audit', 'authenticator'],
      dependsOn: [ clusterServiceRole, clusterPolicy],
    });

    
    const eksWorkerNodePolicy = this.eksWorkerNodePolicy(eksNodeRole)
    const ec2ContainerRegistryPolicy = this.ec2ContainerRegistryPolicy(eksNodeRole)
    const eksCniPolicy = this.eksCniPolicy(eksNodeRole)
    // need EBS volume to store secrets
    const ebsCSIDriverPolicy = this.ebsCSIDriverPolicy(eksNodeRole)

    new EksNodeGroup(this, 'k8s-node-group', {
      instanceTypes: [ 't2.medium' ],
      scalingConfig: {
        minSize: 1,
        maxSize: 1,
        desiredSize: 1,
      },
      nodeGroupName: 'k8s-node-group',
      amiType: 'AL2_x86_64',
      subnetIds: this.publicSubnets,
      nodeRoleArn: eksNodeRole.arn,
      clusterName: this.eksClusterName,
      dependsOn: [ cluster, eksNodeRole, eksWorkerNodePolicy, ec2ContainerRegistryPolicy, eksCniPolicy, ebsCSIDriverPolicy ]
    });
  }

  // Attach policy to cluster
  // https://www.terraform.io/docs/providers/aws/r/iam_role_policy_attachment
  eksClusterPolicy(role: IamRole) {
    return new IamRolePolicyAttachment(this, 'eks-cluster-policy', {
      policyArn: 'arn:aws:iam::aws:policy/AmazonEKSClusterPolicy',
      role: role.name
    });
  }

  // Need to have Amazon EKS Managed policy set to add node to cluster
  // arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
   ec2ContainerRegistryPolicy(role: IamRole) {
    return new IamRolePolicyAttachment(this, 'ec2-container-registry-policy', {
      policyArn: 'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly',
      role: idToken(role)
    });
  }

  // Need to have Amazon EKS Managed policy set to add node to cluster
  // [arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
  eksWorkerNodePolicy(role: IamRole) {
    return new IamRolePolicyAttachment(this, 'eks-node-policy', {
      policyArn: 'arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy',
      role: idToken(role)
    });
  }

  eksCniPolicy(role: IamRole) {
    return new IamRolePolicyAttachment(this, 'eks-cni-policy', {
      policyArn: 'arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy',
      role: idToken(role)
    });
  }

  ebsCSIDriverPolicy(role: IamRole) {
    return new IamRolePolicyAttachment(this, 'ebs-csi-driver-policy', {
      policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy',
      role: idToken(role)
    });
  }
}