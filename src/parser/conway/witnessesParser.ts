/* eslint-disable no-nested-ternary */
import {
  NativeScript,
  VKeyWitness,
  Witnesses,
  BootstrapWitness,
} from "../../types/conwayTypes";
import * as utils from "../../utils/utils";
import { parsePlutusData, parseNativeScript } from "../common";

export const parseWitnessMap = (witnessesData: Map<any, any>, blockCbor: Buffer) => {
  const witnesses: Witnesses = {};

  let vKeyWitnesses = witnessesData.get(0);
  let nativeScripts = witnessesData.get(1);
  let bootstrapWitnesses = witnessesData.get(2);
  let plutusScripts = witnessesData.get(3);
  let plutusData = witnessesData.get(4);
  let redeemers = witnessesData.get(5);
  let plutusScriptsV2 = witnessesData.get(6);
  let plutusScriptsV3 = witnessesData.get(7);
  if (vKeyWitnesses) {
    // support for optional cbor tag in conway
    if (!Array.isArray(vKeyWitnesses)) {
      vKeyWitnesses = vKeyWitnesses.value;
    }
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
    // support for optional cbor tag in conway
    if (!Array.isArray(nativeScripts)) {
      nativeScripts = nativeScripts.value;
    }
    const wNativeScripts: Record<string, NativeScript> = {};
    for (const ns of nativeScripts) {
      const nsCborHex = utils.getCborSpanBuffer(blockCbor, ns).toString("hex");
      const hash = utils.createHash28(Buffer.from(`00${nsCborHex}`, "hex"));
      wNativeScripts[hash] = parseNativeScript(ns);
    }
    witnesses.nativeScripts = wNativeScripts;
  }
  if (bootstrapWitnesses) {
    // support for optional cbor tag in conway
    if (!Array.isArray(bootstrapWitnesses)) {
      bootstrapWitnesses = bootstrapWitnesses.value;
    }
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
    // support for optional cbor tag in conway
    if (!Array.isArray(plutusScripts)) {
      plutusScripts = plutusScripts.value;
    }
    const wPlutusScripts: Record<string, string> = {};
    for (const ps of plutusScripts) {
      const scriptHex = ps.toString("hex");
      const hash = utils.createHash28(Buffer.from(`01${scriptHex}`, "hex"));
      wPlutusScripts[hash] = scriptHex;
    }
    witnesses.plutusScripts = wPlutusScripts;
  }
  if (plutusScriptsV2) {
    // support for optional cbor tag in conway
    if (!Array.isArray(plutusScriptsV2)) {
      plutusScriptsV2 = plutusScriptsV2.value;
    }
    const wPlutusScripts: Record<string, string> = {};
    for (const ps of plutusScriptsV2) {
      const scriptHex = ps.toString("hex");
      const hash = utils.createHash28(Buffer.from(`02${scriptHex}`, "hex"));
      wPlutusScripts[hash] = scriptHex;
    }
    witnesses.plutusScriptsV2 = wPlutusScripts;
  }
  if (plutusScriptsV3) {
    // support for optional cbor tag in conway
    if (!Array.isArray(plutusScriptsV3)) {
      plutusScriptsV3 = plutusScriptsV3.value;
    }
    const wPlutusScripts: Record<string, string> = {};
    for (const ps of plutusScriptsV3) {
      const scriptHex = ps.toString("hex");
      const hash = utils.createHash28(Buffer.from(`03${scriptHex}`, "hex"));
      wPlutusScripts[hash] = scriptHex;
    }
    witnesses.plutusScriptsV2 = wPlutusScripts;
  }
  if (plutusData) {
    // support for optional cbor tag in conway
    if (!Array.isArray(plutusData)) {
      plutusData = plutusData.value;
    }
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
    if (Array.isArray(redeemers)) {
      for (const r of redeemers) {
        wRedeemers.push({
          index: r[1],
          tag: r[0],
          plutusData: parsePlutusData(r[2], blockCbor).toString("hex"),
          exUnits: {
            mem: r[3][0],
            steps: r[3][1],
          },
        });
      }
    } else {
      for (const [ri, de] of Array.from(redeemers) as any) {
        wRedeemers.push({
          index: ri[1],
          tag: ri[0],
          plutusData: parsePlutusData(de[0], blockCbor).toString("hex"),
          exUnits: {
            mem: de[1][0],
            steps: de[1][1],
          },
        });
      }
    }
    witnesses.redeemers = wRedeemers;
  }
  return witnesses;
};

export default parseWitnessMap;
