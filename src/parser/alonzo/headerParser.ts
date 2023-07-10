import { Header } from "../../types/alonzoTypes";
import * as utils from "../../utils/utils";

export const parseHeader = (header: any, blockCbor: Buffer): Header => {
  const headerBuf = utils.getCborSpanBuffer(blockCbor, header);
  const headerHash = utils.createHash32(headerBuf);

  const result = {
    kesSignature: header[1].toString("hex"),
    body: {
      hash: headerHash,
      blockHeight: header[0][0],
      slot: header[0][1],
      prevHash: header[0][2] ? header[0][2].toString("hex") : null,
      issuerVKey: header[0][3].toString("hex"),
      vrfVKey: header[0][4].toString("hex"),
      nonceVrf: {
        natural: header[0][5][0].toString("hex"),
        cert: header[0][5][1].toString("hex"),
      },
      leaderVrf: {
        natural: header[0][6][0].toString("hex"),
        cert: header[0][6][1].toString("hex"),
      },
      bodySize: header[0][7],
      blockBodyHash: header[0][8].toString("hex"),
      operationalCert: {
        hotVKey: header[0][9].toString("hex"),
        sequenceNumber: header[0][10],
        kesPeriod: header[0][11],
        sigma: header[0][12].toString("hex"),
      },
      protocolVersion: [header[0][13], header[0][14]] as [number, number],
    },
  };
  return result;
};

export default parseHeader;
