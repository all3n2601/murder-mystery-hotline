// Evidence text, one entry per line in case.json. A line that starts with a time ("1:15",
// "1:30–1:50") becomes a timeline row; anything else (a note) is set apart below.

const TIME = /^(\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?)\s+(.*)$/;

export function EvidenceText({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return <p>{text}</p>;
  const rows = lines.map((l) => TIME.exec(l));
  return (
    <>
      <ul className="log-lines">
        {rows.map((m, i) =>
          m ? (
            <li key={i}>
              <time>{m[1]}</time>
              <span>{m[2]}</span>
            </li>
          ) : null,
        )}
      </ul>
      {lines
        .filter((_, i) => !rows[i])
        .map((l, i) => (
          <p key={i} className="log-note">
            {l}
          </p>
        ))}
    </>
  );
}
