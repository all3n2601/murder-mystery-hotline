import "@fontsource/limelight/400.css";
import "@fontsource/special-elite/400.css";
import "@fontsource/libre-baskerville/400.css";
import "@fontsource/libre-baskerville/400-italic.css";
import "@fontsource/libre-baskerville/700.css";
import "./styles.css";
import { StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { CASE_ID } from "./controller.js";
import { createDirector } from "./scenes/director.js";
import { useStore } from "./state/store.js";
import { GameScreen } from "./ui/GameScreen.js";
import { IntroOverlay } from "./ui/IntroOverlay.js";
import { TitleScreen } from "./ui/TitleScreen.js";

// Dev only: inspect game state from the console (and from browser tests).
if (import.meta.env.DEV) Object.assign(window, { __store: useStore });

/** The Pixi canvas behind everything. Created once; it follows the store on its own. */
function Stage() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dispose: (() => void) | null = null;
    let cancelled = false;
    void createDirector(host.current!, CASE_ID).then((d) => (cancelled ? d() : (dispose = d)));
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);
  return <div ref={host} className="stage-canvas" />;
}

function App() {
  const screen = useStore((s) => s.screen);
  return (
    <>
      <Stage />
      <div className="overlay">
        {screen === "title" && <TitleScreen />}
        {screen === "intro" && <IntroOverlay />}
        {screen === "game" && <GameScreen />}
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
