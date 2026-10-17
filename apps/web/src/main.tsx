import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <main style={{ fontFamily: "Georgia, serif", padding: 32 }}>
      <h1>Murder Mystery Hotline</h1>
      <p>Switchboard coming on Day 2.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
