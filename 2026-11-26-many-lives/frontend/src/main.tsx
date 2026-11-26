// frontend/src/main.tsx: entry. fonts are bundled locally so no font service sees you.
import "@fontsource-variable/fraunces";
import "@fontsource-variable/newsreader";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/caveat/500.css";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
