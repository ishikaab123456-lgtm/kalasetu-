const CATEGORY_SYNONYMS = {
  bags: ['bag', 'tote', 'pouch', 'basket'],
  textiles: ['textile', 'silk', 'dupatta', 'saree', 'fabric', 'embroider', 'phulkari'],
  jewelry: ['jewelry', 'jewellery', 'necklace', 'earring', 'bracelet', 'silver'],
  pottery: ['pottery', 'ceramic', 'clay', 'vase'],
  woodwork: ['wood', 'woodwork', 'sheesham', 'carved'],
  paintings: ['painting', 'madhubani', 'canvas', 'art'],
  metalwork: ['metal', 'brass', 'bell', 'dokra'],
};

const OCCASION_KEYWORDS = {
  'Gifting': ['gift', 'box', 'decor', 'bag', 'painting', 'jewelry', 'jewellery'],
  'Home Décor': ['decor', 'vase', 'painting', 'box', 'wood', 'pottery', 'metal'],
  'Fashion & Accessories': ['bag', 'tote', 'dupatta', 'textile', 'jewelry', 'jewellery'],
  'Festivals & Weddings': ['silk', 'dupatta', 'jewelry', 'jewellery', 'traditional', 'embroider'],
  'Collectibles': ['painting', 'pottery', 'wood', 'metal', 'heritage'],
  'Everyday Use': ['bag', 'basket', 'cotton', 'jute', 'box'],
};

const STYLE_KEYWORDS = {
  'Traditional': ['traditional', 'heritage', 'folk', 'mirror', 'phulkari', 'madhubani', 'handcrafted'],
  'Contemporary': ['modern', 'contemporary', 'minimal', 'clean'],
  'Eco-friendly': ['jute', 'natural', 'plant dye', 'eco', 'sustainable', 'wood', 'cotton'],
  'Colorful': ['vibrant', 'colorful', 'mirror', 'phulkari', 'madhubani', 'floral'],
  'Minimal': ['minimal', 'simple', 'wood', 'ceramic'],
  'Heritage': ['heritage', 'traditional', 'age-old', 'generations', 'folk'],
};

function norm(v) {
  return String(v || '').trim().toLowerCase();
}

function productText(p) {
  return norm([
    p.title, p.category, p.material, p.description, p.story,
    ...(Array.isArray(p.tags) ? p.tags : [])
  ].join(' '));
}

function includesAny(text, words) {
  return words.some(w => text.includes(norm(w)));
}

function popularityRaw(p) {
  return (
    Number(p.sales || 0) * 25 +
    Number(p.enquiries || 0) * 8 +
    Number(p.views || 0) * 0.25
  );
}

function scoreProduct(p, prefs, interactions, maxPopularity) {
  const text = productText(p);
  let score = 0;
  const reasons = [];

  const categories = prefs?.categories || [];
  if (categories.some(c => norm(c) === norm(p.category))) {
    score += 34;
    reasons.push(`matches ${p.category}`);
  } else {
    for (const c of categories) {
      const syn = CATEGORY_SYNONYMS[norm(c)] || [norm(c)];
      if (includesAny(text, syn)) {
        score += 24;
        reasons.push(`matches your ${c} interest`);
        break;
      }
    }
  }

  const materials = prefs?.materials || [];
  if (materials.length && includesAny(text, materials)) {
    score += 20;
    reasons.push('preferred material');
  }

  const occasions = prefs?.occasions || [];
  for (const occasion of occasions) {
    const words = OCCASION_KEYWORDS[occasion] || [occasion];
    if (includesAny(text, words)) {
      score += 14;
      reasons.push(`good for ${occasion.toLowerCase()}`);
      break;
    }
  }

  const styles = prefs?.styles || [];
  for (const style of styles) {
    const words = STYLE_KEYWORDS[style] || [style];
    if (includesAny(text, words)) {
      score += 13;
      reasons.push(`${style.toLowerCase()} style`);
      break;
    }
  }

  const min = Number(prefs?.budgetMin ?? 0);
  const max = Number(prefs?.budgetMax ?? 999999);
  const price = Number(p.price || 0);
  if (price >= min && price <= max) {
    score += 24;
    reasons.push('inside your budget');
  } else if (price > 0 && max < 999999 && price <= max * 1.15) {
    score += 8;
  }

  const regions = prefs?.regions || [];
  if (regions.length && regions.some(r => norm(p.artisanLoc).includes(norm(r)))) {
    score += 8;
    reasons.push('preferred region');
  }

  // Behavioral learning: a prior view/wishlist/enquiry boosts similar category/material.
  const interactedIds = new Set(
    interactions
      .filter(i => ['wishlist', 'enquiry', 'view'].includes(i.eventType))
      .map(i => String(i.productId))
  );
  if (interactedIds.has(String(p.id))) {
    const strongest = interactions
      .filter(i => String(i.productId) === String(p.id))
      .reduce((sum, i) => sum + ({ wishlist: 14, enquiry: 20, view: 4 }[i.eventType] || 0), 0);
    score += Math.min(22, strongest);
    if (strongest > 0) reasons.push('based on your activity');
  }

  // Bestseller signal is always part of ranking, but never fully overrides preferences.
  const pop = popularityRaw(p);
  const popularityScore = maxPopularity > 0 ? (pop / maxPopularity) * 22 : 0;
  score += popularityScore;
  if (Number(p.sales || 0) >= 20 || popularityScore >= 15) reasons.push('popular with buyers');

  return {
    product: p,
    score: Number(score.toFixed(2)),
    reasons: [...new Set(reasons)].slice(0, 3),
    popularity: pop,
  };
}

function recommend(products, prefs, interactions = [], limit = 6) {
  const published = products.filter(p => String(p.status).toLowerCase() === 'published');
  const maxPopularity = Math.max(1, ...published.map(popularityRaw));
  const ranked = published
    .map(p => scoreProduct(p, prefs, interactions, maxPopularity))
    .sort((a, b) => b.score - a.score || b.popularity - a.popularity);

  return ranked.slice(0, limit);
}

function bestsellers(products, limit = 6) {
  return products
    .filter(p => String(p.status).toLowerCase() === 'published')
    .map(p => ({
      product: p,
      popularity: popularityRaw(p),
      reason: Number(p.sales || 0) > 0
        ? `${Number(p.sales || 0)} demo sales`
        : 'Trending by buyer engagement',
    }))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);
}

module.exports = { recommend, bestsellers, popularityRaw };
