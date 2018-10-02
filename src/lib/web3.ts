import axios from "axios";

import Web3 from "web3";
import { JsonRPCResponse } from "web3/types";

// Matches a 32-byte transaction ID (starting with 0x)
const txHashRegExp = new RegExp(/^0x([A-Fa-f0-9]{64})$/);

interface TraceLog {

}

type TraceError = string | { message: string, code: number };

interface Trace extends JsonRPCResponse {
    result?: {
        failed: true;
        gas: 39643;
        returnValue: string;
        structLogs: TraceLog[];
    };
}

export const getWeb3 = (network: string) => {
    switch (network) {
        case "main":
        case "mainnet":
            return new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io:443/remix"));
            break;
        case "ropsten":
            return new Web3(new Web3.providers.HttpProvider("https://ropsten.infura.io:443/remix"));
            break;
        case "kovan":
            return new Web3(new Web3.providers.HttpProvider("https://kovan.infura.io:443/remix"));
            break;
        case "rinkeby":
            return new Web3(new Web3.providers.HttpProvider("https://rinkeby.infura.io:443/remix"));
            break;
        default:
            throw new Error("Unknown network");
    }
};

export const getReturnValue = async (web3: Web3, txHash: string): Promise<[string | null, string | null]> => {
    // TODO: Generate Infura API key

    if (txHash.slice(0, 2) !== "0x") {
        txHash = "0x" + txHash;
    }

    if (!txHashRegExp.test(txHash)) {
        throw new Error("Invalid transaction hash.");
    }

    // Extend Web3

    // Get trace from Infura
    // TODO: traceTransaction is very heavy. Look into retrieving the memory and
    // stack at the last execution step instead.
    const response: Trace = await new Promise((resolve: (val: Trace) => void, reject) => web3.currentProvider.send({
        method: "debug_traceTransaction",
        params: [txHash, {}],
        jsonrpc: "2.0",
        id: 2
    }, (e, val) => {
        if (e) { reject(e); return; }
        resolve(val);
    }));

    if (response.error) {
        const error: TraceError = response.error as any;
        if (typeof error === "string") {
            throw new Error(error);
        }
        throw new Error(error.message);
    }

    if (!response.result) {
        throw new Error("No response from Ethereum node");
    }

    const result = response.result;

    if (result.failed) {
        if (result.returnValue.slice(0, 8) === "08c379a0") {
            return [null, web3.eth.abi.decodeParameter("string", result.returnValue.slice(8))];
        } else {
            throw new Error("No revert reason found");
        }
    } else {
        return [`0x${result.returnValue}`, null];
    }
};

export const decodeHex = (hex: string) => {
    let str = "";
    for (let i = 0; (i < hex.length); i += 2) {
        const byte = hex.substr(i, 2);
        if (byte === "00") {
            str += " ";
        } else {
            str += String.fromCharCode(parseInt(byte, 16));
        }
    }
    return str;
};

export const getSource = async (address: string, network: string): Promise<[any[], string]> => {
    // const address = qs.parse(this.props.location.search).address;

    // TODO: Use network param
    const URL = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}`;

    const result = (await axios.get(URL)).data.result[0];

    const source = result.SourceCode ? result.SourceCode
        .replace(/([^\n\s]+)\t/g, "$1\n\t")
        .replace(/([^\n\s]+)    /g, "$1\n    ")
        .replace(/\*\/([^\n])/g, "*/\n$1")
        .replace(/;([^\n])/g, ";\n\n$1")
        .replace(/{([^\n])/g, "{\n$1")
        .replace(/}([^\n])/g, "}\n\n$1")
        : null;

    const abi = result.ABI ? JSON.parse(result.ABI) : null;

    return [abi, source];
};

export const abiOutputMapping = (web3: Web3, abi: any[]): Map<string, any[]> => {
    const map = new Map<string, any[]>();

    for (const entry of abi) {
        if (entry.type === "function") {
            const signature = web3.eth.abi.encodeFunctionSignature(entry);
            map.set(signature, entry.outputs);
        }
    }

    return map;
};
