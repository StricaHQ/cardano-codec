import { AuxiliaryData } from "../../types/babbageTypes";
import { parseMetadata, parseNativeScripts } from "../common";

export const parseAuxiliaryData = (metadata: any) => {
  const data: AuxiliaryData = {};
  let m;
  let nativeScripts;
  let plutusScripts;
  let plutusScriptsV2;
  // shelley AuxiliaryData is Map
  if (metadata instanceof Map) {
    m = metadata;
  }
  // Allegra format AuxiliaryData
  else if (Array.isArray(metadata)) {
    m = metadata[0];
    nativeScripts = metadata[1];
  }
  // Alonzo onwards AuxiliaryData
  else {
    const auxData = metadata.value;
    m = auxData.get(0);
    nativeScripts = auxData.get(1);
    plutusScripts = auxData.get(2);
    plutusScriptsV2 = auxData.get(3);
  }
  if (m instanceof Map) {
    data.metadata = parseMetadata(m);
  }
  if (nativeScripts) {
    data.nativeScripts = parseNativeScripts(nativeScripts);
  }
  if (plutusScripts) {
    data.plutusScripts = plutusScripts.map((p: Buffer) => p.toString("hex"));
  }
  if (plutusScriptsV2) {
    data.plutusScriptsV2 = plutusScriptsV2.map((p: Buffer) => p.toString("hex"));
  }

  return data;
};

export default parseAuxiliaryData;
