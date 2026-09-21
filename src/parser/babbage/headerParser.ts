import { CborNode } from "@stricahq/cbors";
import { Header } from "../../types/babbageTypes";
import { encoded, hex, isNil, items, num } from "../../utils/node";
import * as utils from "../../utils/utils";

export const parseHeader = (header: CborNode): Header => {
  const [headerBody, kesSignature] = items(header);
  const body = items(headerBody);
  const vrfResult = items(body[5]);
  const operationalCert = items(body[8]);
  const protocolVersion = items(body[9]);
  const headerHash = utils.createHash32(encoded(header));

  const result: Header = {
    kesSignature: hex(kesSignature),
    body: {
      hash: headerHash,
      blockHeight: num(body[0]),
      slot: num(body[1]),
      prevHash: isNil(body[2]) ? null : hex(body[2]),
      issuerVKey: hex(body[3]),
      vrfVKey: hex(body[4]),
      vrfResult: [hex(vrfResult[0]), hex(vrfResult[1])],
      bodySize: num(body[6]),
      blockBodyHash: hex(body[7]),
      operationalCert: {
        hotVKey: hex(operationalCert[0]),
        sequenceNumber: num(operationalCert[1]),
        kesPeriod: num(operationalCert[2]),
        sigma: hex(operationalCert[3]),
      },
      protocolVersion: [num(protocolVersion[0]), num(protocolVersion[1])] as [number, number],
    },
  };
  return result;
};

export default parseHeader;
