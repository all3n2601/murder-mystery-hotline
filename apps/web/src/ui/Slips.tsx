// Status shown inside the fiction: the busy lamp, a missing receiver, a dropped line,
// and server errors as an operator's note.

import { useEffect } from "react";
import { actions } from "../controller.js";
import type { Layout } from "../layout.js";
import { useStore } from "../state/store.js";

export function Slips({ layout }: { layout: Layout }) {
  const busy = useStore((s) => s.busy);
  const mic = useStore((s) => s.mic);
  const link = useStore((s) => s.link);
  const error = useStore((s) => s.error);
  const set = useStore((s) => s.set);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => set({ error: null }), 6000);
    return () => clearTimeout(t);
  }, [error, set]);

  return (
    <div className="slips" style={{ left: layout.stage.x, width: layout.stage.w, top: layout.stage.y + 16 }} role="status">
      {busy && <div className="slip busy">ALL LINES BUSY · HOLD, PLEASE</div>}
      {mic === "denied" && <div className="slip">No receiver: type your questions below.</div>}
      {mic === "unknown" && <div className="slip">Waiting on the receiver: allow the microphone to talk, or type meanwhile.</div>}
      {link === "reconnecting" && <div className="slip">Line dropped… reconnecting.</div>}
      {link === "offline" && (
        <div className="slip">
          The exchange has gone quiet. <button onClick={actions.retryLine}>Ring again</button>
        </div>
      )}
      {error && (
        <div className="slip" role="alert">
          <span>Operator's note: {error.message}</span>
          <button onClick={() => set({ error: null })} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
