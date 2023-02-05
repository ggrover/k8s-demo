import { Construct } from 'constructs';
import { EksNodeGroupConfig } from '../.gen/providers/aws/eks/eks-node-group';
import { IamRole, IamRolePolicyAttachment } from '../.gen/providers/aws/iam';
interface Props {
    vpcId: string;
    vpcCidrBlock: string;
    publicSubnets: string[];
    eksClusterName: string;
    eksClusterVersion: string;
    eksNodeGroups: {
        [key: string]: Partial<EksNodeGroupConfig>;
    };
}
export declare class Cluster extends Construct {
    vpcId: string;
    vpcCidrBlock: string;
    publicSubnets: string[];
    eksClusterName: string;
    eksClusterVersion: string;
    eksNodeGroups: {
        [key: string]: Partial<EksNodeGroupConfig>;
    };
    constructor(scope: Construct, name: string, props: Props);
    defineEksResources(): void;
    eksClusterPolicy(role: IamRole): IamRolePolicyAttachment;
    ec2ContainerRegistryPolicy(role: IamRole): IamRolePolicyAttachment;
    eksWorkerNodePolicy(role: IamRole): IamRolePolicyAttachment;
    eksCniPolicy(role: IamRole): IamRolePolicyAttachment;
    ebsCSIDriverPolicy(role: IamRole): IamRolePolicyAttachment;
}
export {};
