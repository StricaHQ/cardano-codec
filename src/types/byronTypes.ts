export type EbbHeader = {
  hash: string;
  blockHeight: number;
  epoch: number;
  prevHash: string;
  bodySize: number;
};

export type Header = {
  hash: string;
  blockHeight: number;
  slot: number;
  epoch: number;
  prevHash: string;
  bodySize: number;
};

export type TransactionInput = {
  txId: string;
  index: number;
};

export type TransactionOutput = {
  address: string;
  amount: string;
};

export type Transaction = {
  hash: string;
  inputs: Array<TransactionInput>;
  outputs: Array<TransactionOutput>;
};

export type ByronBlock = {
  header: Header;
  transactions: Array<Transaction>;
};

export type ByronEbBlock = {
  header: EbbHeader;
};
