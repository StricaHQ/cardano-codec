import fs from "fs";
import path from "path";
import * as cbors from "@stricahq/cbors";
import { byron, alonzo, babbage, conway } from "../../src/index";

const FIXTURES = path.join(process.cwd(), "tests", "fixtures");

export type ExpectedOutput = {
  amount: string;
  tokens: Array<string>;
  plutusDataHash: string | null;
  hasInlineDatum: boolean;
  scriptRef: { type: string; hash: string } | null;
};

export type BlockFixture = {
  name: string;
  note: string;
  file: string;
  network: string;
  era: string;
  parser: string;
  epoch: number;
  source: string;
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
  network: string;
  era: string;
  parser: string;
  epoch: number;
  source: string;
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

/* eslint-disable @typescript-eslint/no-explicit-any */
type Parsed = any;

const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES, "manifest.json"), "utf-8"));

export const blockFixtures: Array<BlockFixture> = manifest.blocks;
export const txFixtures: Array<TxFixture> = manifest.transactions;

const parsers: Record<string, Parsed> = { byron, alonzo, babbage, conway };

export const loadCbor = (file: string): Buffer =>
  Buffer.from(fs.readFileSync(path.join(FIXTURES, file), "utf-8").trim(), "hex");

export const decode = (buf: Buffer): Parsed => cbors.Decoder.decode(buf).value;

/** Byron keeps header fields flat; Shelley onwards nests them under `body`. */
export const headerOf = (block: Parsed): Parsed => block.header.body ?? block.header;

export const parseBlockFixture = (fx: BlockFixture): Parsed => {
  const buf = loadCbor(fx.file);
  return parsers[fx.parser].parseBlock(decode(buf), buf);
};

/** A standalone transaction is `[body, witnessSet, isValid?, auxiliaryData?]`. */
export const parseTxFixture = (fx: TxFixture): Parsed => {
  const buf = loadCbor(fx.file);
  return parsers[fx.parser].parseTransaction(decode(buf)[0], buf);
};

export const parseTxWitnessFixture = (fx: TxFixture): Parsed => {
  const buf = loadCbor(fx.file);
  return parsers[fx.parser].parseWitnessMap(decode(buf)[1], buf);
};

/** Outpoints as `txId#index`, sorted, so unordered chain data can be compared. */
export const inputKeys = (inputs: Array<Parsed>): Array<string> =>
  inputs.map((i) => `${i.txId}#${i.index}`).sort();

export const tokenKeys = (tokens: Array<Parsed> | undefined): Array<string> =>
  (tokens ?? []).map((t) => `${t.policyId}.${t.assetName}=${t.amount}`).sort();
