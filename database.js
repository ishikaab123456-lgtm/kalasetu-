const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const PREFS_FILE = path.join(DATA_DIR, 'consumer_preferences.json');
const INTERACTIONS_FILE = path.join(DATA_DIR, 'interactions.json');
const ENQUIRIES_FILE = path.join(DATA_DIR, 'enquiries.json');
const ARTISAN_PROFILES_FILE = path.join(DATA_DIR, 'artisan_profiles.json');

const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const supabaseServiceKey = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''
).trim();

const useSupabase =
  String(process.env.USE_SUPABASE || 'false').toLowerCase() === 'true' &&
  /^https?:\/\//.test(supabaseUrl) &&
  supabaseServiceKey.length > 20;

let supabase = null;
if (useSupabase) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  } catch (err) {
    console.warn('Supabase package unavailable; using local JSON fallback:', err.message);
  }
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    ensureDir();
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
      return fallback;
    }
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw || JSON.stringify(fallback));
  } catch (err) {
    console.error('Local DB read failed:', file, err.message);
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function normalizeProductRow(row) {
  if (!row) return null;
  if (row.payload && typeof row.payload === 'object') {
    return {
      ...row.payload,
      id: row.id || row.payload.id,
      status: row.status || row.payload.status,
      category: row.category || row.payload.category,
      price: Number(row.price ?? row.payload.price ?? 0),
      views: Number(row.views ?? row.payload.views ?? 0),
      enquiries: Number(row.enquiries ?? row.payload.enquiries ?? 0),
      sales: Number(row.sales ?? row.payload.sales ?? 0),
      createdAt: row.created_at || row.payload.createdAt,
    };
  }
  return row;
}

async function getProducts() {
  if (!useSupabase || !supabase) return readJson(PRODUCTS_FILE, []);

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Supabase products unavailable; using local fallback:', error.message);
    return readJson(PRODUCTS_FILE, []);
  }

  if (!data || data.length === 0) {
    const local = readJson(PRODUCTS_FILE, []);
    if (local.length) {
      await upsertProducts(local);
      return local;
    }
  }

  return (data || []).map(normalizeProductRow).filter(Boolean);
}

async function upsertProducts(products) {
  if (!useSupabase || !supabase) {
    writeJson(PRODUCTS_FILE, products);
    return products;
  }

  const rows = products.map(p => ({
    id: String(p.id),
    status: p.status || 'Published',
    category: p.category || 'Handicrafts',
    price: Number(p.price || 0),
    views: Number(p.views || 0),
    enquiries: Number(p.enquiries || 0),
    sales: Number(p.sales || 0),
    payload: p,
    created_at: p.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('products').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.warn('Supabase product save failed; writing local fallback:', error.message);
    writeJson(PRODUCTS_FILE, products);
  }
  return products;
}

async function upsertProduct(product) {
  const products = await getProducts();
  const idx = products.findIndex(p => String(p.id) === String(product.id));
  if (idx >= 0) products[idx] = product;
  else products.unshift(product);
  await upsertProducts(products);
  return product;
}

async function deleteProduct(id) {
  if (useSupabase && supabase) {
    const { error } = await supabase.from('products').delete().eq('id', String(id));
    if (error) console.warn('Supabase delete failed:', error.message);
  }

  const local = readJson(PRODUCTS_FILE, []);
  const filtered = local.filter(p => String(p.id) !== String(id));
  writeJson(PRODUCTS_FILE, filtered);
  return true;
}

async function upsertProfile(user) {
  if (!user) return;
  if (!useSupabase || !supabase) return;

  const row = {
    id: String(user.id),
    name: user.name || '',
    role: user.role || '',
    login_method: user.method || '',
    identifier: user.identifier || '',
    created_at: user.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) console.warn('Supabase profile sync failed:', error.message);
}

async function getConsumerPreferences(userId) {
  if (!userId) return null;

  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('consumer_preferences')
      .select('*')
      .eq('user_id', String(userId))
      .maybeSingle();

    if (!error && data) {
      return {
        userId: data.user_id,
        categories: data.categories || [],
        materials: data.materials || [],
        occasions: data.occasions || [],
        styles: data.styles || [],
        regions: data.regions || [],
        budgetMin: Number(data.budget_min || 0),
        budgetMax: Number(data.budget_max || 999999),
        updatedAt: data.updated_at,
      };
    }
    if (error) console.warn('Supabase preference read failed:', error.message);
  }

  const all = readJson(PREFS_FILE, {});
  return all[String(userId)] || null;
}

async function saveConsumerPreferences(userId, prefs) {
  const clean = {
    userId: String(userId),
    categories: Array.isArray(prefs.categories) ? prefs.categories.slice(0, 12) : [],
    materials: Array.isArray(prefs.materials) ? prefs.materials.slice(0, 12) : [],
    occasions: Array.isArray(prefs.occasions) ? prefs.occasions.slice(0, 12) : [],
    styles: Array.isArray(prefs.styles) ? prefs.styles.slice(0, 12) : [],
    regions: Array.isArray(prefs.regions) ? prefs.regions.slice(0, 12) : [],
    budgetMin: Math.max(0, Number(prefs.budgetMin || 0)),
    budgetMax: Math.max(0, Number(prefs.budgetMax || 999999)),
    updatedAt: new Date().toISOString(),
  };

  if (clean.budgetMax < clean.budgetMin) {
    [clean.budgetMin, clean.budgetMax] = [clean.budgetMax, clean.budgetMin];
  }

  if (useSupabase && supabase) {
    const row = {
      user_id: clean.userId,
      categories: clean.categories,
      materials: clean.materials,
      occasions: clean.occasions,
      styles: clean.styles,
      regions: clean.regions,
      budget_min: clean.budgetMin,
      budget_max: clean.budgetMax,
      updated_at: clean.updatedAt,
    };
    const { error } = await supabase
      .from('consumer_preferences')
      .upsert(row, { onConflict: 'user_id' });
    if (error) console.warn('Supabase preference save failed:', error.message);
  }

  const all = readJson(PREFS_FILE, {});
  all[clean.userId] = clean;
  writeJson(PREFS_FILE, all);
  return clean;
}

async function recordInteraction(userId, productId, eventType, metadata = {}) {
  if (!userId || !productId || !eventType) return null;

  const event = {
    id: `i_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    userId: String(userId),
    productId: String(productId),
    eventType: String(eventType),
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    const row = {
      user_id: event.userId,
      product_id: event.productId,
      event_type: event.eventType,
      metadata: event.metadata,
      created_at: event.createdAt,
    };
    const { error } = await supabase.from('interactions').insert(row);
    if (error) console.warn('Supabase interaction save failed:', error.message);
  }

  const list = readJson(INTERACTIONS_FILE, []);
  list.push(event);
  writeJson(INTERACTIONS_FILE, list.slice(-5000));
  return event;
}

async function getInteractions(userId) {
  if (!userId) return [];

  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('interactions')
      .select('*')
      .eq('user_id', String(userId))
      .order('created_at', { ascending: false })
      .limit(250);

    if (!error && data) {
      return data.map(x => ({
        userId: x.user_id,
        productId: x.product_id,
        eventType: x.event_type,
        metadata: x.metadata || {},
        createdAt: x.created_at,
      }));
    }
    if (error) console.warn('Supabase interaction read failed:', error.message);
  }

  return readJson(INTERACTIONS_FILE, [])
    .filter(x => String(x.userId) === String(userId))
    .slice(-250)
    .reverse();
}



async function getArtisanProfile(userId) {
  if (!userId) return null;

  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('artisan_profiles')
      .select('*')
      .eq('user_id', String(userId))
      .maybeSingle();

    if (!error && data) {
      return {
        userId: data.user_id,
        name: data.name,
        craft: data.craft,
        location: data.location,
        language: data.language,
        bio: data.bio,
        years: Number(data.years || 0),
        updatedAt: data.updated_at,
      };
    }
    if (error) console.warn('Supabase artisan profile read failed:', error.message);
  }

  const all = readJson(ARTISAN_PROFILES_FILE, {});
  return all[String(userId)] || null;
}

async function saveArtisanProfile(userId, profile) {
  const clean = {
    userId: String(userId),
    name: String(profile.name || 'Artisan').trim(),
    craft: String(profile.craft || 'Handicrafts').trim(),
    location: String(profile.location || '').trim(),
    language: String(profile.language || 'Hindi').trim(),
    bio: String(profile.bio || '').trim(),
    years: Math.max(0, Number(profile.years || 0)),
    updatedAt: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    const row = {
      user_id: clean.userId,
      name: clean.name,
      craft: clean.craft,
      location: clean.location,
      language: clean.language,
      bio: clean.bio,
      years: clean.years,
      updated_at: clean.updatedAt,
    };
    const { error } = await supabase
      .from('artisan_profiles')
      .upsert(row, { onConflict: 'user_id' });
    if (error) console.warn('Supabase artisan profile save failed:', error.message);
  }

  const all = readJson(ARTISAN_PROFILES_FILE, {});
  all[clean.userId] = clean;
  writeJson(ARTISAN_PROFILES_FILE, all);
  return clean;
}

async function getEnquiries() {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('enquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data.map(x => ({
        id: x.id,
        productId: x.product_id,
        productName: x.product_name,
        buyerName: x.buyer_name,
        contact: x.contact,
        message: x.message,
        intent: x.intent,
        status: x.status,
        createdAt: x.created_at,
      }));
    }
    if (error) console.warn('Supabase enquiry read failed:', error.message);
  }

  return readJson(ENQUIRIES_FILE, []);
}

async function createEnquiry(enquiry) {
  if (useSupabase && supabase) {
    const row = {
      id: enquiry.id,
      product_id: enquiry.productId,
      product_name: enquiry.productName,
      buyer_name: enquiry.buyerName,
      contact: enquiry.contact,
      message: enquiry.message,
      intent: enquiry.intent,
      status: enquiry.status,
      created_at: enquiry.createdAt,
    };
    const { error } = await supabase.from('enquiries').insert(row);
    if (error) console.warn('Supabase enquiry save failed:', error.message);
  }

  const list = readJson(ENQUIRIES_FILE, []);
  list.unshift(enquiry);
  writeJson(ENQUIRIES_FILE, list);
  return enquiry;
}

async function getAllConsumerPreferences() {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('consumer_preferences')
      .select('*')
      .limit(5000);

    if (!error && data) {
      return data.map(x => ({
        userId: x.user_id,
        categories: x.categories || [],
        materials: x.materials || [],
        occasions: x.occasions || [],
        styles: x.styles || [],
        regions: x.regions || [],
        budgetMin: Number(x.budget_min || 0),
        budgetMax: Number(x.budget_max || 999999),
        updatedAt: x.updated_at,
      }));
    }
    if (error) console.warn('Supabase preference analytics read failed:', error.message);
  }

  return Object.values(readJson(PREFS_FILE, {}));
}

async function getAllInteractions() {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('interactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (!error && data) {
      return data.map(x => ({
        userId: x.user_id,
        productId: x.product_id,
        eventType: x.event_type,
        metadata: x.metadata || {},
        createdAt: x.created_at,
      }));
    }
    if (error) console.warn('Supabase interaction analytics read failed:', error.message);
  }

  return readJson(INTERACTIONS_FILE, []);
}
function status() {
  return {
    mode: (useSupabase && supabase) ? 'supabase' : 'local-json-fallback',
    configured: Boolean(useSupabase && supabase),
  };
}

module.exports = {
  status,
  getProducts,
  upsertProducts,
  upsertProduct,
  deleteProduct,
  upsertProfile,
  getConsumerPreferences,
  saveConsumerPreferences,
  recordInteraction,
  getInteractions,
  getArtisanProfile,
  saveArtisanProfile,
  getEnquiries,
  createEnquiry,
  getAllConsumerPreferences,
  getAllInteractions,
};
