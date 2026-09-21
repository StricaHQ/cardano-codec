import { CborNode } from "@stricahq/cbors";
import {
  NativeScript,
  Redeemer,
  RedeemerTag,
  VKeyWitness,
  Witnesses,
  BootstrapWitness,
} from "../../types/conwayTypes";
import { bytes, encoded, entries, hex, isNil, items, num } from "../../utils/node";
import * as utils from "../../utils/utils";
import { parseNativeScript } from "../common";

// Conway allows tag 258 around every list here except the redeemers; items() looks through it.

const parseRedeemerTag = (tag: CborNode): RedeemerTag => {
  switch (num(tag)) {
    case 0:
      return RedeemerTag.SPEND;
    case 1:
      return RedeemerTag.MINT;
    case 2:
      return RedeemerTag.CERT;
    case 3:
      return RedeemerTag.REWARD;
    case 4:
      return RedeemerTag.VOTE;
    case 5:
      return RedeemerTag.PROPOSAL;
    default:
      throw new Error("unknown redeemer tag");
  }
};

const parseRedeemer = (
  tag: CborNode,
  index: CborNode,
  data: CborNode,
  exUnits: CborNode
): Redeemer => {
  const [mem, steps] = items(exUnits);
  return {
    index: num(index),
    tag: parseRedeemerTag(tag),
    plutusData: utils.toHex(encoded(data)),
    exUnits: {
      mem: num(mem),
      steps: num(steps),
    },
  };
};

export const parseWitnessMap = (witnessesData: CborNode) => {
  const witnesses: Witnesses = {};

  const vKeyWitnesses = witnessesData.at(0);
  const nativeScripts = witnessesData.at(1);
  const bootstrapWitnesses = witnessesData.at(2);
  const plutusScripts = witnessesData.at(3);
  const plutusData = witnessesData.at(4);
  const redeemers = witnessesData.at(5);
  const plutusScriptsV2 = witnessesData.at(6);
  const plutusScriptsV3 = witnessesData.at(7);
  if (!isNil(vKeyWitnesses)) {
    const wVKey: Record<string, VKeyWitness> = {};
    for (const witness of items(vKeyWitnesses)) {
      const [vKey, signature] = items(witness);
      const hash = utils.createHash28(bytes(vKey));
      wVKey[hash] = {
        vKey: hex(vKey),
        signature: hex(signature),
      };
    }
    witnesses.vKeyWitnesses = wVKey;
  }
  if (!isNil(nativeScripts)) {
    const wNativeScripts: Record<string, NativeScript> = {};
    for (const ns of items(nativeScripts)) {
      const hash = utils.createScriptHash(0, encoded(ns));
      wNativeScripts[hash] = parseNativeScript(ns);
    }
    witnesses.nativeScripts = wNativeScripts;
  }
  if (!isNil(bootstrapWitnesses)) {
    const wBootstrapWitnesses: Record<string, BootstrapWitness> = {};
    for (const witness of items(bootstrapWitnesses)) {
      const [publicKey, signature, chainCode, attributes] = items(witness);
      const hash = utils.createHash28(bytes(publicKey));
      wBootstrapWitnesses[hash] = {
        publicKey: hex(publicKey),
        signature: hex(signature),
        chainCode: hex(chainCode),
        attributes: hex(attributes),
      };
    }
    witnesses.bootstrapWitness = wBootstrapWitnesses;
  }
  if (!isNil(plutusScripts)) {
    const wPlutusScripts: Record<string, string> = {};
    for (const ps of items(plutusScripts)) {
      const script = bytes(ps);
      const hash = utils.createScriptHash(1, script);
      wPlutusScripts[hash] = utils.toHex(script);
    }
    witnesses.plutusScripts = wPlutusScripts;
  }
  if (!isNil(plutusScriptsV2)) {
    const wPlutusScripts: Record<string, string> = {};
    for (const ps of items(plutusScriptsV2)) {
      const script = bytes(ps);
      const hash = utils.createScriptHash(2, script);
      wPlutusScripts[hash] = utils.toHex(script);
    }
    witnesses.plutusScriptsV2 = wPlutusScripts;
  }
  if (!isNil(plutusScriptsV3)) {
    const wPlutusScripts: Record<string, string> = {};
    for (const ps of items(plutusScriptsV3)) {
      const script = bytes(ps);
      const hash = utils.createScriptHash(3, script);
      wPlutusScripts[hash] = utils.toHex(script);
    }
    witnesses.plutusScriptsV3 = wPlutusScripts;
  }
  if (!isNil(plutusData)) {
    const wDatum: Record<string, string> = {};
    for (const datum of items(plutusData)) {
      const buff = encoded(datum);
      const hash = utils.createHash32(buff);
      wDatum[hash] = utils.toHex(buff);
    }
    witnesses.plutusData = wDatum;
  }
  if (!isNil(redeemers)) {
    const wRedeemers: Array<Redeemer> = [];
    // [+ [tag, index, data, ex_units]] or { + [tag, index] => [data, ex_units] }
    if (redeemers.kind === "array") {
      for (const r of items(redeemers)) {
        const [tag, index, data, exUnits] = items(r);
        wRedeemers.push(parseRedeemer(tag, index, data, exUnits));
      }
    } else {
      for (const { key, value } of entries(redeemers)) {
        const [tag, index] = items(key);
        const [data, exUnits] = items(value);
        wRedeemers.push(parseRedeemer(tag, index, data, exUnits));
      }
    }
    witnesses.redeemers = wRedeemers;
  }
  return witnesses;
};

export default parseWitnessMap;
