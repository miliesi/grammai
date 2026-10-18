import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import ReactDOM from "react-dom";
import {
  Editor,
  EditorState,
  ContentState,
  RichUtils,
  convertToRaw,
} from "draft-js";

function Fixture() {
  const [state, setState] = useState(() =>
    EditorState.createWithContent(
      ContentState.createFromText("Wir treffen uns morgen in Berlin."),
    ),
  );
  const current = useRef(state);
  const logs = useRef([]);
  const blockPastes = useRef(false);
  const change = (next) => {
    current.current = next;
    logs.current.push({
      text: next.getCurrentContent().getPlainText("\n"),
      selection: next.getSelection().toJS(),
    });
    setState(next);
  };
  window.draftFixture = {
    text: () => current.current.getCurrentContent().getPlainText("\n"),
    selection: () => current.current.getSelection().toJS(),
    logs: () => logs.current,
    blockPastes: (blocked) => {
      blockPastes.current = blocked;
    },
    reset: (text) =>
      change(EditorState.createWithContent(ContentState.createFromText(text))),
    raw: () => convertToRaw(current.current.getCurrentContent()),
  };
  return (
    <main>
      <h1>Real controlled Draft.js editor</h1>
      <div
        className="editor"
        onClick={() => document.querySelector("[contenteditable=true]").focus()}
      >
        <Editor
          editorState={state}
          onChange={change}
          ariaLabel="Draft editor"
          stripPastedStyles={true}
          handlePastedText={() =>
            blockPastes.current ? "handled" : "not-handled"
          }
          handleKeyCommand={(command) => {
            const next = RichUtils.handleKeyCommand(current.current, command);
            if (next) {
              change(next);
              return "handled";
            }
            return "not-handled";
          }}
        />
      </div>
      <output id="model">{state.getCurrentContent().getPlainText("\n")}</output>
    </main>
  );
}
if (location.hash === "#legacy")
  ReactDOM.render(<Fixture />, document.querySelector("#root"));
else createRoot(document.querySelector("#root")).render(<Fixture />);
