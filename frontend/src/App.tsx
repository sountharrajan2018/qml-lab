import { useEffect, useState } from "react";
import EncodingLab from "./EncodingLab";
import Builder from "./pipeline/Builder";
import Pipeline from "./pipeline/Pipeline";

type Mode = "encodings" | "builder" | "guided";
const fromHash = (): Mode =>
  window.location.hash === "#pipeline" ? "builder" : window.location.hash === "#guided" ? "guided" : "encodings";

/**
 * Three screens, each a standalone component:
 *  - the Encoding Lab (how numbers become qubits),
 *  - the Pipeline Builder (data -> encoding -> kernel -> algorithm -> result, all chosen from menus),
 *  - the Guided demo (the fixed six-step lecture walkthrough).
 */
export default function App() {
  const [mode, setMode] = useState<Mode>(fromHash);
  useEffect(() => {
    const onHash = () => setMode(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (m: Mode) => {
    window.location.hash = m === "builder" ? "pipeline" : m === "guided" ? "guided" : "";
    setMode(m);
  };
  if (mode === "builder") return <Builder onOpenEncodings={() => go("encodings")} onOpenGuided={() => go("guided")} />;
  if (mode === "guided") return <Pipeline onOpenEncodings={() => go("encodings")} onOpenBuilder={() => go("builder")} />;
  return <EncodingLab onOpenPipeline={() => go("builder")} />;
}
