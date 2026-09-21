import { CborNode } from "@stricahq/cbors";
import { CertificateType } from "../../constants";
import {
  Relay,
  Token,
  TransactionCertificate,
  Transaction,
  TransactionInput,
  TransactionOutput,
  HashType,
  ScriptRef,
  ScriptType,
  VotingProcedure,
  GovAction,
  GovActionId,
  GovActionType,
  ProtocolParamUpdate,
  DRepDeleg,
  DRepDelegType,
  VoterType,
  VoteType,
  Anchor,
  CostMdls,
  Withdrawal,
} from "../../types/conwayTypes";
import {
  bytes,
  coin,
  embedded,
  encoded,
  entries,
  hex,
  isNil,
  items,
  num,
  ratio,
  tagged,
  text,
} from "../../utils/node";
import * as utils from "../../utils/utils";
import { parseNativeScript } from "../common";

// Conway allows tag 258 around every set, which items() looks through.

const getMultiAsset = function (ma: CborNode | undefined) {
  const tokens: Array<Token> = [];
  if (isNil(ma)) {
    return tokens;
  }
  for (const { key: policyId, value: assets } of entries(ma)) {
    for (const { key: assetName, value } of entries(assets)) {
      tokens.push({
        policyId: hex(policyId),
        assetName: hex(assetName),
        amount: coin(value),
      });
    }
  }
  return tokens;
};

const getCredentialType = (key: number) => {
  if (key === 0) {
    return HashType.ADDRESS;
  }
  // key == 1 is script
  return HashType.SCRIPT;
};

const parseCostModel = (costModel: CborNode | undefined) =>
  isNil(costModel) ? undefined : items(costModel).map(num);

const parseCostMdls = (costMdls: CborNode) => {
  const parsedCostMdls: CostMdls = {
    plutusV1: undefined,
    plutusV2: undefined,
    plutusV3: undefined,
  };

  parsedCostMdls.plutusV1 = parseCostModel(costMdls.at(0));
  parsedCostMdls.plutusV2 = parseCostModel(costMdls.at(1));
  parsedCostMdls.plutusV3 = parseCostModel(costMdls.at(2));

  return parsedCostMdls;
};

// a tag 30 rational as [numerator, denominator]
const parseRational = (rational: CborNode | undefined): [number, number] => {
  const [numerator, denominator] = items(tagged(rational, 30));
  return [num(numerator), num(denominator)];
};

const parseInputs = (inputs: CborNode): Array<TransactionInput> => {
  const txIns: Array<TransactionInput> = [];
  for (const input of items(inputs)) {
    const [txId, index] = items(input);
    txIns.push({
      txId: hex(txId),
      index: num(index),
    });
  }
  return txIns;
};

const parseWithdrawals = (withdrawals: CborNode | undefined): Array<Withdrawal> => {
  const withdrawal: Array<Withdrawal> = [];
  for (const { key: ra, value: val } of entries(withdrawals)) {
    withdrawal.push({
      rewardAccount: hex(ra),
      amount: coin(val),
    });
  }
  return withdrawal;
};

const parsePoolMetadata = (poolMetadata: CborNode | undefined) => {
  if (isNil(poolMetadata)) {
    return null;
  }
  const [url, metadataHash] = items(poolMetadata);
  return {
    url: text(url),
    metadataHash: hex(metadataHash),
  };
};

const parseRelays = function (relays: CborNode | undefined): Array<Relay> {
  const relaysFinal: Array<Relay> = [];
  for (const relayNode of items(relays)) {
    const relay = items(relayNode);
    switch (num(relay[0])) {
      case 0: {
        relaysFinal.push({
          port: isNil(relay[1]) ? null : num(relay[1]),
          ipv4: isNil(relay[2]) ? null : hex(relay[2]),
          ipv6: isNil(relay[3]) ? null : hex(relay[3]),
        });
        break;
      }
      case 1: {
        relaysFinal.push({
          port: isNil(relay[1]) ? null : num(relay[1]),
          dnsName: text(relay[2]),
        });
        break;
      }
      case 2: {
        relaysFinal.push({
          srvName: text(relay[1]),
        });
        break;
      }
      default: {
        throw new Error("Unknown type of pool relay");
      }
    }
  }
  return relaysFinal;
};

const parseCredential = (cred: CborNode | undefined) => {
  const [type, key] = items(cred);
  return {
    key: hex(key),
    type: getCredentialType(num(type)),
  };
};

const parseDRepType = (type: CborNode | undefined): DRepDelegType => {
  switch (num(type)) {
    case 0:
      return DRepDelegType.ADDRESS;
    case 1:
      return DRepDelegType.SCRIPT;
    case 2:
      return DRepDelegType.ABSTAIN;
    case 3:
      return DRepDelegType.NO_CONFIDENCE;
    default:
      throw new Error("unknown DRep type");
  }
};

const parseDRep = (dRep: CborNode | undefined) => {
  // [0, addr_keyhash] / [1, script_hash] / [2] (abstain) / [3] (no confidence)
  const [type, key] = items(dRep);
  const dRepDeleg: DRepDeleg = {
    type: parseDRepType(type),
    key: isNil(key) ? undefined : hex(key),
  };
  return dRepDeleg;
};

const parseAnchor = (anc: CborNode | undefined) => {
  let anchor: Anchor | null = null;

  if (!isNil(anc)) {
    const [url, hash] = items(anc);
    anchor = {
      url: text(url),
      hash: hex(hash),
    };
  }

  return anchor;
};

const parseVoterType = (type: CborNode | undefined): VoterType => {
  switch (num(type)) {
    case 0:
      return VoterType.CC_HOT_KEY;
    case 1:
      return VoterType.CC_HOT_SCRIPT;
    case 2:
      return VoterType.DREP_KEY;
    case 3:
      return VoterType.DREP_SCRIPT;
    case 4:
      return VoterType.POOL_KEY;
    default:
      throw new Error("unknown voter type");
  }
};

const parseVote = (vote: CborNode | undefined): VoteType => {
  switch (num(vote)) {
    case 0:
      return VoteType.NO;
    case 1:
      return VoteType.YES;
    case 2:
      return VoteType.ABSTAIN;
    default:
      throw new Error("unknown vote");
  }
};

const parseGovActionId = (govActionId: CborNode | undefined): GovActionId => {
  const [txId, index] = items(govActionId);
  return {
    txId: hex(txId),
    index: num(index),
  };
};

const parsePrevActionId = (prevActionId: CborNode | undefined) =>
  isNil(prevActionId) ? null : parseGovActionId(prevActionId);

const parseCertificates = function (certificates: CborNode) {
  const certs: Array<TransactionCertificate> = [];
  for (const certificateNode of items(certificates)) {
    const certificate = items(certificateNode);
    let cert: TransactionCertificate;
    switch (num(certificate[0])) {
      case 0:
        cert = {
          type: CertificateType.STAKE_KEY_REG,
          cert: {
            stakeCredential: parseCredential(certificate[1]),
          },
        };
        certs.push(cert);
        break;
      case 1:
        cert = {
          type: CertificateType.STAKE_KEY_DE_REG,
          cert: {
            stakeCredential: parseCredential(certificate[1]),
          },
        };
        certs.push(cert);
        break;
      case 2:
        cert = {
          type: CertificateType.STAKE_DELEGATION,
          cert: {
            stakeCredential: parseCredential(certificate[1]),
            poolKeyHash: hex(certificate[2]),
          },
        };
        certs.push(cert);
        break;
      case 3: {
        cert = {
          type: CertificateType.POOL_REG,
          cert: {
            operator: hex(certificate[1]),
            vrfKeyHash: hex(certificate[2]),
            pledge: coin(certificate[3]),
            cost: coin(certificate[4]),
            margin: parseRational(certificate[5]),
            rewardAccount: hex(certificate[6]),
            poolOwners: items(certificate[7]).map(hex),
            relays: parseRelays(certificate[8]),
            poolMetadata: parsePoolMetadata(certificate[9]),
          },
        };
        certs.push(cert);
        break;
      }
      case 4:
        cert = {
          type: CertificateType.POOL_DE_REG,
          cert: {
            poolKeyHash: hex(certificate[1]),
            epoch: num(certificate[2]),
          },
        };
        certs.push(cert);
        break;
      case 7: {
        cert = {
          type: CertificateType.STAKE_REG,
          cert: {
            stakeCredential: parseCredential(certificate[1]),
            deposit: coin(certificate[2]),
          },
        };
        certs.push(cert);
        break;
      }
      case 8: {
        cert = {
          type: CertificateType.STAKE_DE_REG,
          cert: {
            stakeCredential: parseCredential(certificate[1]),
            deposit: coin(certificate[2]),
          },
        };
        certs.push(cert);
        break;
      }
      case 9: {
        cert = {
          type: CertificateType.VOTE_DELEG,
          cert: {
            stakeCredential: parseCredential(certificate[1]),
            dRep: parseDRep(certificate[2]),
          },
        };

        certs.push(cert);
        break;
      }
      case 10: {
        cert = {
          type: CertificateType.STAKE_VOTE_DELEG,
          cert: {
            stakeCredential: parseCredential(certificate[1]),
            poolKeyHash: hex(certificate[2]),
            dRep: parseDRep(certificate[3]),
          },
        };

        certs.push(cert);
        break;
      }
      case 11: {
        cert = {
          type: CertificateType.STAKE_REG_DELEG,
          cert: {
            stakeCredential: parseCredential(certificate[1]),
            poolKeyHash: hex(certificate[2]),
            deposit: coin(certificate[3]),
          },
        };

        certs.push(cert);
        break;
      }
      case 12: {
        cert = {
          type: CertificateType.VOTE_REG_DELEG,
          cert: {
            stakeCredential: parseCredential(certificate[1]),
            dRep: parseDRep(certificate[2]),
            deposit: coin(certificate[3]),
          },
        };

        certs.push(cert);
        break;
      }
      case 13: {
        cert = {
          type: CertificateType.STAKE_VOTE_REG_DELEG,
          cert: {
            stakeCredential: parseCredential(certificate[1]),
            poolKeyHash: hex(certificate[2]),
            dRep: parseDRep(certificate[3]),
            deposit: coin(certificate[4]),
          },
        };

        certs.push(cert);
        break;
      }
      case 14: {
        cert = {
          type: CertificateType.COMMITTEE_AUTH_HOT,
          cert: {
            coldCredential: parseCredential(certificate[1]),
            hotCredential: parseCredential(certificate[2]),
          },
        };

        certs.push(cert);
        break;
      }
      case 15: {
        cert = {
          type: CertificateType.COMMITTEE_RESIGN_COLD,
          cert: {
            coldCredential: parseCredential(certificate[1]),
            anchor: parseAnchor(certificate[2]),
          },
        };

        certs.push(cert);
        break;
      }
      case 16: {
        cert = {
          type: CertificateType.DREP_REG,
          cert: {
            dRepCredential: parseCredential(certificate[1]),
            deposit: coin(certificate[2]),
            anchor: parseAnchor(certificate[3]),
          },
        };

        certs.push(cert);
        break;
      }
      case 17: {
        cert = {
          type: CertificateType.DREP_DE_REG,
          cert: {
            dRepCredential: parseCredential(certificate[1]),
            deposit: coin(certificate[2]),
          },
        };

        certs.push(cert);
        break;
      }
      case 18: {
        cert = {
          type: CertificateType.DREP_UPDATE,
          cert: {
            dRepCredential: parseCredential(certificate[1]),
            anchor: parseAnchor(certificate[2]),
          },
        };

        certs.push(cert);
        break;
      }
      default:
        throw new Error("unknown transaction certificate");
    }
  }
  return certs;
};

const parseProtocolParamUpdate = function (update: CborNode | undefined) {
  const protoParamUpdate: ProtocolParamUpdate = {};

  for (const { key: variable, value } of entries(update)) {
    switch (num(variable)) {
      case 0:
        protoParamUpdate.minFeeA = coin(value);
        break;
      case 1:
        protoParamUpdate.minFeeB = coin(value);
        break;
      case 2:
        protoParamUpdate.maxBlockBodySize = num(value);
        break;
      case 3:
        protoParamUpdate.maxTransactionSize = num(value);
        break;
      case 4:
        protoParamUpdate.maxBlockHeaderSize = num(value);
        break;
      case 5:
        protoParamUpdate.stakeKeyDeposit = coin(value);
        break;
      case 6:
        protoParamUpdate.poolDeposit = coin(value);
        break;
      case 7:
        protoParamUpdate.poolRetireMaxEpoch = num(value);
        break;
      case 8:
        protoParamUpdate.n = num(value);
        break;
      case 9:
        protoParamUpdate.pledgeInfluence = ratio(value);
        break;
      case 10:
        protoParamUpdate.expansionRate = ratio(value);
        break;
      case 11:
        protoParamUpdate.treasuryGrowthRate = ratio(value);
        break;
      case 16:
        protoParamUpdate.minPoolCost = coin(value);
        break;
      case 17:
        protoParamUpdate.adaPerUtxoByte = coin(value);
        break;
      case 18:
        protoParamUpdate.costMdls = parseCostMdls(value);
        break;
      case 19: {
        const [mem, steps] = items(value);
        protoParamUpdate.exUnitPrices = {
          mem: parseRational(mem),
          steps: parseRational(steps),
        };
        break;
      }
      case 20: {
        const [mem, steps] = items(value);
        protoParamUpdate.maxTxExUnits = {
          mem: num(mem),
          steps: num(steps),
        };
        break;
      }
      case 21: {
        const [mem, steps] = items(value);
        protoParamUpdate.maxBlockExUnits = {
          mem: num(mem),
          steps: num(steps),
        };
        break;
      }
      case 22:
        protoParamUpdate.maxValueSize = num(value);
        break;
      case 23:
        protoParamUpdate.collateralPercent = num(value);
        break;
      case 24:
        protoParamUpdate.maxCollateralInputs = num(value);
        break;
      case 25: {
        const thresholds = items(value);
        protoParamUpdate.poolVotingThreshold = {
          motionNoConfidence: ratio(thresholds[0]),
          committeeNormal: ratio(thresholds[1]),
          committeeNoConfidence: ratio(thresholds[2]),
          hfInitiation: ratio(thresholds[3]),
          securityParamVoting: ratio(thresholds[4]),
        };
        break;
      }
      case 26: {
        const thresholds = items(value);
        protoParamUpdate.dRepVotingThreshold = {
          motionNoConfidence: ratio(thresholds[0]),
          committeeNormal: ratio(thresholds[1]),
          committeeNoConfidence: ratio(thresholds[2]),
          updateConstitution: ratio(thresholds[3]),
          hfInitiation: ratio(thresholds[4]),
          networkParamVoting: ratio(thresholds[5]),
          economicParamVoting: ratio(thresholds[6]),
          technicalParamVoting: ratio(thresholds[7]),
          govParamVoting: ratio(thresholds[8]),
          treasuryWithdrawal: ratio(thresholds[9]),
        };
        break;
      }
      case 27:
        protoParamUpdate.minCommitteeSize = num(value);
        break;
      case 28:
        protoParamUpdate.committeeTermLimit = num(value);
        break;
      case 29:
        protoParamUpdate.govActionValidity = num(value);
        break;
      case 30:
        protoParamUpdate.govActionDeposit = coin(value);
        break;
      case 31:
        protoParamUpdate.dRepDeposit = coin(value);
        break;
      case 32:
        protoParamUpdate.dRepInactivity = num(value);
        break;
      case 33:
        protoParamUpdate.refScriptCostByte = ratio(value);
        break;
      default:
        throw new Error("Unknown protocol parameter update");
    }
  }

  return protoParamUpdate;
};

const parseGovAction = function (govActionNode: CborNode | undefined) {
  const govAction = items(govActionNode);
  let action: GovAction;
  switch (num(govAction[0])) {
    case 0: {
      action = {
        type: GovActionType.PARAM_CHANGE_ACTION,
        action: {
          prevActionId: parsePrevActionId(govAction[1]),
          protocolParamUpdate: parseProtocolParamUpdate(govAction[2]),
          policyHash: isNil(govAction[3]) ? null : hex(govAction[3]),
        },
      };
      return action;
    }
    case 1: {
      const [major, minor] = items(govAction[2]);
      action = {
        type: GovActionType.HF_INIT_ACTION,
        action: {
          prevActionId: parsePrevActionId(govAction[1]),
          protocolVersion: [num(major), num(minor)],
        },
      };
      return action;
    }
    case 2: {
      const withdrawals = parseWithdrawals(govAction[1]);
      action = {
        type: GovActionType.TREASURY_WITHDRAW_ACTION,
        action: {
          withdrawals: withdrawals,
          policyHash: isNil(govAction[2]) ? null : hex(govAction[2]),
        },
      };
      return action;
    }
    case 3: {
      action = {
        type: GovActionType.NO_CONFIDENCE_ACTION,
        action: {
          prevActionId: parsePrevActionId(govAction[1]),
        },
      };
      return action;
    }
    case 4: {
      action = {
        type: GovActionType.UPDATE_COMMITTEE_ACTION,
        action: {
          prevActionId: parsePrevActionId(govAction[1]),
          removeColdCred: items(govAction[2]).map(parseCredential),
          addColdCred: entries(govAction[3]).map(({ key: cred, value: epoch }) => ({
            credential: parseCredential(cred),
            epoch: num(epoch),
          })),
          threshold: ratio(govAction[4]),
        },
      };
      return action;
    }
    case 5: {
      // [anchor, script_hash / null]
      const [anchor, scriptHash] = items(govAction[2]);
      action = {
        type: GovActionType.NEW_CONSTITUTION_ACTION,
        action: {
          prevActionId: parsePrevActionId(govAction[1]),
          constitution: {
            anchor: parseAnchor(anchor) as Anchor,
            scriptHash: isNil(scriptHash) ? null : hex(scriptHash),
          },
        },
      };
      return action;
    }
    case 6: {
      action = {
        type: GovActionType.INFO_ACTION,
      };
      return action;
    }
    default:
      throw new Error("unknown gov action");
  }
};

const parsePlutusScriptRef = (type: ScriptType, prefix: number, script: CborNode): ScriptRef => {
  const scriptBytes = bytes(script);
  return {
    type,
    script: utils.toHex(scriptBytes),
    hash: utils.createScriptHash(prefix, scriptBytes),
  };
};

// script_ref = #6.24(bytes .cbor script); the inner item is decoded on its own, so a
// native script hash covers its bytes as written.
const parseScriptRef = (rawScriptRef: CborNode): ScriptRef | undefined => {
  const [type, script] = items(embedded(rawScriptRef));
  switch (num(type)) {
    case 0:
      return {
        type: ScriptType.NATIVE_SCRIPT,
        script: parseNativeScript(script),
        hash: utils.createScriptHash(0, encoded(script)),
      };
    case 1:
      return parsePlutusScriptRef(ScriptType.PLUTUS_V1, 1, script);
    case 2:
      return parsePlutusScriptRef(ScriptType.PLUTUS_V2, 2, script);
    case 3:
      return parsePlutusScriptRef(ScriptType.PLUTUS_V3, 3, script);
    default:
      return undefined;
  }
};

const parseOutput = (output: CborNode): TransactionOutput => {
  let address: CborNode | undefined;
  let outputValue: CborNode | undefined;
  let plutusDataHash: string | undefined;
  let plutusData: string | undefined;
  let scriptRef: ScriptRef | undefined;

  // pre-Babbage [address, value, ? datum_hash], or
  // { 0: address, 1: value, ? 2: datum_option, ? 3: script_ref }
  if (output.kind === "array") {
    const fields = items(output);
    address = fields[0];
    outputValue = fields[1];
    if (!isNil(fields[2])) {
      plutusDataHash = hex(fields[2]);
    }
  } else {
    address = output.at(0);
    outputValue = output.at(1);
    const datumOption = output.at(2);
    const rawScriptRef = output.at(3);

    if (!isNil(datumOption)) {
      // [0, datum_hash] / [1, #6.24(bytes .cbor plutus_data)]
      const [type, datum] = items(datumOption);
      const datumType = num(type);
      if (datumType === 0) {
        plutusDataHash = hex(datum);
      } else if (datumType === 1) {
        const pdBuff = bytes(tagged(datum, 24));
        plutusData = utils.toHex(pdBuff);
        plutusDataHash = utils.createHash32(pdBuff);
      }
    }
    if (!isNil(rawScriptRef)) {
      scriptRef = parseScriptRef(rawScriptRef);
    }
  }

  let adaAmount: string;
  let tokens: Array<Token> | undefined;
  // coin, or [coin, multiasset]
  if (outputValue?.kind === "array") {
    const [amount, multiAsset] = items(outputValue);
    adaAmount = coin(amount);
    tokens = getMultiAsset(multiAsset);
  } else {
    adaAmount = coin(outputValue);
  }
  const out: TransactionOutput = {
    address: hex(address),
    amount: adaAmount,
    tokens,
    plutusDataHash,
    plutusData,
    scriptRef,
  };

  return out;
};

export const parseTransaction = (trx: CborNode): Transaction => {
  const hash = utils.createHash32(encoded(trx));
  const transaction: Transaction = {
    hash,
    inputs: [],
    outputs: [],
    fee: "",
  };
  for (const { key, value } of entries(trx)) {
    switch (num(key)) {
      case 0: {
        transaction.inputs = parseInputs(value);
        break;
      }
      case 1: {
        transaction.outputs = [];
        for (const output of items(value)) {
          transaction.outputs.push(parseOutput(output));
        }
        break;
      }
      case 2: {
        transaction.fee = coin(value);
        break;
      }
      case 3: {
        transaction.ttl = num(value);
        break;
      }
      case 4: {
        const certificates = parseCertificates(value);
        transaction.certificates = certificates;
        break;
      }
      case 5: {
        transaction.withdrawals = parseWithdrawals(value);
        break;
      }
      case 7: {
        transaction.auxiliaryDataHash = hex(value);
        break;
      }
      case 8: {
        transaction.validityIntervalStart = num(value);
        break;
      }
      case 9: {
        transaction.mint = getMultiAsset(value);
        break;
      }
      case 11: {
        transaction.scriptDataHash = hex(value);
        break;
      }
      case 13: {
        transaction.collaterals = parseInputs(value);
        break;
      }
      case 14: {
        transaction.requiredSigners = items(value).map(hex);
        break;
      }
      case 15: {
        transaction.networkId = num(value);
        break;
      }
      case 16: {
        transaction.collateralOutput = parseOutput(value);
        break;
      }
      case 17: {
        transaction.totalCollateral = coin(value);
        break;
      }
      case 18: {
        transaction.referenceInputs = parseInputs(value);
        break;
      }
      case 19: {
        transaction.votingProcedures = [];
        for (const { key: voterNode, value: votes } of entries(value)) {
          const [voterType, voterKey] = items(voterNode);
          const procedure: VotingProcedure = {
            voter: {
              key: hex(voterKey),
              type: parseVoterType(voterType),
            },
            votes: [],
          };
          for (const { key: govActionId, value: voteNode } of entries(votes)) {
            const [vote, anchor] = items(voteNode);
            procedure.votes.push({
              govActionId: parseGovActionId(govActionId),
              vote: parseVote(vote),
              anchor: parseAnchor(anchor),
            });
          }
          transaction.votingProcedures.push(procedure);
        }
        break;
      }
      case 20: {
        transaction.proposalProcedures = [];
        for (const procedureNode of items(value)) {
          const procedure = items(procedureNode);
          transaction.proposalProcedures.push({
            deposit: coin(procedure[0]),
            rewardAccount: hex(procedure[1]),
            govAction: parseGovAction(procedure[2]),
            anchor: parseAnchor(procedure[3]) as Anchor,
          });
        }
        break;
      }
      case 21: {
        transaction.treasuryAmount = coin(value);
        break;
      }
      case 22: {
        transaction.donation = coin(value);
        break;
      }
      default: {
        throw new Error("Unknown transaction field");
      }
    }
  }

  return transaction;
};

export default parseTransaction;
