export async function fetchPortalUrl(app) {
  try {
    const response = await fetch(`/v1/portals/${app}/url`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Portal URL fetch failed [${response.status}]`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch portal URL:', error);
    return null;
  }
}
