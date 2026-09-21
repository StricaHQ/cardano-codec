import { CborNode } from "@stricahq/cbors";
import { Header } from "../../types/alonzoTypes";
import { encoded, hex, isNil, items, num } from "../../utils/node";
import * as utils from "../../utils/utils";

export const parseHeader = (header: CborNode): Header => {
  const [headerBody, kesSignature] = items(header);
  const body = items(headerBody);
  const nonceVrf = items(body[5]);
  const leaderVrf = items(body[6]);
  const headerHash = utils.createHash32(encoded(header));

  const result = {
    kesSignature: hex(kesSignature),
    body: {
      hash: headerHash,
      blockHeight: num(body[0]),
      slot: num(body[1]),
      prevHash: isNil(body[2]) ? null : hex(body[2]),
      issuerVKey: hex(body[3]),
      vrfVKey: hex(body[4]),
      nonceVrf: {
        natural: hex(nonceVrf[0]),
        cert: hex(nonceVrf[1]),
      },
      leaderVrf: {
        natural: hex(leaderVrf[0]),
        cert: hex(leaderVrf[1]),
      },
      bodySize: num(body[7]),
      blockBodyHash: hex(body[8]),
      operationalCert: {
        hotVKey: hex(body[9]),
        sequenceNumber: num(body[10]),
        kesPeriod: num(body[11]),
        sigma: hex(body[12]),
      },
      protocolVersion: [num(body[13]), num(body[14])] as [number, number],
    },
  };
  return result;
};

export default parseHeader;
