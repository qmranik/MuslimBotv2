async function frappeCall(method, args = {}) {
  const url = `/api/method/${method}`;
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(args).filter(([, v]) => v !== '' && v != null))
  ).toString();
  const fullUrl = params ? `${url}?${params}` : url;
  const response = await fetch(fullUrl, {
    headers: { Accept: 'application/json', 'X-Frappe-CSRF-Token': 'None' },
  });
  if (!response.ok) {
    throw new Error(`Portal URL fetch failed [${response.status}]`);
  }
  const data = await response.json();
  return data.message;
}

export async function fetchPortalUrl(app) {
  try {
    return await frappeCall('small_erp.api.genui.get_portal_url', { app });
  } catch {
    return null;
  }
}
