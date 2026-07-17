export async function fetchPortalUrl(app) {
  try {
    const response = await fetch(`/v1/portals/${app}/url`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { error: body.error || `Portal URL fetch failed [${response.status}]` };
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch portal URL:', error);
    return { error: error.message || 'Portal URL fetch failed' };
  }
}
