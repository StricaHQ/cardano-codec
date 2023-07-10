import { Header } from "../../types/babbageTypes";
import * as utils from "../../utils/utils";

export const parseHeader = (header: any, blockCbor: Buffer): Header => {
  const headerBuf = utils.getCborSpanBuffer(blockCbor, header);
  const headerHash = utils.createHash32(headerBuf);

  const result: Header = {
    kesSignature: header[1].toString("hex"),
    body: {
      hash: headerHash,
      blockHeight: header[0][0],
      slot: header[0][1],
      prevHash: header[0][2] ? header[0][2].toString("hex") : null,
      issuerVKey: header[0][3].toString("hex"),
      vrfVKey: header[0][4].toString("hex"),
      vrfResult: [header[0][5][0].toString("hex"), header[0][5][1].toString("hex")],
      bodySize: header[0][6],
      blockBodyHash: header[0][7].toString("hex"),
      operationalCert: {
        hotVKey: header[0][8][0].toString("hex"),
        sequenceNumber: header[0][8][1],
        kesPeriod: header[0][8][2],
        sigma: header[0][8][3].toString("hex"),
      },
      protocolVersion: [header[0][9][0], header[0][9][1]] as [number, number],
    },
  };
  return result;
};

export default parseHeader;
