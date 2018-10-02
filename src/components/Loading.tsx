import * as React from "react";

import "../styles/Loading.css";

interface LoadingProps {
}

interface LoadingState {
}

/**
 * Loading is a visual component that renders a spinning animation
 */
class Loading extends React.Component<LoadingProps, LoadingState> {
    public render(): JSX.Element {
        return (
            <div id="loader" />
        );
    }
}

export default Loading;
