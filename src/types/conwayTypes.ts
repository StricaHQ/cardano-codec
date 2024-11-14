import { CertificateType } from "../constants";

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

export type HeaderBody = {
  hash: string;
  blockHeight: number;
  slot: number;
  prevHash: string | null;
  issuerVKey: string;
  vrfVKey: string;
  vrfResult: [string, string];
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

export enum ScriptType {
  NATIVE_SCRIPT = "NATIVE_SCRIPT",
  PLUTUS_V1 = "PLUTUS_V1",
  PLUTUS_V2 = "PLUTUS_V2",
  PLUTUS_V3 = "PLUTUS_V3",
}

export type ScriptRef = {
  type: ScriptType;
  script: NativeScript | string;
  hash: string;
};

export type TransactionOutput = {
  address: string;
  amount: string;
  tokens?: Array<Token>;
  plutusDataHash?: string;
  plutusData?: string;
  scriptRef?: ScriptRef;
};

export type Anchor = {
  url: string;
  hash: string;
};

export enum HashType {
  ADDRESS = 0,
  SCRIPT = 1,
}

export type Credential = {
  key: string;
  type: HashType;
};

export type StakeCredential = Credential;

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

export type Withdrawal = {
  rewardAccount: string;
  amount: string;
};

export type CostMdls = {
  plutusV1: Array<number> | undefined;
  plutusV2: Array<number> | undefined;
  plutusV3: Array<number> | undefined;
};

export type ProtocolParamUpdate = {
    minFeeA?: string;
    minFeeB?: string;
    maxBlockBodySize?: number;
    maxTransactionSize?: number;
    maxBlockHeaderSize?: number;
    stakeKeyDeposit?: string;
    poolDeposit?: string;
    poolRetireMaxEpoch?: number;
    n?: number;
    pledgeInfluence?: number;
    expansionRate?: number;
    treasuryGrowthRate?: number;
    minPoolCost?: string;
    adaPerUtxoByte?: string;
    costMdls?: CostMdls;
    exUnitPrices?: {
      mem: [number, number];
      steps: [number, number];
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
    poolVotingThreshold?: {
      motionNoConfidence: number;
      committeeNormal: number;
      committeeNoConfidence: number;
      hfInitiation: number;
      securityParamVoting: number;
    };
    dRepVotingThreshold?: {
      motionNoConfidence: number;
      committeeNormal: number;
      committeeNoConfidence: number;
      updateConstitution: number;
      hfInitiation: number;
      networkParamVoting: number;
      economicParamVoting: number;
      technicalParamVoting: number;
      govParamVoting: number;
      treasuryWithdrawal: number;
    };
    minCommitteeSize?: number;
    committeeTermLimit?: number;
    govActionValidity?: number;
    govActionDeposit?: number;
    dRepDeposit?: number;
    dRepInactivity?: number;
    refScriptCostByte?: number;
};

export type MetaDatum = Map<MetaDatum, MetaDatum> | Array<MetaDatum> | number | Buffer | string;

export type Metadata = {
  label: number;
  data: MetaDatum;
};

export type AuxiliaryData = {
  metadata?: Array<Metadata>;
  nativeScripts?: Array<NativeScript>;
  plutusScripts?: Array<string>;
  plutusScriptsV2?: Array<string>;
  plutusScriptsV3?: Array<string>;
};

export enum RedeemerTag {
  SPEND = 0,
  MINT = 1,
  CERT = 2,
  REWARD = 3,
  VOTE = 4,
  PROPOSAL = 5,
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
  nativeScripts?: Record<string, NativeScript>;
  bootstrapWitness?: Record<string, BootstrapWitness>;
  plutusScripts?: Record<string, string>;
  plutusData?: Record<string, string>;
  redeemers?: Array<Redeemer>;
  plutusScriptsV2?: Record<string, string>;
  plutusScriptsV3?: Record<string, string>;
};

export type TransactionCertificate =
  | StakeKeyRegistrationCertificate
  | StakeKeyDeRegistrationCertificate
  | StakeDelegationCertificate
  | PoolRegistrationCertificate
  | PoolDeRegistrationCertificate

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
  auxiliaryDataHash?: string;
  validityIntervalStart?: number;
  mint?: Array<Token>;
  scriptDataHash?: string;
  collaterals?: Array<CollateralInput>;
  requiredSigners?: Array<string>;
  networkId?: number;
  collateralOutput?: TransactionOutput;
  totalCollateral?: string;
  referenceInputs?: Array<TransactionInput>;
  treasuryAmount?: string;
  donation?: string;
};

export type InvalidTransaction = number;

export type ConwayBlock = {
  header: Header;
  transactions: Array<Transaction>;
  witnesses: Array<Witnesses>;
  auxiliaryDataMap: Map<number, AuxiliaryData>;
  invalidTransactions: Array<InvalidTransaction>;
};
