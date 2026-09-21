import { CborNode } from "@stricahq/cbors";
import { Metadata, MetaDatum, NativeScript } from "../types/alonzoTypes";
import { bytes, entries, hex, int, items, num, text } from "../utils/node";

// Metadata and native scripts nest far deeper than the call stack allows, so both are walked
// with a stack of the items still open, not by recursion.

// Metadata is the one place decoded values reach the output: plain Map and Array, and bytes
// copied out of the input. The ledger accepts nothing else, so any other kind throws.
const parseMetaDatumLeaf = (datum: CborNode): MetaDatum => {
  switch (datum.kind) {
    case "bytes":
      return new Uint8Array(bytes(datum));
    case "text":
      return text(datum);
    default:
      // an integer, bignums included
      return int(datum);
  }
};

/** A metadata map or array whose children are being converted. */
type OpenMetaDatum = {
  // an array's items, or a map's keys and values in turn
  children: Array<CborNode>;
  next: number;
  result: Array<MetaDatum> | Map<MetaDatum, MetaDatum>;
  key: MetaDatum | undefined;
};

const openMetaDatum = (datum: CborNode): OpenMetaDatum => {
  if (datum.kind === "array") {
    return { children: items(datum), next: 0, result: [], key: undefined };
  }
  const children: Array<CborNode> = [];
  for (const { key, value } of entries(datum)) children.push(key, value);
  return { children, next: 0, result: new Map(), key: undefined };
};

const parseMetaDatum = (datum: CborNode): MetaDatum => {
  const open: Array<OpenMetaDatum> = [];
  let node = datum;
  for (;;) {
    let value: MetaDatum;
    if (node.kind === "array" || node.kind === "map") {
      const container = openMetaDatum(node);
      if (container.children.length > 0) {
        open.push(container);
        node = container.children[0];
        continue;
      }
      value = container.result;
    } else {
      value = parseMetaDatumLeaf(node);
    }

    // hand the value to its container, and each container this completes to the one around it
    for (;;) {
      const top = open[open.length - 1];
      if (top === undefined) return value;
      const { result } = top;
      if (Array.isArray(result)) {
        result.push(value);
      } else if (top.next % 2 === 0) {
        top.key = value;
      } else {
        result.set(top.key as MetaDatum, value);
      }
      top.next += 1;
      if (top.next < top.children.length) {
        node = top.children[top.next];
        break;
      }
      open.pop();
      value = result;
    }
  }
};

export const parseMetadata = (metadata: CborNode): Array<Metadata> => {
  const data = new Map<number, MetaDatum>();
  for (const { key, value } of entries(metadata)) {
    data.set(num(key), parseMetaDatum(value));
  }
  return Array.from(data, ([label, datum]) => ({
    label,
    data: datum,
  }));
};

export const parseNativeScripts = (nativeScripts: CborNode): Array<NativeScript> => {
  const data: Array<NativeScript> = [];
  for (const nativeScript of items(nativeScripts)) {
    data.push(parseNativeScript(nativeScript));
  }
  return data;
};

const parseNativeScriptLeaf = (script: Array<CborNode>, type: number): NativeScript => {
  switch (type) {
    case 0: {
      const pubKey = hex(script[1]);
      return {
        pubKeyHash: pubKey,
      };
    }
    case 4: {
      const invalidBefore = num(script[1]);
      return {
        invalidBefore,
      };
    }
    case 5: {
      const invalidAfter = num(script[1]);
      return {
        invalidAfter,
      };
    }
    default:
      throw new Error("Error parsing Native Script");
  }
};

/** An all, any or n-of-k script whose scripts are being parsed. */
type OpenNativeScript = {
  script: Array<CborNode>;
  type: 1 | 2 | 3;
  scripts: Array<CborNode>;
  parsed: Array<NativeScript>;
};

const closeNativeScript = ({ script, type, parsed }: OpenNativeScript): NativeScript => {
  switch (type) {
    case 1:
      return { all: parsed };
    case 2:
      return { any: parsed };
    default:
      return { n: num(script[1]), k: parsed };
  }
};

export const parseNativeScript = (nativeScript: CborNode): NativeScript => {
  const open: Array<OpenNativeScript> = [];
  let node = nativeScript;
  for (;;) {
    const script = items(node);
    const type = num(script[0]);
    let value: NativeScript;
    if (type === 1 || type === 2 || type === 3) {
      const container: OpenNativeScript = {
        script,
        type,
        scripts: items(script[type === 3 ? 2 : 1]),
        parsed: [],
      };
      if (container.scripts.length > 0) {
        open.push(container);
        node = container.scripts[0];
        continue;
      }
      value = closeNativeScript(container);
    } else {
      value = parseNativeScriptLeaf(script, type);
    }

    // hand the script to its container, and each container this completes to the one around it
    for (;;) {
      const top = open[open.length - 1];
      if (top === undefined) return value;
      top.parsed.push(value);
      if (top.parsed.length < top.scripts.length) {
        node = top.scripts[top.parsed.length];
        break;
      }
      open.pop();
      value = closeNativeScript(top);
    }
  }
};
