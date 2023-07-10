import * as cbors from "@stricahq/cbors";
import { Metadata, NativeScript } from "../types/alonzoTypes";
import * as utils from "../utils/utils";

export const parsePlutusData = (datum: any, blockCbor: Buffer) => {
  // datum does not have strings
  if (typeof datum === "number") {
    return cbors.Encoder.encode(datum);
  }
  const datumBuf = utils.getCborSpanBuffer(blockCbor, datum);
  return datumBuf;
};

export const parseMetadata = (metadata: any): Array<Metadata> => {
  const data = [];
  for (const [label, datum] of metadata.entries()) {
    data.push({
      label,
      data: datum,
    });
  }
  return data;
};

export const parseNativeScripts = (nativeScripts: Array<any>): Array<NativeScript> => {
  const data: Array<NativeScript> = [];
  for (const nativeScript of nativeScripts) {
    // eslint-disable-next-line no-use-before-define
    data.push(parseNativeScript(nativeScript));
  }
  return data;
};

export const parseNativeScript = (nativeScript: Array<any>): NativeScript => {
  if (nativeScript[0] === 0) {
    const pubKey = nativeScript[1].toString("hex");
    return {
      pubKeyHash: pubKey,
    };
  }
  if (nativeScript[0] === 1) {
    const all = parseNativeScripts(nativeScript[1]);
    return {
      all,
    };
  }
  if (nativeScript[0] === 2) {
    const any = parseNativeScripts(nativeScript[1]);
    return {
      any,
    };
  }
  if (nativeScript[0] === 3) {
    const k = parseNativeScripts(nativeScript[2]);
    return {
      n: nativeScript[1],
      k: k,
    };
  }
  if (nativeScript[0] === 4) {
    const invalidBefore = nativeScript[1];
    return {
      invalidBefore,
    };
  }
  if (nativeScript[0] === 5) {
    const invalidAfter = nativeScript[1];
    return {
      invalidAfter,
    };
  }
  throw new Error("Error parsing Native Script");
};
