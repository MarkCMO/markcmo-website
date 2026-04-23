// WETYR Film Intel - free TMDB proxy for the live demo dashboard.
// Requires TMDB_API_KEY env var (v4 read token or v3 key, both work).
// Netlify free tier: 125k invocations/month. Cached 1hr in-memory per cold start.

const TMDB = 'https://api.themoviedb.org/3';

let cache = { at: 0, data: null };
const TTL_MS = 60 * 60 * 1000; // 1 hour

async function tmdbGet(path, params, key) {
  const url = new URL(TMDB + path);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers = { 'Accept': 'application/json' };
  // v4 bearer (starts with eyJ) vs v3 api_key
  if (key && key.startsWith('eyJ')) {
    headers['Authorization'] = 'Bearer ' + key;
  } else if (key) {
    url.searchParams.set('api_key', key);
  }

  const r = await fetch(url.toString(), { headers });
  if (!r.ok) throw new Error('TMDB ' + path + ': ' + r.status);
  return r.json();
}

exports.handler = async () => {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, reason: 'TMDB_API_KEY missing', fallback: true })
    };
  }

  // Serve from cache if fresh
  if (cache.data && Date.now() - cache.at < TTL_MS) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' },
      body: JSON.stringify({ ok: true, cached: true, ...cache.data })
    };
  }

  try {
    const [trending, nowPlaying, featured] = await Promise.all([
      tmdbGet('/trending/movie/week', { language: 'en-US' }, key),
      tmdbGet('/movie/now_playing', { language: 'en-US', region: 'US', page: 1 }, key),
      tmdbGet('/trending/movie/day', { language: 'en-US' }, key)
    ]);

    // Fetch full details + credits + watch providers for TOP 5 trending titles
    // so the frontend can rotate through them with full data (budget, cast, crew, trailer, etc.)
    const topIds = (featured.results || trending.results || []).slice(0, 5).map(m => m.id).filter(Boolean);
    const featuredDetails = await Promise.all(topIds.map(async id => {
      try {
        return await tmdbGet('/movie/' + id, {
          language: 'en-US',
          append_to_response: 'credits,watch/providers,external_ids,videos'
        }, key);
      } catch (e) { return null; }
    }));
    const featuredDetail = featuredDetails.find(Boolean) || null;

    function shapeDetail(d) {
      if (!d) return null;
      return {
        id: d.id,
        title: d.title,
        tagline: d.tagline,
        overview: d.overview,
        runtime: d.runtime,
        releaseDate: d.release_date,
        genres: (d.genres || []).map(g => g.name),
        budget: d.budget,
        revenue: d.revenue,
        voteAverage: d.vote_average,
        voteCount: d.vote_count,
        imdbId: (d.external_ids || {}).imdb_id,
        poster: d.poster_path ? 'https://image.tmdb.org/t/p/w500' + d.poster_path : null,
        backdrop: d.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + d.backdrop_path : null,
        productionCompanies: (d.production_companies || []).map(c => c.name).slice(0, 5),
        productionCountries: (d.production_countries || []).map(c => c.name),
        cast: ((d.credits || {}).cast || []).slice(0, 8).map(c => ({ id: c.id, name: c.name, character: c.character })),
        crew: ((d.credits || {}).crew || []).filter(c => ['Director', 'Producer', 'Director of Photography', 'Editor', 'Original Music Composer', 'Screenplay', 'Writer'].includes(c.job)).slice(0, 8).map(c => ({ id: c.id, name: c.name, job: c.job })),
        watchProviders: ((d['watch/providers'] || {}).results || {}).US || null,
        videos: ((d.videos || {}).results || []).filter(v => v.site === 'YouTube' && v.type === 'Trailer').slice(0, 1)
      };
    }

    const payload = {
      trending: (trending.results || []).slice(0, 10).map(m => ({
        id: m.id,
        title: m.title,
        date: m.release_date,
        voteAverage: m.vote_average,
        voteCount: m.vote_count,
        popularity: m.popularity,
        poster: m.poster_path ? 'https://image.tmdb.org/t/p/w342' + m.poster_path : null,
        overview: m.overview
      })),
      nowPlaying: (nowPlaying.results || []).slice(0, 10).map(m => ({
        id: m.id,
        title: m.title,
        date: m.release_date,
        voteAverage: m.vote_average,
        voteCount: m.vote_count,
        popularity: m.popularity,
        poster: m.poster_path ? 'https://image.tmdb.org/t/p/w342' + m.poster_path : null,
        overview: m.overview
      })),
      featured: shapeDetail(featuredDetail),
      featuredList: featuredDetails.map(shapeDetail).filter(Boolean),
      updatedAt: new Date().toISOString()
    };

    cache = { at: Date.now(), data: payload };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' },
      body: JSON.stringify({ ok: true, cached: false, ...payload })
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: e.message, fallback: true })
    };
  }
};
