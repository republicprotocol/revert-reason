import * as React from "react";

import { Transaction } from "web3/types";

import Loading from "./Loading";

import { abiOutputMapping, getReturnValue, getSource, getWeb3 } from "../lib/web3";
import Search from "./Search";
import Source from "./Source";

interface WhyState {
    reason: string | null;
    returnRaw: string | null;
    returnValues: any[] | null;
    error: Error | null;
    loading: boolean;
    source: string | null;
}

interface WhyProps {
}

class Why extends React.Component<WhyProps, WhyState> {

    constructor(props: WhyProps, context: object) {
        super(props, context);
        this.state = {
            error: null,
            loading: false,
            reason: null,
            returnRaw: null,
            returnValues: null,
            source: null,
        };
    }

    public render() {
        const { error, reason, loading, returnRaw, returnValues, source } = this.state;

        let resultBlock;
        if (error || reason || returnRaw || returnValues) {
            resultBlock = <div className="block">
                {returnRaw || returnValues ?
                    <p className="returnRaw"><span className="green">Return value: </span>
                        {returnValues ? returnValues.map(x => x.toString()).join(", ") : returnRaw}
                    </p> : null}
                {error ? <p className="error red">{error.message}</p> : null}
                {reason ? <p className="reason"><span className="red">Revert reason: </span>{reason}</p> : null}
            </div>;
        }

        return <div className="Reason">
            <Search onSubmit={this.onSubmit} />
            {loading ? <Loading /> : null}

            {resultBlock}
            {source ? <div className="block">
                <Source search={reason} source={source} />
            </div> : null}
        </div>;
    }

    private onSubmit = async (txHash: string, network: string) => {

        this.setState({ loading: true, error: null, reason: null, returnRaw: null, returnValues: null, source: null });

        const web3 = getWeb3(network);

        let returnRaw;
        let reason;
        try {
            [returnRaw, reason] = await getReturnValue(web3, txHash);
            this.setState({ loading: false, reason, returnRaw });
        } catch (error) {
            this.setState({ loading: false, error });
            return;
        }

        const tx = await new Promise((resolve: (val: Transaction) => void, reject) =>
            web3.eth.getTransaction(txHash, (e, val) => {
                if (e) { reject(e); return; }
                resolve(val);
            }));

        const [abi, source] = await getSource(tx.to, network);

        if (returnRaw && abi) {
            const outputMapping = abiOutputMapping(web3, abi);
            const signature = tx.input.slice(0, 10);
            const outputs = outputMapping.get(signature);

            if (outputs) {
                const returnValuesObj = web3.eth.abi.decodeParameters(outputs.map(output => output.type), returnRaw);
                let returnValues: any[] = [];
                for (const returnValue in returnValuesObj) {
                    if (returnValuesObj.hasOwnProperty(returnValue) && !isNaN(parseInt(returnValue, 10))) {
                        returnValues.push(returnValuesObj[returnValue]);
                    }
                }
                if (returnValues.length === 0) {
                    returnValues = ["(no return value)"];
                }
                this.setState({ returnValues });
            }
        } else if (reason && source) {
            this.setState({ source });
        }
    }
}

export default Why;
