// Shared normalizer: only media-specific CC0 grants a preview or embedded viewer.
export const topics = {
  space: 'spacecraft',
  aviation: 'aviation',
  science: 'invention',
  history: 'culture',
  art: 'art',
  nature: 'fossil',
  maps: '',
  models: ''
};
export function clean(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim().slice(0, 12000);
}
export function safeUrl(value, media = false) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    url.protocol = 'https:';
    if (media && !['ids.si.edu', '3d-api.si.edu'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
export function normalize(row) {
  const c = row.content || {}, f = c.freetext || {}, n = c.descriptiveNonRepeating || {}, s = c.indexedStructured || {};
  const fields = name => (Array.isArray(f[name]) ? f[name] : []).slice(0, 30).map(v => ({ label: clean(v.label), value: clean(v.content) }));
  const images = [], models = [];
  for (const m of (n.online_media?.media || [])) {
    if (m.usage?.access !== 'CC0') continue;
    if (m.type === 'Images') {
      const thumb = safeUrl(m.thumbnail, true);
      const screen = safeUrl(m.resources?.find(r => r.label === 'Screen Image')?.url, true);
      const original = safeUrl(m.content, true);
      const urls = [...new Set([thumb, screen, original].filter(Boolean))];
      if (urls.length && images.length < 12) images.push({ id: clean(m.idsId || m.id), thumb: urls[0], display: screen || original || urls[0], alternatives: urls, rights: 'CC0', alt: clean(m.altTextAccessibility) });
    }
    if (m.type === '3d_voyager') {
      const url = safeUrl(m.content, true);
      if (url && /^https:\/\/3d-api\.si\.edu\/voyager\/3d_package:[a-f\d-]{36}\/?$/i.test(url)) models.push({ url, rights: 'CC0' });
    }
  }
  return {
    id: clean(n.record_ID || row.id), title: clean(row.title || n.title?.content),
    source: safeUrl(n.record_link) || safeUrl(n.guid), museum: clean(n.data_source || row.unitCode),
    types: (s.object_type || []).slice(0, 15).map(clean), dates: fields('date'), places: fields('place'),
    people: fields('name'), notes: fields('notes'), credits: fields('creditLine'), rights: fields('objectRights'),
    metadataRights: clean(n.metadata_usage?.access), images, models,
    // Indexed decades are discovery hints, never asserted as capture dates.
    indexedDates: (s.date || []).slice(0, 30).map(clean)
  };
}
