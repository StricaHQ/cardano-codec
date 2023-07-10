import * as cbors from "@stricahq/cbors";
import * as _ from "lodash";
import { CertificateType } from "../../constants";
import {
  Relay,
  Token,
  TransactionCertificate,
  InstantaneousReward,
  Proposal,
  Transaction,
  TransactionOutput,
  HashType,
  ScriptRef,
  ScriptType,
} from "../../types/babbageTypes";
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

const getStakeCredentialType = (key: number) => {
  if (key === 0) {
    return HashType.ADDRESS;
  }
  // key == 1 is script
  return HashType.SCRIPT;
};

const parseCostMdls = (costMdls: Map<number, Array<number>>) => {
  const parsedCostMdls = [];
  for (const [language, costModel] of costMdls.entries()) {
    parsedCostMdls.push({
      language,
      costModel,
    });
  }
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

const parseCertificates = function (certificates: any) {
  const certs: Array<TransactionCertificate> = [];
  for (const certificate of certificates) {
    let cert: TransactionCertificate;
    switch (certificate[0]) {
      case 0:
        cert = {
          type: CertificateType.STAKE_KEY_REG,
          cert: {
            stakeCredential: {
              key: certificate[1][1].toString("hex"),
              type: getStakeCredentialType(certificate[1][0]),
            },
          },
        };
        certs.push(cert);
        break;
      case 1:
        cert = {
          type: CertificateType.STAKE_KEY_DE_REG,
          cert: {
            stakeCredential: {
              key: certificate[1][1].toString("hex"),
              type: getStakeCredentialType(certificate[1][0]),
            },
          },
        };
        certs.push(cert);
        break;
      case 2:
        cert = {
          type: CertificateType.STAKE_DELEGATION,
          cert: {
            stakeCredential: {
              key: certificate[1][1].toString("hex"),
              type: getStakeCredentialType(certificate[1][0]),
            },
            poolKeyHash: certificate[2].toString("hex"),
          },
        };
        certs.push(cert);
        break;
      case 3:
        cert = {
          type: CertificateType.POOL_REG,
          cert: {
            operator: certificate[1].toString("hex"),
            vrfKeyHash: certificate[2].toString("hex"),
            pledge: certificate[3].toString(),
            cost: certificate[4].toString(),
            margin: [certificate[5].value[0], certificate[5].value[1]],
            rewardAccount: certificate[6].toString("hex"),
            poolOwners: certificate[7].map((owner: Buffer) => owner.toString("hex")),
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
      case 5:
        cert = {
          type: CertificateType.GENESIS_DELEGATION,
          cert: {
            genesisHash: certificate[1].toString("hex"),
            genesisDelegateHash: certificate[2].toString("hex"),
            vrfKeyHash: certificate[3].toString("hex"),
          },
        };
        certs.push(cert);
        break;
      case 6: {
        const rewards = [];
        cert = {
          type: CertificateType.INSTANT_REWARD,
          cert: {
            pot: certificate[1][0],
          },
        };
        if (certificate[1][1] instanceof Map) {
          for (const [key, value] of certificate[1][1]) {
            const reward: InstantaneousReward = {
              amount: value.toString(),
              stakeCredential: {
                key: key[1].toString("hex"),
                type: getStakeCredentialType(key[0]),
              },
            };
            rewards.push(reward);
          }
          cert.cert.rewards = rewards;
        } else {
          cert.cert.amount = certificate[1][1].toString();
        }
        certs.push(cert);
        break;
      }
      default:
        throw new Error("unknown transaction certificate");
    }
  }
  return certs;
};

const parseProtocolParamUpdates = function (updates: any) {
  const proposals = updates[0];

  const proposalsFormatted = [];
  for (const [gHash, update] of proposals) {
    const proposal: Proposal = {
      genesisHash: gHash.toString("hex"),
      parameter: {},
    };
    for (const [variable, value] of update) {
      switch (variable) {
        case 0:
          proposal.parameter.minFeeA = value;
          break;
        case 1:
          proposal.parameter.minFeeB = value;
          break;
        case 2:
          proposal.parameter.maxBlockBodySize = value;
          break;
        case 3:
          proposal.parameter.maxTransactionSize = value;
          break;
        case 4:
          proposal.parameter.maxBlockHeaderSize = value;
          break;
        case 5:
          proposal.parameter.keyDeposit = value;
          break;
        case 6:
          proposal.parameter.poolDeposit = value;
          break;
        case 7:
          proposal.parameter.maxEpoch = value;
          break;
        case 8:
          proposal.parameter.n = value;
          break;
        case 9:
          proposal.parameter.pledgeInfluence = value.value[0] / value.value[1];
          break;
        case 10:
          proposal.parameter.expansionRate = value.value[0] / value.value[1];
          break;
        case 11:
          proposal.parameter.treasuryGrowthRate = value.value[0] / value.value[1];
          break;
        case 14:
          proposal.parameter.protocolVersion = [value[0], value[1]];
          break;
        // case 15:
        //   proposal.parameter.minUtxoValue = value;
        //   break;
        case 16:
          proposal.parameter.minPoolCost = value;
          break;
        case 17:
          proposal.parameter.adaPerUtxoByte = value;
          break;
        case 18:
          proposal.parameter.costMdls = parseCostMdls(value);
          break;
        case 19:
          proposal.parameter.exUnitPrices = {
            mem: [value[0][0], value[0][1]],
            step: [value[1][0], value[1][1]],
          };
          break;
        case 20:
          proposal.parameter.maxTxExUnits = {
            mem: value[0],
            steps: value[1],
          };
          break;
        case 21:
          proposal.parameter.maxBlockExUnits = {
            mem: value[0],
            steps: value[1],
          };
          break;
        case 22:
          proposal.parameter.maxValueSize = value;
          break;
        case 23:
          proposal.parameter.collateralPercent = value;
          break;
        case 24:
          proposal.parameter.maxCollateralInputs = value;
          break;
        default:
          throw new Error("Unknown protocol parameter update");
      }
    }
    proposalsFormatted.push(proposal);
  }

  return {
    proposals: proposalsFormatted,
    epoch: updates[1],
  };
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
        const nsCborHex = utils.getCborSpanBuffer(cborBuf, ns).toString("hex");
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
        for (const input of value) {
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
        const certificates = parseCertificates(value);
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
      case 6: {
        const parameters = parseProtocolParamUpdates(value);
        transaction.update = parameters;
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
        for (const input of value) {
          transaction.collaterals.push({
            txId: input[0].toString("hex"),
            index: input[1],
          });
        }
        break;
      }
      case 14: {
        transaction.requiredSigners = value.map((v: Buffer) => v.toString("hex"));
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
        for (const input of value) {
          transaction.referenceInputs.push({
            txId: input[0].toString("hex"),
            index: input[1],
          });
        }
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
