import * as React from "react";

import { Transaction } from "web3/types";

import Loading from "./Loading";

import { abiOutputMapping, getReturnValue, getSource, getWeb3, Response, ResponseStatus } from "../lib/api";
import Search from "./Search";
import Source from "./Source";

interface WhyState {
    transactionReturn: Response | null;
    returnValues: string[] | null;
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
            transactionReturn: null,
            source: null,
            returnValues: null,
        };
    }

    public render() {
        const { error, transactionReturn, loading, source } = this.state;

        let errorBlock;
        if (error) {
            errorBlock = <div className="block block-error">
                {error ? <p className="error red">{error.message}</p> : null}
            </div>;
        }

        let resultBlock;
        if (transactionReturn) {

            let inner;

            switch (transactionReturn.status) {
                case ResponseStatus.BAD_INSTRUCTION:
                case ResponseStatus.BAD_JUMP:
                case ResponseStatus.OUT_OF_GAS:
                    inner = <span className="red">{transactionReturn.reason}</span>;
                    break;
                case ResponseStatus.REVERTED:
                    inner = <>
                        <span className="red">Revert reason: </span>
                        {transactionReturn.reason || "No revert reason found"}
                    </>;
                    break;
                case ResponseStatus.SUCCESS:
                    let returnValue = transactionReturn.reason;
                    if (this.state.returnValues) {
                        returnValue = this.state.returnValues.map(x => x.toString()).join(", ");
                    }
                    inner = <>
                        <span className="green">Return value: </span>
                        {returnValue}
                    </>;
                    break;
            }

            resultBlock = <div className="block"><div className="result">{inner}</div></div>;
        }

        // TODO: Show all instances of revert reason in code (multiple Source
        // instances)

        return <div className="Reason">
            <Search onSubmit={this.onSubmit} />
            {loading ? <Loading /> : null}

            {errorBlock}
            {resultBlock}
            {source && transactionReturn && transactionReturn.reason ? <div className="block">
                <Source search={transactionReturn.reason} source={source} />
            </div> : null}
        </div>;
    }

    private onSubmit = async (txHash: string, network: string) => {

        this.setState({ loading: true, error: null, transactionReturn: null, returnValues: null, source: null });

        const web3 = getWeb3(network);

        let tx;
        let transactionReturn;
        try {
            tx = await new Promise((resolve: (val: Transaction) => void, reject) =>
                web3.eth.getTransaction(txHash, (e, val) => {
                    if (e) { reject(e); return; }
                    resolve(val);
                }));

            if (tx === null) {
                throw new Error("Unable to find transaction");
            }

            transactionReturn = await getReturnValue(web3, tx);
            this.setState({ loading: false, transactionReturn });
        } catch (error) {
            this.setState({ loading: false, error });
            return;
        }

        const [abi, source] = await getSource(tx.to, network);

        if (transactionReturn.status === ResponseStatus.SUCCESS && abi) {
            const outputMapping = abiOutputMapping(web3, abi);
            const signature = tx.input.slice(0, 10);
            const outputs = outputMapping.get(signature);

            if (outputs) {
                const returnValuesObj = web3.eth.abi.decodeParameters(outputs.map(output => output.type), transactionReturn.reason);
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
        } else if (transactionReturn.status === ResponseStatus.REVERTED && transactionReturn.reason && source) {
            this.setState({ source });
        }
    }
}

export default Why;
