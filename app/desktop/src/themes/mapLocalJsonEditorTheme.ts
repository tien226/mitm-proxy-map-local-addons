import { githubDarkTheme, type Theme } from "json-edit-react";

/** High-contrast JSON editor theme aligned with TFT Proxy dark UI. */
export const tftMapLocalJsonTheme: Theme = {
  ...githubDarkTheme,
  displayName: "TFT Proxy",
  styles: {
    ...githubDarkTheme.styles,
    container: {
      backgroundColor: "#0d1117",
      color: "#e8eaed",
    },
    collection: {
      backgroundColor: "transparent",
      color: "#e8eaed",
    },
    collectionInner: {
      backgroundColor: "transparent",
      color: "#e8eaed",
    },
    collectionElement: {
      backgroundColor: "transparent",
      color: "#e8eaed",
    },
    property: "#79c0ff",
    bracket: "#e8eaed",
    itemCount: "#8b949e",
    string: "#ce9178",
    number: "#b5cea8",
    boolean: {
      color: "#56d4dd",
      fontSize: "90%",
      fontWeight: "bold",
    },
    null: "#569cd6",
    input: {
      backgroundColor: "#161b22",
      color: "#e8eaed",
      border: "1px solid #484f58",
    },
    inputHighlight: {
      backgroundColor: "rgba(88, 166, 255, 0.25)",
      color: "#ffffff",
    },
    iconCollection: "#79c0ff",
    iconEdit: "#79c0ff",
    iconDelete: "#f85149",
    iconAdd: "#3fb950",
    iconCopy: "#79c0ff",
    iconOk: "#3fb950",
    iconCancel: "#f85149",
  },
};
