import * as React from "react";
import Search from "./Search";

interface HomeState {
}

interface HomeProps {
}

class Home extends React.Component<HomeProps, HomeState> {

    constructor(props: HomeProps, context: object) {
        super(props, context);
        this.state = {
        };
    }

    public render() {
        return <div>
            <Search onSubmit={this.onSubmit} />
        </div>;
    }

    public onSubmit = async () => {
        //
    }
}

export default Home;
