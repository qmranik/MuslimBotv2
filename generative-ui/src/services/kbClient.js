/**
 * Knowledge Base API client — proxied via /kb-api to Muslimbot KB BFF.
 * No GCP credentials in the browser.
 */

async function kbFetch(path, options = {}) {
  const url = `/v1/kb${path}`;
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`KB API [${response.status}]: ${text.slice(0, 200)}`);
  }
  return response.json();
}

export async function checkKbHealth() {
  try {
    return await kbFetch('/health');
  } catch {
    return { status: 'error', indexed_sources: 0 };
  }
}

export async function listSources({ page = 1, pageSize = 20, status = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (status) params.set('status', status);
  return kbFetch(`/sources?${params}`);
}

export async function getSourceStatus(sourceId) {
  return kbFetch(`/sources/${encodeURIComponent(sourceId)}`);
}

export async function uploadDocument(file, title, sourceType = 'document') {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title || file.name);
  form.append('source_type', sourceType);
  return kbFetch('/sources/upload', { method: 'POST', body: form });
}

export async function addUrlSource({ title = '', url, depth }) {
  const body = { title, url };
  if (depth !== undefined && depth !== null) {
    body.depth = depth;
  }
  return kbFetch('/sources/url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function classifyUrl(url) {
  return kbFetch('/sources/url/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

export async function createVoiceSession({ roomName = '', participantName = '' } = {}) {
  return kbFetch('/voice/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room_name: roomName,
      participant_name: participantName || 'Knowledge Hub User',
    }),
  });
}

export async function addLink(title, url) {
  const form = new FormData();
  form.append('title', title);
  form.append('url', url);
  return kbFetch('/sources/link', { method: 'POST', body: form });
}

export async function addScrapeSource(title, url, depth = 1) {
  const form = new FormData();
  form.append('title', title);
  form.append('url', url);
  form.append('depth', String(depth));
  return kbFetch('/sources/scrape', { method: 'POST', body: form });
}

export async function addBulkImport(title, content, pagesJson = '') {
  const form = new FormData();
  form.append('title', title);
  form.append('content', content || '');
  form.append('pages_json', pagesJson || '');
  return kbFetch('/sources/bulk', { method: 'POST', body: form });
}

export async function triggerSync(sourceId) {
  return kbFetch(`/sources/${encodeURIComponent(sourceId)}/sync`, { method: 'POST' });
}

export async function deleteSource(sourceId) {
  return kbFetch(`/sources/${encodeURIComponent(sourceId)}`, { method: 'DELETE' });
}

export async function testRetrieve(query, topK = 8) {
  return kbFetch('/retrieve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK }),
  });
}

export async function testChat(message, sessionId = '') {
  return kbFetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
}

export async function getVoiceBriefPreview() {
  return kbFetch('/voice-brief');
}
