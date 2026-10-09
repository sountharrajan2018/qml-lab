import { useState } from "react";
import EncodingLab from "./EncodingLab";
import Pipeline from "./pipeline/Pipeline";

/** Two screens: the Encoding Lab and the full QML Pipeline. Each is a standalone component. */
export default function App() {
  const [mode, setMode] = useState<"encodings" | "pipeline">(() =>
    window.location.hash === "#pipeline" ? "pipeline" : "encodings",
  );
  const go = (m: "encodings" | "pipeline") => {
    window.location.hash = m === "pipeline" ? "pipeline" : "";
    setMode(m);
  };
  return mode === "pipeline" ? (
    <Pipeline onOpenEncodings={() => go("encodings")} />
  ) : (
    <EncodingLab onOpenPipeline={() => go("pipeline")} />
  );
}
