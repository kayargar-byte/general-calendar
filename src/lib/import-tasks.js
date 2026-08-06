const IMPORTS_ENDPOINT =
  import.meta.env.VITE_AI_IMPORTS_ENDPOINT ??
  "http://localhost:3000/api/imports";
const IMPORTS_PROXY_KEY = import.meta.env.VITE_AI_PROXY_KEY ?? "";

function headers() {
  if (!IMPORTS_PROXY_KEY) {
    throw new Error("未設定 VITE_AI_PROXY_KEY，請參閱 README 的 AI 功能設定。");
  }

  return { "X-Proxy-Key": IMPORTS_PROXY_KEY };
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message ?? "匯入任務請求失敗。");
  }

  return data;
}

export async function submitImport(file, calendars, profile = "") {
  const form = new FormData();
  form.append("file", file);
  form.append("calendars", JSON.stringify(calendars));
  form.append("profile", profile);

  const response = await fetch(IMPORTS_ENDPOINT, {
    method: "POST",
    headers: headers(),
    body: form,
  });
  return (await readResponse(response)).task;
}

export async function listImports() {
  const response = await fetch(IMPORTS_ENDPOINT, { headers: headers() });
  return (await readResponse(response)).imports ?? [];
}

export async function retryImport(id) {
  const response = await fetch(`${IMPORTS_ENDPOINT}/${id}/retry`, {
    method: "POST",
    headers: headers(),
  });
  return (await readResponse(response)).task;
}

export async function ackImport(id) {
  const response = await fetch(`${IMPORTS_ENDPOINT}/${id}/ack`, {
    method: "POST",
    headers: headers(),
  });
  return (await readResponse(response)).ok === true;
}
