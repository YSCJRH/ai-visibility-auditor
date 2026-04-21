import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("AnswerLens admin root element was not found.");
}

const mountNode = rootElement;
const adminWindow = window as Window & { __ANSWERLENS_ADMIN_READY?: boolean };

function renderError(error: unknown): void {
  const detail = error instanceof Error ? `${error.message}\n\n${error.stack ?? ""}` : String(error);
  mountNode.innerHTML = `<pre style="margin:16px;padding:16px;border:1px solid #ff00ff;background:#090014;color:#ff8080;white-space:pre-wrap;font:13px/1.6 monospace;">AnswerLens Admin failed to render.\n\n${detail}</pre>`;
  console.error(error);
}

async function boot(): Promise<void> {
  try {
    const { App } = await import("./app/App");
    ReactDOM.createRoot(mountNode).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    adminWindow.__ANSWERLENS_ADMIN_READY = true;
  } catch (error) {
    renderError(error);
  }
}

void boot();
