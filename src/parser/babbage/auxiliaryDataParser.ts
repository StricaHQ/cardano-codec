import { CborNode } from "@stricahq/cbors";
import { AuxiliaryData } from "../../types/babbageTypes";
import { hex, isNil, items, tagged } from "../../utils/node";
import { parseMetadata, parseNativeScripts } from "../common";

export const parseAuxiliaryData = (metadata: CborNode) => {
  const data: AuxiliaryData = {};
  let m: CborNode | undefined;
  let nativeScripts: CborNode | undefined;
  let plutusScripts: CborNode | undefined;
  let plutusScriptsV2: CborNode | undefined;
  // shelley AuxiliaryData is Map
  if (metadata.kind === "map") {
    m = metadata;
  }
  // Allegra format AuxiliaryData
  else if (metadata.kind === "array") {
    [m, nativeScripts] = items(metadata);
  }
  // Alonzo onwards AuxiliaryData
  else {
    const auxData = tagged(metadata, 259);
    m = auxData.at(0);
    nativeScripts = auxData.at(1);
    plutusScripts = auxData.at(2);
    plutusScriptsV2 = auxData.at(3);
  }
  if (m?.kind === "map") {
    data.metadata = parseMetadata(m);
  }
  if (!isNil(nativeScripts)) {
    data.nativeScripts = parseNativeScripts(nativeScripts);
  }
  if (!isNil(plutusScripts)) {
    data.plutusScripts = items(plutusScripts).map(hex);
  }
  if (!isNil(plutusScriptsV2)) {
    data.plutusScriptsV2 = items(plutusScriptsV2).map(hex);
  }

  return data;
};

export default parseAuxiliaryData;
