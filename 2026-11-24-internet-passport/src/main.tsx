// src/main.tsx
// entry point. fonts are bundled locally, nothing is loaded from other sites.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/fraunces/wght-italic.css";
import "@fontsource/work-sans/400.css";
import "@fontsource/work-sans/600.css";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";
import "@fontsource/caveat/500.css";
import "./styles.css";
import { PassportProvider } from "./lib/store";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PassportProvider>
      <App />
    </PassportProvider>
  </StrictMode>,
);
