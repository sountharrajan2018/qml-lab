import "katex/dist/katex.min.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import EncodingLab from "./EncodingLab";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EncodingLab />
  </StrictMode>,
);
