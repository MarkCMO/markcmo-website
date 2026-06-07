// WETYR Film Search - TMDB proxy for searching any film, TV, or person + detail.
// Runs on Cloudflare via the function wrapper. Uses TMDB_API_KEY (same as film-intel).
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

async function tmdb(path, params, key) {
  const url = new URL(TMDB + path);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const headers = { 'Accept': 'application/json' };
  if (key && key.startsWith('eyJ')) headers['Authorization'] = 'Bearer ' + key;
  else if (key) url.searchParams.set('api_key', key);
  const r = await fetch(url.toString(), { headers });
  if (!r.ok) throw new Error('TMDB ' + path + ': ' + r.status);
  return r.json();
}

function shapeDetail(d, mediaType) {
  if (!d) return null;
  const isTV = mediaType === 'tv';
  return {
    id: d.id, mediaType,
    title: d.title || d.name,
    tagline: d.tagline,
    overview: d.overview,
    runtime: d.runtime || (Array.isArray(d.episode_run_time) ? d.episode_run_time[0] : null),
    releaseDate: d.release_date || d.first_air_date,
    genres: (d.genres || []).map(g => g.name),
    budget: d.budget, revenue: d.revenue,
    voteAverage: d.vote_average, voteCount: d.vote_count,
    imdbId: (d.external_ids || {}).imdb_id,
    poster: d.poster_path ? IMG + '/w500' + d.poster_path : null,
    backdrop: d.backdrop_path ? IMG + '/w1280' + d.backdrop_path : null,
    seasons: isTV ? d.number_of_seasons : null,
    episodes: isTV ? d.number_of_episodes : null,
    networks: isTV ? (d.networks || []).map(n => n.name).slice(0, 4) : null,
    productionCompanies: (d.production_companies || []).map(c => c.name).slice(0, 5),
    cast: ((d.credits || {}).cast || []).slice(0, 8).map(c => ({ id: c.id, name: c.name, character: c.character })),
    crew: ((d.credits || {}).crew || []).filter(c => ['Director', 'Producer', 'Director of Photography', 'Editor', 'Original Music Composer', 'Screenplay', 'Writer', 'Creator'].includes(c.job)).slice(0, 8).map(c => ({ id: c.id, name: c.name, job: c.job })),
    watchProviders: ((d['watch/providers'] || {}).results || {}).US || null,
    videos: ((d.videos || {}).results || []).filter(v => v.site === 'YouTube' && v.type === 'Trailer').slice(0, 1),
  };
}

function shapePersonDetail(p) {
  if (!p) return null;
  const credits = ((p.combined_credits || {}).cast || [])
    .concat(((p.combined_credits || {}).crew || []))
    .filter(c => c.poster_path || c.vote_count > 50)
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 12)
    .map(c => ({ id: c.id, mediaType: c.media_type, title: c.title || c.name, character: c.character || c.job, date: c.release_date || c.first_air_date, poster: c.poster_path ? IMG + '/w342' + c.poster_path : null }));
  return {
    id: p.id, name: p.name, person: true,
    department: p.known_for_department,
    biography: p.biography,
    birthday: p.birthday, placeOfBirth: p.place_of_birth,
    imdbId: (p.external_ids || {}).imdb_id,
    profile: p.profile_path ? IMG + '/w500' + p.profile_path : null,
    knownFor: credits,
  };
}

exports.handler = async (event) => {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=600' };
  const key = process.env.TMDB_API_KEY;
  if (!key) return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: false, reason: 'TMDB_API_KEY missing' }) };
  const qp = event.queryStringParameters || {};
  try {
    // Detail by id
    if (qp.id) {
      const type = qp.type === 'tv' ? 'tv' : qp.type === 'person' ? 'person' : 'movie';
      if (type === 'person') {
        const p = await tmdb('/person/' + qp.id, { append_to_response: 'combined_credits,external_ids' }, key);
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, detail: shapePersonDetail(p) }) };
      }
      const d = await tmdb('/' + type + '/' + qp.id, { language: 'en-US', append_to_response: 'credits,watch/providers,external_ids,videos' }, key);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, detail: shapeDetail(d, type) }) };
    }
    // Upcoming
    if (qp.upcoming) {
      const u = await tmdb('/movie/upcoming', { language: 'en-US', region: 'US', page: 1 }, key);
      const list = (u.results || []).slice(0, 15).map(m => ({ id: m.id, mediaType: 'movie', title: m.title, date: m.release_date, poster: m.poster_path ? IMG + '/w342' + m.poster_path : null, voteAverage: m.vote_average, overview: m.overview, popularity: m.popularity }));
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, upcoming: list }) };
    }
    // Search (multi: movies, TV, people)
    const q = (qp.q || '').trim();
    if (!q) return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, results: [] }) };
    const s = await tmdb('/search/multi', { query: q, language: 'en-US', include_adult: 'false', page: 1 }, key);
    const results = (s.results || [])
      .filter(r => ['movie', 'tv', 'person'].includes(r.media_type))
      .slice(0, 20)
      .map(r => r.media_type === 'person'
        ? { id: r.id, mediaType: 'person', title: r.name, department: r.known_for_department, poster: r.profile_path ? IMG + '/w185' + r.profile_path : null, knownForText: (r.known_for || []).map(k => k.title || k.name).filter(Boolean).slice(0, 3).join(', ') }
        : { id: r.id, mediaType: r.media_type, title: r.title || r.name, date: r.release_date || r.first_air_date, poster: r.poster_path ? IMG + '/w342' + r.poster_path : null, voteAverage: r.vote_average, voteCount: r.vote_count, overview: r.overview, popularity: r.popularity });
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, query: q, results }) };
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
