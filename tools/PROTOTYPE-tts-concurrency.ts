// PROTOTYPE: open TTS sessions one by one until the account cap is hit, then Terminate all.
import WebSocket from "ws";
const KEY = process.env.ASSEMBLYAI_API_KEY!;
const socks: WebSocket[] = [];
for (let i = 1; i <= 8; i++) {
  const r = await new Promise<string>((resolve) => {
    const ws = new WebSocket("wss://streaming-tts.assemblyai.com/v1/ws?voice=eve", { headers: { Authorization: KEY } });
    socks.push(ws);
    ws.on("message", (d) => {
      const j = JSON.parse(d.toString());
      resolve(j.type === "Begin" ? "Begin" : `${j.type} ${j.error_code ?? ""} ${j.error ?? ""}`);
    });
    ws.on("close", (c) => resolve(`close ${c}`));
    setTimeout(() => resolve("timeout"), 5000);
  });
  console.log(`session ${i}: ${r}`);
  if (r !== "Begin") break;
}
for (const ws of socks) if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "Terminate" }));
await new Promise((r) => setTimeout(r, 1500));
for (const ws of socks) ws.close();
process.exit(0);
