import * as cbors from "@stricahq/cbors";
import * as _ from "lodash";
import { CertificateType } from "../../constants";
import {
  Relay,
  Token,
  TransactionCertificate,
  Transaction,
  TransactionOutput,
  HashType,
  ScriptRef,
  ScriptType,
  VotingProcedure,
  GovAction,
  GovActionType,
  ProtocolParamUpdate,
  DRepDeleg,
  Anchor,
  CostMdls,
} from "../../types/conwayTypes";
import * as utils from "../../utils/utils";
import { parseNativeScript } from "../common";

const getMultiAsset = function (ma: any) {
  const tokens: Array<Token> = [];
  if (_.isEmpty(ma)) {
    return tokens;
  }
  for (const [policyId, assets] of ma.entries()) {
    for (const [assetName, value] of assets.entries()) {
      tokens.push({
        policyId: policyId.toString("hex"),
        assetName: assetName.toString("hex"),
        amount: value.toString(),
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

const parseCostMdls = (costMdls: Map<number, Array<number>>) => {
  const parsedCostMdls: CostMdls = {
    plutusV1: undefined,
    plutusV2: undefined,
    plutusV3: undefined,
  };

  parsedCostMdls.plutusV1 = costMdls.get(0);
  parsedCostMdls.plutusV2 = costMdls.get(1);
  parsedCostMdls.plutusV3 = costMdls.get(2);

  return parsedCostMdls;
};

const parseRelays = function (relays: any): Array<Relay> {
  const relaysFinal: Array<Relay> = [];
  for (const relay of relays) {
    switch (relay[0]) {
      case 0: {
        relaysFinal.push({
          port: relay[1],
          ipv4: relay[2] ? relay[2].toString("hex") : null,
          ipv6: relay[3] ? relay[3].toString("hex") : null,
        });
        break;
      }
      case 1: {
        relaysFinal.push({
          port: relay[1],
          dnsName: relay[2],
        });
        break;
      }
      case 2: {
        relaysFinal.push({
          srvName: relay[1],
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

const parseCredential = (cred: any) => {
  return {
    key: cred[1].toString("hex"),
    type: getCredentialType(cred[0]),
  };
};

const parseDRep = (dRep: any) => {
  const dRepDeleg: DRepDeleg = {
    type: dRep[0],
    key: dRep[1] ? dRep[1].toString("hex") : undefined,
  };
  return dRepDeleg;
};

const parseAnchor = (anc: any) => {
  let anchor: Anchor | null = null;

  if (anc) {
    anchor = {
      url: anc[0],
      hash: anc[1].toString("hex"),
    };
  }

  return anchor;
};

const parseCertificates = function (certificates: any) {
  const certs: Array<TransactionCertificate> = [];
  for (const certificate of certificates) {
    let cert: TransactionCertificate;
    switch (certificate[0]) {
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
            poolKeyHash: certificate[2].toString("hex"),
          },
        };
        certs.push(cert);
        break;
      case 3: {
        // support for optional cbor tag in conway
        let owners = certificate[7];
        if (!Array.isArray(owners)) {
          owners = owners.value;
        }
        cert = {
          type: CertificateType.POOL_REG,
          cert: {
            operator: certificate[1].toString("hex"),
            vrfKeyHash: certificate[2].toString("hex"),
            pledge: certificate[3].toString(),
            cost: certificate[4].toString(),
            margin: [certificate[5].value[0], certificate[5].value[1]],
            rewardAccount: certificate[6].toString("hex"),
            poolOwners: owners.map((owner: Buffer) => owner.toString("hex")),
            relays: parseRelays(certificate[8]),
            poolMetadata: certificate[9]
              ? {
                  url: certificate[9][0],
                  metadataHash: certificate[9][1].toString("hex"),
                }
              : null,
          },
        };
        certs.push(cert);
        break;
      }
      case 4:
        cert = {
          type: CertificateType.POOL_DE_REG,
          cert: {
            poolKeyHash: certificate[1].toString("hex"),
            epoch: certificate[2],
          },
        };
        certs.push(cert);
        break;
      case 7: {
        cert = {
          type: CertificateType.STAKE_REG,
          cert: {
            stakeCredential: parseCredential(certificate[1]),
            deposit: certificate[2].toString(),
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
            deposit: certificate[2].toString(),
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
            poolKeyHash: certificate[2].toString("hex"),
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
            poolKeyHash: certificate[2].toString("hex"),
            deposit: certificate[3].toString(),
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
            deposit: certificate[3].toString(),
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
            poolKeyHash: certificate[2].toString("hex"),
            dRep: parseDRep(certificate[3]),
            deposit: certificate[4].toString(),
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
            deposit: certificate[2].toString(),
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
            deposit: certificate[2].toString(),
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

const parseProtocolParamUpdate = function (update: any) {
  const protoParamUpdate: ProtocolParamUpdate = {};

  for (const [variable, value] of update) {
    switch (variable) {
      case 0:
        protoParamUpdate.minFeeA = value;
        break;
      case 1:
        protoParamUpdate.minFeeB = value;
        break;
      case 2:
        protoParamUpdate.maxBlockBodySize = value;
        break;
      case 3:
        protoParamUpdate.maxTransactionSize = value;
        break;
      case 4:
        protoParamUpdate.maxBlockHeaderSize = value;
        break;
      case 5:
        protoParamUpdate.stakeKeyDeposit = value;
        break;
      case 6:
        protoParamUpdate.poolDeposit = value;
        break;
      case 7:
        protoParamUpdate.poolRetireMaxEpoch = value;
        break;
      case 8:
        protoParamUpdate.n = value;
        break;
      case 9:
        protoParamUpdate.pledgeInfluence = value.value[0] / value.value[1];
        break;
      case 10:
        protoParamUpdate.expansionRate = value.value[0] / value.value[1];
        break;
      case 11:
        protoParamUpdate.treasuryGrowthRate = value.value[0] / value.value[1];
        break;
      case 16:
        protoParamUpdate.minPoolCost = value;
        break;
      case 17:
        protoParamUpdate.adaPerUtxoByte = value;
        break;
      case 18:
        protoParamUpdate.costMdls = parseCostMdls(value);
        break;
      case 19:
        protoParamUpdate.exUnitPrices = {
          mem: [value[0][0], value[0][1]],
          steps: [value[1][0], value[1][1]],
        };
        break;
      case 20:
        protoParamUpdate.maxTxExUnits = {
          mem: value[0],
          steps: value[1],
        };
        break;
      case 21:
        protoParamUpdate.maxBlockExUnits = {
          mem: value[0],
          steps: value[1],
        };
        break;
      case 22:
        protoParamUpdate.maxValueSize = value;
        break;
      case 23:
        protoParamUpdate.collateralPercent = value;
        break;
      case 24:
        protoParamUpdate.maxCollateralInputs = value;
        break;
      case 25:
        protoParamUpdate.poolVotingThreshold = {
          motionNoConfidence: value[0].value[0] / value[0].value[1],
          committeeNormal: value[1].value[0] / value[1].value[1],
          committeeNoConfidence: value[2].value[0] / value[2].value[1],
          hfInitiation: value[3].value[0] / value[3].value[1],
          securityParamVoting: value[4].value[0] / value[4].value[1],
        };
        break;
      case 26:
        protoParamUpdate.dRepVotingThreshold = {
          motionNoConfidence: value[0].value[0] / value[0].value[1],
          committeeNormal: value[1].value[0] / value[1].value[1],
          committeeNoConfidence: value[2].value[0] / value[2].value[1],
          updateConstitution: value[3].value[0] / value[3].value[1],
          hfInitiation: value[4].value[0] / value[4].value[1],
          networkParamVoting: value[5].value[0] / value[5].value[1],
          economicParamVoting: value[6].value[0] / value[6].value[1],
          technicalParamVoting: value[7].value[0] / value[7].value[1],
          govParamVoting: value[8].value[0] / value[8].value[1],
          treasuryWithdrawal: value[9].value[0] / value[9].value[1],
        };
        break;
      case 27:
        protoParamUpdate.minCommitteeSize = value;
        break;
      case 28:
        protoParamUpdate.committeeTermLimit = value;
        break;
      case 29:
        protoParamUpdate.govActionValidity = value;
        break;
      case 30:
        protoParamUpdate.govActionDeposit = value;
        break;
      case 31:
        protoParamUpdate.dRepDeposit = value;
        break;
      case 32:
        protoParamUpdate.dRepInactivity = value;
        break;
      case 33:
        protoParamUpdate.govActionValidity = value.value[0] / value.value[1];
        break;
      default:
        throw new Error("Unknown protocol parameter update");
    }
  }

  return protoParamUpdate;
};

const parseGovAction = function (govAction: any) {
  let action: GovAction;
  switch (govAction[0]) {
    case 0:
      action = {
        type: GovActionType.PARAM_CHANGE_ACTION,
        action: {
          prevActionId: govAction[1]
            ? {
                txId: govAction[1][0].toString("hex"),
                index: govAction[1][1],
              }
            : null,
          protocolParamUpdate: parseProtocolParamUpdate(govAction[2]),
          policyHash: govAction[3] ? govAction[3].toString("hex") : null,
        },
      };
      return action;
    case 1:
      action = {
        type: GovActionType.HF_INIT_ACTION,
        action: {
          prevActionId: govAction[1]
            ? {
                txId: govAction[1][0].toString("hex"),
                index: govAction[1][1],
              }
            : null,
          protocolVersion: [govAction[2][0], govAction[2][1]],
        },
      };
      return action;
    case 2:
      const withdrawals = [];
      for (const [ra, val] of govAction[1]) {
        withdrawals.push({
          rewardAccount: ra.toString("hex"),
          amount: val.toString(),
        });
      }
      action = {
        type: GovActionType.TREASURY_WITHDRAW_ACTION,
        action: {
          withdrawals: withdrawals,
          policyHash: govAction[2] ? govAction[2].toString("hex") : null,
        },
      };
      return action;
    case 3:
      action = {
        type: GovActionType.NO_CONFIDENCE_ACTION,
        action: {
          prevActionId: govAction[1]
            ? {
                txId: govAction[1][0].toString("hex"),
                index: govAction[1][1],
              }
            : null,
        },
      };
      return action;
    case 4:
      // support for optional cbor tag in conway
      let coldCreds = govAction[2];
      if (!Array.isArray(coldCreds)) {
        coldCreds = coldCreds.value;
      }
      action = {
        type: GovActionType.UPDATE_COMMITTEE_ACTION,
        action: {
          prevActionId: govAction[1]
            ? {
                txId: govAction[1][0].toString("hex"),
                index: govAction[1][1],
              }
            : null,
          removeColdCred: coldCreds.map((cert: any) => {
            return {
              key: cert[1].toString("hex"),
              type: getCredentialType(cert[0]),
            };
          }),
          addColdCred: Array.from(govAction[3]).map(([cred, epoch]: any) => ({
            credential: {
              key: cred[1].toString("hex"),
              type: getCredentialType(cred[0]),
            },
            epoch: epoch,
          })),
          threshold: govAction[4].value[0] / govAction[4].value[1],
        },
      };
      return action;
    case 5:
      action = {
        type: GovActionType.NEW_CONSTITUTION_ACTION,
        action: {
          prevActionId: govAction[1]
            ? {
                txId: govAction[1][0].toString("hex"),
                index: govAction[1][1],
              }
            : null,
          constitution: {
            anchor: parseAnchor(govAction[2][0]) as Anchor,
            scriptHash: govAction[2][1] ? govAction[2][1].toString("hex"): govAction[2][1],
          },
        },
      };
      return action;
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

const parseOutput = (output: any, cborBuf: Buffer): TransactionOutput => {
  let address;
  let outputValue;
  let plutusDataHash: string | undefined;
  let plutusData: string | undefined;
  let scriptRef: ScriptRef | undefined;

  if (Array.isArray(output)) {
    address = output[0];
    outputValue = output[1];
    if (output[2]) {
      plutusDataHash = output[2].toString("hex");
    }
  } else {
    address = output.get(0);
    outputValue = output.get(1);
    const datumOption = output.get(2);
    const rawScriptRef = output.get(3);

    if (datumOption) {
      if (datumOption[0] === 0) {
        plutusDataHash = datumOption[1].toString("hex");
      } else if (datumOption[0] === 1) {
        const pdBuff = datumOption[1].value;
        plutusData = pdBuff.toString("hex");
        plutusDataHash = utils.createHash32(pdBuff);
      }
    }
    if (rawScriptRef) {
      const script = cbors.Decoder.decode(rawScriptRef.value).value;
      if (script[0] === 0) {
        const ns = script[1];
        const nsCborHex = cbors.Encoder.encode(ns).toString('hex');
        const hash = utils.createHash28(Buffer.from(`00${nsCborHex}`, "hex"));

        scriptRef = {
          type: ScriptType.NATIVE_SCRIPT,
          script: parseNativeScript(script[1]),
          hash: hash,
        };
      } else if (script[0] === 1) {
        const scriptHex = script[1].toString("hex");
        const hash = utils.createHash28(Buffer.from(`01${scriptHex}`, "hex"));
        scriptRef = {
          type: ScriptType.PLUTUS_V1,
          script: scriptHex,
          hash: hash,
        };
      } else if (script[0] === 2) {
        const scriptHex = script[1].toString("hex");
        const hash = utils.createHash28(Buffer.from(`02${scriptHex}`, "hex"));
        scriptRef = {
          type: ScriptType.PLUTUS_V2,
          script: scriptHex,
          hash: hash,
        };
      } else if (script[0] === 3) {
        const scriptHex = script[1].toString("hex");
        const hash = utils.createHash28(Buffer.from(`03${scriptHex}`, "hex"));
        scriptRef = {
          type: ScriptType.PLUTUS_V3,
          script: scriptHex,
          hash: hash,
        };
      }
    }
  }

  let adaAmount;
  let tokens: Array<Token> | undefined;
  if (Array.isArray(outputValue)) {
    adaAmount = outputValue[0].toString();
    tokens = getMultiAsset(outputValue[1]);
  } else {
    adaAmount = outputValue.toString();
  }
  const out: TransactionOutput = {
    address: address.toString("hex"),
    amount: adaAmount,
    tokens,
    plutusDataHash,
    plutusData,
    scriptRef,
  };

  return out;
};

export const parseTransaction = (trx: any, cborBuf: Buffer): Transaction => {
  const trxBuf = utils.getCborSpanBuffer(cborBuf, trx);
  const hash = utils.createHash32(trxBuf);
  const transaction: Transaction = {
    hash,
    inputs: [],
    outputs: [],
    fee: "",
  };
  for (const [key, value] of trx) {
    switch (key) {
      case 0: {
        transaction.inputs = [];
        // support for optional cbor tag in conway
        let inputs = value;
        if (!Array.isArray(inputs)) {
          inputs = inputs.value;
        }
        for (const input of inputs) {
          transaction.inputs.push({
            txId: input[0].toString("hex"),
            index: input[1],
          });
        }
        break;
      }
      case 1: {
        transaction.outputs = [];
        if (value && value.length > 0) {
          for (const output of value) {
            const out = parseOutput(output, cborBuf);
            transaction.outputs.push(out);
          }
        }
        break;
      }
      case 2: {
        transaction.fee = value.toString();
        break;
      }
      case 3: {
        transaction.ttl = value;
        break;
      }
      case 4: {
        // support for optional cbor tag in conway
        let certs = value;
        if (!Array.isArray(certs)) {
          certs = certs.value;
        }
        const certificates = parseCertificates(certs);
        transaction.certificates = certificates;
        break;
      }
      case 5: {
        const withdrawal = [];
        for (const [ra, val] of value) {
          withdrawal.push({
            rewardAccount: ra.toString("hex"),
            amount: val.toString(),
          });
        }
        transaction.withdrawals = withdrawal;
        break;
      }
      case 7: {
        transaction.auxiliaryDataHash = value.toString("hex");
        break;
      }
      case 8: {
        transaction.validityIntervalStart = value;
        break;
      }
      case 9: {
        transaction.mint = getMultiAsset(value);
        break;
      }
      case 11: {
        transaction.scriptDataHash = value.toString("hex");
        break;
      }
      case 13: {
        transaction.collaterals = [];
        // support for optional cbor tag in conway
        let inputs = value;
        if (!Array.isArray(inputs)) {
          inputs = inputs.value;
        }
        for (const input of inputs) {
          transaction.collaterals.push({
            txId: input[0].toString("hex"),
            index: input[1],
          });
        }
        break;
      }
      case 14: {
        // support for optional cbor tag in conway
        let reqSigners = value;
        if (!Array.isArray(reqSigners)) {
          reqSigners = reqSigners.value;
        }
        transaction.requiredSigners = reqSigners.map((v: Buffer) => v.toString("hex"));
        break;
      }
      case 15: {
        transaction.networkId = value;
        break;
      }
      case 16: {
        transaction.collateralOutput = parseOutput(value, cborBuf);
        break;
      }
      case 17: {
        transaction.totalCollateral = value.toString();
        break;
      }
      case 18: {
        transaction.referenceInputs = [];
        let inputs = value;
        if (!Array.isArray(inputs)) {
          inputs = inputs.value;
        }
        for (const input of inputs) {
          transaction.referenceInputs.push({
            txId: input[0].toString("hex"),
            index: input[1],
          });
        }
        break;
      }
      case 19: {
        transaction.votingProcedures = [];
        for (const [voter, voteMap] of value) {
          const procedure: VotingProcedure = {
            voter: {
              key: voter[1].toString("hex"),
              type: voter[0],
            },
            votes: [],
          };
          for (const [govActionIdAry, vote] of voteMap) {
            procedure.votes.push({
              govActionId: {
                txId: govActionIdAry[0].toString("hex"),
                index: govActionIdAry[1],
              },
              vote: vote[0],
              anchor: parseAnchor(vote[1]),
            });
          }
          transaction.votingProcedures.push(procedure);
        }
        break;
      }
      case 20: {
        transaction.proposalProcedures = [];
        // support for optional cbor tag in conway
        let procedures = value;
        if (!Array.isArray(procedures)) {
          procedures = procedures.value;
        }
        for (const procedure of procedures) {
          transaction.proposalProcedures.push({
            deposit: procedure[0],
            rewardAccount: procedure[1].toString("hex"),
            govAction: parseGovAction(procedure[2]),
            anchor: parseAnchor(procedure[3]) as Anchor,
          });
        }
        break;
      }
      case 21: {
        transaction.treasuryAmount = value.toString();
        break;
      }
      case 22: {
        transaction.donation = value.toString();
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
