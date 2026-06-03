import { decodeChatStream } from "../lib/chat-stream";

/**
 * Vanilla-JS embeddable chat widget. Bundled by widget/build.mjs into
 * public/widget.js as a self-executing script with no runtime dependencies
 * (no React) so it can be dropped into any third-party page with a single
 * `<script>` tag:
 *
 *   <script src="https://your-contextforge-domain/widget.js"
 *           data-endpoint="https://your-contextforge-domain"></script>
 *
 * `data-endpoint` defaults to the origin the script itself was loaded from,
 * which covers the common same-origin embed with zero configuration.
 * Cross-origin embeds work too: /api/chat sends permissive CORS headers.
 */

const STYLE = `
  .cf-bubble{position:fixed;bottom:20px;right:20px;width:52px;height:52px;border-radius:9999px;
    background:#f5a524;color:#0b0e14;border:none;cursor:pointer;font:600 20px system-ui;
    box-shadow:0 4px 16px rgba(0,0,0,.35);z-index:2147483000;}
  .cf-panel{position:fixed;bottom:84px;right:20px;width:340px;max-width:calc(100vw - 40px);
    height:460px;max-height:calc(100vh - 120px);background:#12161f;border:1px solid #232838;
    border-radius:12px;display:none;flex-direction:column;overflow:hidden;
    box-shadow:0 12px 32px rgba(0,0,0,.45);z-index:2147483000;font-family:system-ui,sans-serif;}
  .cf-panel.cf-open{display:flex;}
  .cf-header{padding:10px 14px;border-bottom:1px solid #232838;color:#e6e9f0;font-size:13px;font-weight:600;}
  .cf-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;}
  .cf-msg{max-width:85%;padding:8px 10px;border-radius:8px;font-size:13px;line-height:1.4;white-space:pre-wrap;}
  .cf-msg-user{align-self:flex-end;background:rgba(245,165,36,.12);color:#e6e9f0;}
  .cf-msg-bot{align-self:flex-start;background:#0b0e14;color:#e6e9f0;}
  .cf-badge{display:inline-block;font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
    color:#f5a524;background:rgba(122,84,23,.4);border-radius:4px;padding:1px 5px;margin-bottom:4px;}
  .cf-form{display:flex;gap:6px;padding:10px;border-top:1px solid #232838;}
  .cf-input{flex:1;background:#0b0e14;border:1px solid #232838;border-radius:6px;color:#e6e9f0;
    font-size:13px;padding:7px 9px;}
  .cf-input:focus{outline:none;border-color:rgba(245,165,36,.6);}
  .cf-send{background:#f5a524;color:#0b0e14;border:none;border-radius:6px;font-size:12px;font-weight:600;
    padding:0 12px;cursor:pointer;}
  .cf-send:disabled{opacity:.6;cursor:not-allowed;}
`;

function currentScriptOrigin(): string {
  const script = document.currentScript as HTMLScriptElement | null;
  if (script?.src) {
    try {
      return new URL(script.src).origin;
    } catch {
      /* fall through */
    }
  }
  return window.location.origin;
}

function resolveEndpoint(): string {
  const script = document.currentScript as HTMLScriptElement | null;
  return script?.dataset.endpoint?.replace(/\/$/, "") || currentScriptOrigin();
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) node.append(child);
  return node;
}

function mount() {
  const endpoint = resolveEndpoint();

  const style = el("style", {});
  style.textContent = STYLE;
  document.head.append(style);

  const messages = el("div", { class: "cf-messages" });
  const input = el("input", { class: "cf-input", placeholder: "Ask a question…" }) as HTMLInputElement;
  const sendBtn = el("button", { class: "cf-send", type: "submit" }, "Ask");
  const form = el("form", { class: "cf-form" }, input, sendBtn);

  const panel = el(
    "div",
    { class: "cf-panel" },
    el("div", { class: "cf-header" }, "Ask a question"),
    messages,
    form,
  );

  const bubble = el("button", { class: "cf-bubble", "aria-label": "Open chat" }, "?");
  bubble.addEventListener("click", () => panel.classList.toggle("cf-open"));

  document.body.append(panel, bubble);

  let busy = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question || busy) return;

    busy = true;
    sendBtn.setAttribute("disabled", "true");
    input.value = "";

    messages.append(el("div", { class: "cf-msg cf-msg-user" }, question));
    const botMsg = el("div", { class: "cf-msg cf-msg-bot" }, "…");
    messages.append(botMsg);
    messages.scrollTop = messages.scrollHeight;

    try {
      const res = await fetch(`${endpoint}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let abstained = false;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        const { answer, meta } = decodeChatStream(raw);
        abstained = meta?.status === "abstained";
        botMsg.textContent = answer;
        messages.scrollTop = messages.scrollHeight;
      }

      if (abstained) {
        botMsg.prepend(el("span", { class: "cf-badge" }, "Abstained"));
      }
    } catch {
      botMsg.textContent = "Sorry, something went wrong reaching the answer bot.";
    } finally {
      busy = false;
      sendBtn.removeAttribute("disabled");
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
