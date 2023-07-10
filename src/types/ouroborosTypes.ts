export enum Protocol {
  NODE_TO_CLIENT_CHAIN_SYNC = "NODE_TO_CLIENT_CHAIN_SYNC",
  LOCAL_TX_MONITOR = "LOCAL_TX_MONITOR",
}

export type Tip = {
  slot: number;
  hash: string;
};

export type Point = {
  slot?: number;
  hash?: string;
};

export type IntersectFound = {
  point: Point;
  tip: Tip;
};

export type IntersectNotFound = {
  tip: Tip;
};

export type RollForward = {
  block: Buffer;
  tip: Tip;
};

export type RollBackward = {
  point: Point;
  tip: Tip;
};

export type NodeToClientChainSyncResponse = {
  rollBackward?: RollBackward;
  rollForward?: RollForward;
  intersectFound?: IntersectFound;
  intersectNotFound?: IntersectNotFound;
  await?: true;
};

export type LocalTxMonitorResponse = {
  nextTx?: Buffer | null;
  acquired?: number;
  await?: true;
};

export declare type LocalTransactionSubmissionResponse = {
  success?: boolean;
  rejectionMessage?: any;
};
