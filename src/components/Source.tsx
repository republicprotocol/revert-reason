import * as React from "react";

import "brace";
import AceEditor from "react-ace";
// tslint:disable-next-line:no-var-requires
require("../lib/mode-solidity");

import "brace/theme/dracula";
import "brace/theme/github";

interface SourceProps {
    source: string;
    search: string | null;
}

interface SourceState {
    markers: any[];
}

class Source extends React.Component<SourceProps, SourceState> {
    constructor(props: SourceProps) {
        super(props);

        this.state = {
            markers: [],
        };
    }

    public onLoad = (editor: any) => {
        const session = editor.getSession();

        // Disable Ace's find function
        editor.commands.removeCommand("find");

        // Set line height
        editor.container.style.lineHeight = 1.1;
        editor.renderer.updateFontSize();

        // Wrap long lines
        session.setUseWrapMode(true);


        const row = this.getMarkers();
        const markers = [];
        markers.push({ startRow: row, startCol: 0, endRow: row + 1, endCol: 0, className: "highlighMarker", type: "text" });
        this.setState({ markers });
        editor.gotoLine(row + 1);

        // // When the editor content is changed, recalculate editor height (to avoid scrolling)
        // const onChange = (arg: any, activeEditor: any) => {
        //     const aceEditor = activeEditor;
        //     const newHeight = (aceEditor.getSession().getScreenLength() *
        //         aceEditor.renderer.lineHeight) + (aceEditor.renderer.scrollBar.getWidth() || 9);
        //     aceEditor.container.style.height = `${newHeight}px`;
        //     aceEditor.resize();
        // };

        // editor.on("change", onChange);
        // onChange(null, editor);
    }

    public render() {

        return <AceEditor
            mode="javascript"
            theme="github"
            // onChange={this.onChange}
            name="editor"
            width="100%"
            fontSize={16}
            onLoad={this.onLoad}
            height="200px"
            // editorProps={{ $blockScrolling: true }}
            value={this.props.source}
            markers={this.state.markers}
        />;
    }

    private getMarkers = (): number => {
        const { source, search } = this.props;
        if (!search) {
            return 0;
        }

        const source2 = source.split("\n");
        let n;
        for (n = 0; n < source2.length; n++) {
            if (source2[n].includes(search)) {
                return n;
            }
        }
        return 0;
    }

}

export default Source;
