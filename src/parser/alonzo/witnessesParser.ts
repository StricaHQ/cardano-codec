/* eslint-disable no-nested-ternary */
import {
  BootstrapWitness,
  NativeScript,
  RedeemerTag,
  VKeyWitness,
  Witnesses,
} from "../../types/alonzoTypes";
import * as utils from "../../utils/utils";
import { parsePlutusData, parseNativeScript } from "../common";

export const parseWitnessMap = (witnessesData: Map<any, any>, blockCbor: Buffer) => {
  const witnesses: Witnesses = {};

  const vKeyWitnesses = witnessesData.get(0);
  const nativeScripts = witnessesData.get(1);
  const bootstrapWitnesses = witnessesData.get(2);
  const plutusScripts = witnessesData.get(3);
  const plutusData = witnessesData.get(4);
  const redeemers = witnessesData.get(5);
  if (vKeyWitnesses) {
    const wVKey: Record<string, VKeyWitness> = {};
    for (const witness of vKeyWitnesses) {
      const hash = utils.createHash28(witness[0]);
      wVKey[hash] = {
        vKey: witness[0].toString("hex"),
        signature: witness[1].toString("hex"),
      };
    }
    witnesses.vKeyWitnesses = wVKey;
  }
  if (nativeScripts) {
    const wNativeScripts: Record<string, NativeScript> = {};
    for (const ns of nativeScripts) {
      const nsCborHex = utils.getCborSpanBuffer(blockCbor, ns).toString("hex");
      const hash = utils.createHash28(Buffer.from(`00${nsCborHex}`, "hex"));
      wNativeScripts[hash] = parseNativeScript(ns);
    }
    witnesses.nativeScripts = wNativeScripts;
  }
  if (bootstrapWitnesses) {
    const wBootstrapWitnesses: Record<string, BootstrapWitness> = {};
    for (const witness of bootstrapWitnesses) {
      const hash = utils.createHash28(witness[0]);
      wBootstrapWitnesses[hash] = {
        publicKey: witness[0].toString("hex"),
        signature: witness[1].toString("hex"),
        chainCode: witness[2].toString("hex"),
        attributes: witness[3].toString("hex"),
      };
    }
    witnesses.bootstrapWitness = wBootstrapWitnesses;
  }
  if (plutusScripts) {
    const wPlutusScripts: Record<string, string> = {};
    for (const ps of plutusScripts) {
      const scriptHex = ps.toString("hex");
      const hash = utils.createHash28(Buffer.from(`01${scriptHex}`, "hex"));
      wPlutusScripts[hash] = scriptHex;
    }
    witnesses.plutusScripts = wPlutusScripts;
  }
  if (plutusData) {
    const wDatum: Record<string, string> = {};
    for (const datum of plutusData) {
      const buff = parsePlutusData(datum, blockCbor);
      const hash = utils.createHash32(buff);
      wDatum[hash] = buff.toString("hex");
    }
    witnesses.plutusData = wDatum;
  }
  if (redeemers) {
    const wRedeemers = [];
    for (const r of redeemers) {
      wRedeemers.push({
        index: r[1],
        tag:
          r[0] === 0
            ? RedeemerTag.SPEND
            : r[0] === 1
            ? RedeemerTag.MINT
            : r[0] === 2
            ? RedeemerTag.CERT
            : RedeemerTag.REWARD,
        plutusData: parsePlutusData(r[2], blockCbor).toString("hex"),
        exUnits: {
          mem: r[3][0],
          steps: r[3][1],
        },
      });
    }
    witnesses.redeemers = wRedeemers;
  }
  return witnesses;
};

export default parseWitnessMap;
