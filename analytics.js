const express = require('express');
const router = express.Router();
const db = require('../services/database');
const authRouter = require('./auth');
const { popularityRaw } = require('../services/recommendationEngine');

function requireUser(req, res) {
  const user = authRouter.getSessionUser ? authRouter.getSessionUser(req) : null;
  if (!user) {
    res.status(401).json({ error: 'Login required.' });
    return null;
  }
  return user;
}

function round(value, digits = 0) {
  const p = 10 ** digits;
  return Math.round(Number(value || 0) * p) / p;
}

function sum(items, getter) {
  return items.reduce((total, item) => total + Number(getter(item) || 0), 0);
}

function monthLabels(count = 6) {
  const labels = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleString('en-IN', { month: 'short' }));
  }
  return labels;
}

function distributeTotal(total, weights) {
  const safeTotal = Math.max(0, Number(total || 0));
  const values = weights.map(w => Math.round(safeTotal * w));
  const difference = Math.round(safeTotal) - values.reduce((a, b) => a + b, 0);
  values[values.length - 1] += difference;
  return values;
}

function aggregateCategories(products) {
  const map = new Map();

  for (const p of products) {
    const category = p.category || 'Other';
    if (!map.has(category)) {
      map.set(category, {
        category,
        products: 0,
        unitsSold: 0,
        views: 0,
        enquiries: 0,
        revenue: 0,
        popularity: 0,
      });
    }
    const row = map.get(category);
    row.products += 1;
    row.unitsSold += Number(p.sales || 0);
    row.views += Number(p.views || 0);
    row.enquiries += Number(p.enquiries || 0);
    row.revenue += Number(p.sales || 0) * Number(p.price || 0);
    row.popularity += popularityRaw(p);
  }

  return [...map.values()].map(x => ({
    ...x,
    revenue: round(x.revenue),
    popularity: round(x.popularity, 1),
  }));
}

function interestSignals(products, preferences, interactions) {
  const scores = {};

  // Product views are an anonymous marketplace interest signal.
  for (const p of products) {
    const cat = p.category || 'Other';
    scores[cat] = (scores[cat] || 0) + Number(p.views || 0);
  }

  // Aggregate declared interests get an extra signal.
  for (const pref of preferences || []) {
    for (const cat of pref.categories || []) {
      scores[cat] = (scores[cat] || 0) + 80;
    }
  }

  // Interactions add behavioral interest.
  const productById = new Map(products.map(p => [String(p.id), p]));
  for (const event of interactions || []) {
    const p = productById.get(String(event.productId));
    if (!p) continue;
    const cat = p.category || 'Other';
    const weight = { view: 8, wishlist: 30, enquiry: 45 }[event.eventType] || 3;
    scores[cat] = (scores[cat] || 0) + weight;
  }

  return Object.entries(scores)
    .map(([category, score]) => ({ category, score: round(score) }))
    .sort((a, b) => b.score - a.score);
}

function buyerPriceBands(products) {
  const bands = [
    { label: 'Under ₹500', min: 0, max: 499, units: 0 },
    { label: '₹500–999', min: 500, max: 999, units: 0 },
    { label: '₹1K–1.9K', min: 1000, max: 1999, units: 0 },
    { label: '₹2K–2.9K', min: 2000, max: 2999, units: 0 },
    { label: '₹3K+', min: 3000, max: Infinity, units: 0 },
  ];

  for (const p of products) {
    const price = Number(p.price || 0);
    const units = Number(p.sales || 0);
    const band = bands.find(b => price >= b.min && price <= b.max);
    if (band) band.units += units;
  }

  return bands.map(({ label, units }) => ({ label, units }));
}

router.get('/', async (req, res) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const [allProducts, enquiries, allPreferences, allInteractions] = await Promise.all([
      db.getProducts(),
      db.getEnquiries(),
      db.getAllConsumerPreferences(),
      db.getAllInteractions(),
    ]);

    const products = allProducts.filter(
      p => String(p.status || '').toLowerCase() === 'published'
    );

    const totalUnits = sum(products, p => p.sales);
    const totalViews = sum(products, p => p.views);
    const totalEnquiries = sum(products, p => p.enquiries);
    const totalRevenue = sum(products, p => Number(p.sales || 0) * Number(p.price || 0));
    const averageOrderValue = totalUnits ? totalRevenue / totalUnits : 0;
    const conversionRate = totalViews ? (totalUnits / totalViews) * 100 : 0;

    const categories = aggregateCategories(products);
    const topProducts = products
      .slice()
      .sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0))
      .slice(0, 6)
      .map(p => ({
        id: p.id,
        title: p.title,
        category: p.category,
        unitsSold: Number(p.sales || 0),
        views: Number(p.views || 0),
        enquiries: Number(p.enquiries || 0),
        revenue: round(Number(p.sales || 0) * Number(p.price || 0)),
      }));

    const topRevenueCategories = categories
      .slice()
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const trendingCategories = categories
      .slice()
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 6)
      .map((x, index, arr) => ({
        category: x.category,
        score: round((x.popularity / Math.max(1, arr[0]?.popularity || 1)) * 100),
        unitsSold: x.unitsSold,
        views: x.views,
      }));

    const interests = interestSignals(products, allPreferences, allInteractions).slice(0, 6);
    const spendByCategory = categories
      .slice()
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 7)
      .map(x => ({ category: x.category, spend: x.revenue }));

    const labels = monthLabels(6);
    // Illustrative SIH trend: distributes current demo totals across six months.
    // Replace with real order timestamps once production orders are collected.
    const weights = [0.10, 0.12, 0.14, 0.17, 0.20, 0.27];
    const monthlyUnits = distributeTotal(totalUnits, weights);
    const monthlyRevenue = distributeTotal(totalRevenue, weights);
    const monthlyViews = distributeTotal(totalViews, [0.11, 0.12, 0.14, 0.17, 0.21, 0.25]);

    const salesTrend = labels.map((month, i) => ({
      month,
      units: monthlyUnits[i],
      revenue: monthlyRevenue[i],
      impressions: monthlyViews[i],
    }));

    const bestProduct = topProducts[0] || null;
    const bestCategory = topRevenueCategories[0] || null;
    const hotCategory = trendingCategories[0] || null;

    let currentConsumerPreferences = null;
    if (user.role === 'consumer') {
      currentConsumerPreferences = await db.getConsumerPreferences(user.id);
    }

    res.json({
      generatedAt: new Date().toISOString(),
      database: db.status(),
      demoTrend: true,
      dataNote:
        'Marketplace totals come from the current KalaSetu demo dataset. The 6-month line trend is illustrative until real dated order history is collected.',
      selling: {
        kpis: {
          unitsSold: round(totalUnits),
          revenue: round(totalRevenue),
          impressions: round(totalViews),
          enquiries: round(totalEnquiries),
          conversionRate: round(conversionRate, 1),
          averageOrderValue: round(averageOrderValue),
        },
        salesTrend,
        topProducts,
        revenueByCategory: topRevenueCategories,
        buyerActions: [
          { label: 'Product views', value: round(totalViews) },
          { label: 'Buyer enquiries', value: round(totalEnquiries) },
          { label: 'Units sold', value: round(totalUnits) },
        ],
        insights: [
          bestProduct
            ? `${bestProduct.title} is the top-selling product with ${bestProduct.unitsSold} demo units sold.`
            : 'Add product activity to unlock top-product insight.',
          bestCategory
            ? `${bestCategory.category} currently contributes the highest demo revenue.`
            : 'Category revenue will appear as products sell.',
          conversionRate
            ? `Marketplace sales-to-view signal is ${round(conversionRate, 1)}% in the demo dataset.`
            : 'Conversion appears after buyer activity.',
        ],
      },
      buying: {
        kpis: {
          marketplaceSpend: round(totalRevenue),
          averageSpend: round(averageOrderValue),
          activeCategories: categories.length,
          productsBought: round(totalUnits),
        },
        spendingTrend: salesTrend.map(x => ({ month: x.month, spend: x.revenue })),
        trendingCategories,
        spendByCategory,
        interestSignals: interests,
        priceBands: buyerPriceBands(products),
        personalPreferences: currentConsumerPreferences,
        insights: [
          hotCategory
            ? `${hotCategory.category} is the strongest trending category right now in the demo marketplace.`
            : 'Trending categories will appear after engagement.',
          bestCategory
            ? `Buyer spending is highest in ${bestCategory.category} based on demo sales × product price.`
            : 'Buyer spending mix will appear after sales.',
          interests[0]
            ? `${interests[0].category} has the strongest interest signal from views, preferences and interactions.`
            : 'Interest signals grow as consumers browse and save products.',
        ],
      },
    });
  } catch (err) {
    console.error('Analytics route failed:', err);
    res.status(500).json({ error: 'Could not build analytics.', message: err.message });
  }
});

module.exports = router;
