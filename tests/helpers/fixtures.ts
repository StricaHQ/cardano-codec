import fs from "fs";
import path from "path";
import { CborNode } from "@stricahq/cbors";
import { byron, alonzo, babbage, conway } from "../../src/index";
import { decodeCbor } from "./build";

const FIXTURES = path.join(process.cwd(), "tests", "fixtures");

export type ExpectedOutput = {
  amount: string;
  tokens: Array<string>;
  plutusDataHash: string | null;
  hasInlineDatum: boolean;
  scriptRef: { type: number; hash: string } | null;
};

export type BlockFixture = {
  name: string;
  note: string;
  file: string;
  era: string;
  parser: string;
  epoch: number;
  expected: {
    hash: string;
    blockHeight: number;
    slot: number;
    txCount: number;
    txHashes: Array<string>;
    metadataTxIndexes: Array<number>;
    epoch?: number;
    operationalCert?: { hotVKey: string; sequenceNumber: number };
    protocolVersion?: [number, number];
  };
};

export type TxFixture = {
  name: string;
  note: string;
  file: string;
  era: string;
  parser: string;
  epoch: number;
  expected: {
    hash: string;
    fee: string;
    ttl: number | null;
    validityIntervalStart: number | null;
    inputs: Array<string>;
    outputs: Array<ExpectedOutput>;
    mint: Array<string>;
    withdrawalAmounts: Array<string>;
    certificateCount: number;
    referenceInputCount: number;
    collateralCount: number;
    collateralOutputAmount: string | null;
    voteCount: number;
    proposalCount: number;
    hasMetadata: boolean;
  };
};

/** A real block nested too deep for the goldens. */
export type DeepFixture = Omit<BlockFixture, "expected"> & {
  expected: {
    hash: string;
    blockHeight: number;
    slot: number;
    txHashes: Array<string>;
  };
};

export type SyntheticFixture = {
  name: string;
  note: string;
  file: string;
  era: string;
  parser: string;
  kind: "tx" | "block" | "ebBlock";
};

type Source = Pick<TxFixture, "file" | "parser">;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Parsed = any;

const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES, "manifest.json"), "utf-8"));

export const blockFixtures: Array<BlockFixture> = manifest.blocks;
export const txFixtures: Array<TxFixture> = manifest.transactions;
export const deepFixtures: Array<DeepFixture> = manifest.deep;
export const syntheticFixtures: Array<SyntheticFixture> = manifest.synthetic;

const parsers: Record<string, Parsed> = { byron, alonzo, babbage, conway };

/** A plain Uint8Array, as browsers have: a Buffer would mask a Buffer-only call in a parser. */
export const loadCbor = (file: string): Uint8Array =>
  Uint8Array.from(Buffer.from(fs.readFileSync(path.join(FIXTURES, file), "utf-8").trim(), "hex"));

/** Byron keeps header fields flat; Shelley onwards nests them under `body`. */
export const headerOf = (block: Parsed): Parsed => block.header.body ?? block.header;

export const parseBlockNode = (fx: Source, block: CborNode): Parsed =>
  parsers[fx.parser].parseBlock(block);

export const parseBlockFixture = (fx: Source): Parsed =>
  parseBlockNode(fx, decodeCbor(loadCbor(fx.file)));

export const parseEbBlockFixture = (fx: Source): Parsed =>
  byron.parseEbBlock(decodeCbor(loadCbor(fx.file)));

/** A standalone transaction is `[body, witnessSet, isValid?, auxiliaryData?]`. */
const decodeTx = (fx: Source): CborNode => decodeCbor(loadCbor(fx.file));

export const parseTxFixture = (fx: Source): Parsed =>
  parsers[fx.parser].parseTransaction(decodeTx(fx).at(0)!);

export const parseTxWitnessFixture = (fx: Source): Parsed =>
  parsers[fx.parser].parseWitnessMap(decodeTx(fx).at(1)!);

/** Auxiliary data is the last item, `null` when absent; Shelley to Mary have no isValid flag. */
export const parseTxAuxiliaryDataFixture = (fx: Source): Parsed => {
  const tx = decodeTx(fx).items!;
  const auxiliaryData = tx[tx.length - 1];
  return auxiliaryData.kind === "null"
    ? null
    : parsers[fx.parser].parseAuxiliaryData(auxiliaryData);
};

/** Outpoints as `txId#index`, sorted, so unordered chain data can be compared. */
export const inputKeys = (inputs: Array<Parsed>): Array<string> =>
  inputs.map((i) => `${i.txId}#${i.index}`).sort();

export const tokenKeys = (tokens: Array<Parsed> | undefined): Array<string> =>
  (tokens ?? []).map((t) => `${t.policyId}.${t.assetName}=${t.amount}`).sort();
