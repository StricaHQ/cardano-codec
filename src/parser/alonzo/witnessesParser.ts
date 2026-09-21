import { CborNode } from "@stricahq/cbors";
import {
  BootstrapWitness,
  NativeScript,
  Redeemer,
  RedeemerTag,
  VKeyWitness,
  Witnesses,
} from "../../types/alonzoTypes";
import { bytes, encoded, hex, isNil, items, num } from "../../utils/node";
import * as utils from "../../utils/utils";
import { parseNativeScript } from "../common";

export const parseWitnessMap = (witnessesData: CborNode) => {
  const witnesses: Witnesses = {};

  const vKeyWitnesses = witnessesData.at(0);
  const nativeScripts = witnessesData.at(1);
  const bootstrapWitnesses = witnessesData.at(2);
  const plutusScripts = witnessesData.at(3);
  const plutusData = witnessesData.at(4);
  const redeemers = witnessesData.at(5);
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
    for (const r of items(redeemers)) {
      const [tagNode, index, data, exUnits] = items(r);
      const [mem, steps] = items(exUnits);
      const tag = num(tagNode);
      wRedeemers.push({
        index: num(index),
        tag:
          tag === 0
            ? RedeemerTag.SPEND
            : tag === 1
              ? RedeemerTag.MINT
              : tag === 2
                ? RedeemerTag.CERT
                : RedeemerTag.REWARD,
        plutusData: utils.toHex(encoded(data)),
        exUnits: {
          mem: num(mem),
          steps: num(steps),
        },
      });
    }
    witnesses.redeemers = wRedeemers;
  }
  return witnesses;
};

export default parseWitnessMap;
