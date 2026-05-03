import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./packages/core/style.css";
import "./packages/sheet/style.css";
import "./packages/doc/style.css";
import "./packages/slides/style.css";

createRoot(document.getElementById("root")!).render(<App />);
