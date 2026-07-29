import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Uygulama kök öğesi bulunamadı.");
}

createRoot(rootElement).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);
