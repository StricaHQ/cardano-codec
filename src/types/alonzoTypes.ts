import { CertificateType } from "../constants";

export type HeaderBody = {
  hash: string;
  blockHeight: number;
  slot: number;
  prevHash: string | null;
  issuerVKey: string;
  vrfVKey: string;
  nonceVrf: {
    natural: string;
    cert: string;
  };
  leaderVrf: {
    natural: string;
    cert: string;
  };
  bodySize: number;
  blockBodyHash: string;
  operationalCert: {
    hotVKey: string;
    sequenceNumber: number;
    kesPeriod: number;
    sigma: string;
  };
  protocolVersion: [number, number];
};

export type Header = {
  kesSignature: string;
  body: HeaderBody;
};

export type TransactionInput = {
  txId: string;
  index: number;
};

export type Token = {
  policyId: string;
  assetName: string;
  amount: string;
};

export type TransactionOutput = {
  address: string;
  amount: string;
  tokens?: Array<Token>;
  plutusDataHash?: string;
};

export enum HashType {
  ADDRESS = "ADDRESS",
  SCRIPT = "SCRIPT",
}

export type StakeCredential = {
  key: string;
  type: HashType;
};

export type StakeKeyRegistrationCertificate = {
  type: CertificateType.STAKE_KEY_REG;
  cert: {
    stakeCredential: StakeCredential;
  };
};

export type StakeKeyDeRegistrationCertificate = {
  type: CertificateType.STAKE_KEY_DE_REG;
  cert: {
    stakeCredential: StakeCredential;
  };
};

export type StakeDelegationCertificate = {
  type: CertificateType.STAKE_DELEGATION;
  cert: {
    stakeCredential: StakeCredential;
    poolKeyHash: string;
  };
};

export type Relay =
  | {
      port: number | null;
      ipv4: string | null;
      ipv6: string | null;
    }
  | {
      port: number | null;
      dnsName: string;
    }
  | {
      srvName: string;
    };

export type PoolRegistrationCertificate = {
  type: CertificateType.POOL_REG;
  cert: {
    operator: string;
    vrfKeyHash: string;
    pledge: string;
    cost: string;
    margin: [number, number];
    rewardAccount: string;
    poolOwners: Array<string>;
    relays: Array<Relay>;
    poolMetadata: {
      url: string;
      metadataHash: string;
    } | null;
  };
};

export type PoolDeRegistrationCertificate = {
  type: CertificateType.POOL_DE_REG;
  cert: {
    poolKeyHash: string;
    epoch: number;
  };
};

export type GenesisDelegationCertificate = {
  type: CertificateType.GENESIS_DELEGATION;
  cert: {
    genesisHash: string;
    genesisDelegateHash: string;
    vrfKeyHash: string;
  };
};

export type InstantaneousReward = {
  amount: string;
  stakeCredential: StakeCredential;
};

export type InstantaneousRewardCertificate = {
  type: CertificateType.INSTANT_REWARD;
  cert: {
    pot: 0 | 1;
    rewards?: Array<InstantaneousReward>;
    amount?: string;
  };
};

export type Withdrawal = {
  rewardAccount: string;
  amount: string;
};

export type CostMdls = {
  language: number;
  costModel: Array<number>;
};

export type Proposal = {
  genesisHash: string;
  parameter: {
    minFeeA?: string;
    minFeeB?: string;
    maxBlockBodySize?: number;
    maxTransactionSize?: number;
    maxBlockHeaderSize?: number;
    keyDeposit?: string;
    poolDeposit?: string;
    maxEpoch?: number;
    n?: number;
    pledgeInfluence?: number;
    expansionRate?: number;
    treasuryGrowthRate?: number;
    d?: number;
    entropy?: [string, string];
    protocolVersion?: [number, number];
    minPoolCost?: string;
    adaPerUtxoByte?: string;
    costMdls?: Array<CostMdls>;
    exUnitPrices?: {
      mem: [string, string];
      step: [string, string];
    };
    maxTxExUnits?: {
      mem: number;
      steps: number;
    };
    maxBlockExUnits?: {
      mem: number;
      steps: number;
    };
    maxValueSize?: string;
    collateralPercent?: number;
    maxCollateralInputs?: number;
  };
};

export type MetaDatum = Map<MetaDatum, MetaDatum> | Array<MetaDatum> | number | Buffer | string;

export type Metadata = {
  label: number;
  data: MetaDatum;
};

export type NativeScript =
  | {
      pubKeyHash: string;
    }
  | { all: Array<NativeScript> }
  | {
      any: Array<NativeScript>;
    }
  | {
      n: string;
      k: Array<NativeScript>;
    }
  | {
      invalidBefore: string;
    }
  | {
      invalidAfter: string;
    };

export type AuxiliaryData = {
  metadata?: Array<Metadata>;
  nativeScripts?: Array<NativeScript>;
  plutusScripts?: Array<string>;
};

export enum RedeemerTag {
  SPEND = "SPEND",
  MINT = "MINT",
  CERT = "CERT",
  REWARD = "REWARD",
}

export type Redeemer = {
  index: number;
  tag: RedeemerTag;
  plutusData: string;
  exUnits: {
    mem: number;
    steps: number;
  };
};

export type VKeyWitness = {
  vKey: string;
  signature: string;
};

export type BootstrapWitness = {
  publicKey: string;
  signature: string;
  chainCode: string;
  attributes: string;
};

export type Witnesses = {
  vKeyWitnesses?: Record<string, VKeyWitness>;
  bootstrapWitness?: Record<string, BootstrapWitness>;
  plutusScripts?: Record<string, string>;
  nativeScripts?: Record<string, NativeScript>;
  plutusData?: Record<string, string>;
  redeemers?: Array<Redeemer>;
};

export type TransactionCertificate =
  | StakeKeyRegistrationCertificate
  | StakeKeyDeRegistrationCertificate
  | StakeDelegationCertificate
  | PoolRegistrationCertificate
  | PoolDeRegistrationCertificate
  | GenesisDelegationCertificate
  | InstantaneousRewardCertificate;

export type ProtocolUpdate = {
  proposals: Array<Proposal>;
  epoch: number;
};

export type CollateralInput = {
  txId: string;
  index: number;
};

export type Transaction = {
  hash: string;
  inputs: Array<TransactionInput>;
  outputs: Array<TransactionOutput>;
  fee: string;
  ttl?: number;
  certificates?: Array<TransactionCertificate>;
  withdrawals?: Array<Withdrawal>;
  update?: ProtocolUpdate;
  auxiliaryDataHash?: string;
  validityIntervalStart?: number;
  mint?: Array<Token>;
  scriptDataHash?: string;
  collaterals?: Array<CollateralInput>;
  requiredSigners?: Array<string>;
  networkId?: number;
};

export type InvalidTransaction = number;

export type AlonzoBlock = {
  header: Header;
  transactions: Array<Transaction>;
  witnesses: Array<Witnesses>;
  auxiliaryDataMap: Map<number, AuxiliaryData>;
  invalidTransactions: Array<InvalidTransaction>;
};
