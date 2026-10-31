const COHERE_ENDPOINT = 'https://api.cohere.com/v2/rerank';

function isConfigured() {
  const key = String(process.env.COHERE_API_KEY || '').trim();
  return Boolean(key) && !key.includes('YOUR_') && key.length > 20;
}

function normalize(v) {
  return String(v || '').trim();
}

function buildPreferenceQuery(preferences = {}, interactions = [], products = []) {
  const parts = [];

  const categories = preferences.categories || [];
  const materials = preferences.materials || [];
  const occasions = preferences.occasions || [];
  const styles = preferences.styles || [];
  const regions = preferences.regions || [];

  if (categories.length) parts.push(`craft categories: ${categories.join(', ')}`);
  if (materials.length) parts.push(`preferred materials: ${materials.join(', ')}`);
  if (occasions.length) parts.push(`shopping purpose: ${occasions.join(', ')}`);
  if (styles.length) parts.push(`preferred style: ${styles.join(', ')}`);
  if (regions.length) parts.push(`preferred regions: ${regions.join(', ')}`);

  const budgetMin = Number(preferences.budgetMin ?? 0);
  const budgetMax = Number(preferences.budgetMax ?? 999999);
  if (budgetMax < 999999) {
    parts.push(`budget between ₹${budgetMin} and ₹${budgetMax}`);
  } else if (budgetMin > 0) {
    parts.push(`budget above ₹${budgetMin}`);
  }

  // Add behavioral context from the strongest recent interactions.
  const productMap = new Map(products.map(p => [String(p.id), p]));
  const behavioral = [];
  for (const event of interactions.slice(-25).reverse()) {
    if (!['wishlist', 'enquiry', 'purchase', 'view'].includes(event.eventType)) continue;
    const p = productMap.get(String(event.productId));
    if (!p) continue;
    behavioral.push(`${event.eventType}: ${p.title} (${p.category}, ${p.material || 'handmade'})`);
    if (behavioral.length >= 5) break;
  }
  if (behavioral.length) {
    parts.push(`recent buyer behavior: ${behavioral.join('; ')}`);
  }

  if (!parts.length) {
    return 'Recommend popular authentic handmade Indian artisan products with strong buyer interest.';
  }

  return `Find the most relevant handmade artisan products for this consumer. ${parts.join('. ')}. Prefer products that genuinely match the consumer, while still considering useful popular choices.`;
}

function productDocument(product) {
  const tags = Array.isArray(product.tags) ? product.tags.join(', ') : '';
  return [
    `Title: ${normalize(product.title)}`,
    `Category: ${normalize(product.category)}`,
    `Material: ${normalize(product.material)}`,
    `Price: ₹${Number(product.price || 0)}`,
    `Artisan location: ${normalize(product.artisanLoc)}`,
    `Description: ${normalize(product.description)}`,
    `Story: ${normalize(product.story)}`,
    `Tags: ${tags}`,
    `Buyer signals: ${Number(product.sales || 0)} sales, ${Number(product.views || 0)} views, ${Number(product.enquiries || 0)} enquiries`,
  ].join('\n');
}

async function cohereRerank({ query, products, topN }) {
  if (!isConfigured()) {
    return {
      ok: false,
      reason: 'COHERE_API_KEY is not configured',
      results: [],
    };
  }

  if (!Array.isArray(products) || products.length === 0) {
    return { ok: true, results: [] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(COHERE_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Client-Name': 'KalaSetu-SIH',
      },
      body: JSON.stringify({
        model: process.env.COHERE_RERANK_MODEL || 'rerank-v4.0-fast',
        query,
        documents: products.map(productDocument),
        top_n: Math.min(Number(topN || products.length), products.length),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        reason: data.message || data.error || `Cohere returned HTTP ${response.status}`,
        status: response.status,
        results: [],
      };
    }

    return {
      ok: true,
      requestId: data.id || null,
      model: process.env.COHERE_RERANK_MODEL || 'rerank-v4.0-fast',
      results: (data.results || []).map(x => ({
        index: Number(x.index),
        relevanceScore: Number(x.relevance_score || 0),
      })),
    };
  } catch (err) {
    return {
      ok: false,
      reason: err.name === 'AbortError' ? 'Cohere request timed out' : err.message,
      results: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function combineHybridScores(localRanked, cohereResults, limit = 6) {
  if (!Array.isArray(localRanked) || !localRanked.length) return [];

  const maxLocal = Math.max(1, ...localRanked.map(x => Number(x.score || 0)));
  const cohereMap = new Map(
    (cohereResults || []).map(r => [Number(r.index), Number(r.relevanceScore || 0)])
  );

  const combined = localRanked.map((entry, index) => {
    const localNormalized = Math.min(1, Number(entry.score || 0) / maxLocal);
    const semantic = cohereMap.has(index) ? cohereMap.get(index) : 0;

    // 60% existing KalaSetu logic, 40% Cohere semantic relevance.
    // The existing logic already includes preferences, behavior and bestseller signals.
    const hybrid = localNormalized * 0.60 + semantic * 0.40;

    const reasons = [...(entry.reasons || [])];
    if (semantic >= 0.70) reasons.unshift('strong AI semantic match');
    else if (semantic >= 0.45) reasons.unshift('AI matched to your interests');

    return {
      ...entry,
      hybridScore: Number((hybrid * 100).toFixed(1)),
      semanticScore: Number((semantic * 100).toFixed(1)),
      reasons: [...new Set(reasons)].slice(0, 3),
    };
  });

  return combined
    .sort((a, b) => b.hybridScore - a.hybridScore || b.popularity - a.popularity)
    .slice(0, limit);
}

module.exports = {
  isConfigured,
  buildPreferenceQuery,
  cohereRerank,
  combineHybridScores,
};
