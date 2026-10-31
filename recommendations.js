const express = require('express');
const router = express.Router();
const db = require('../services/database');
const authRouter = require('./auth');
const { recommend, bestsellers } = require('../services/recommendationEngine');
const {
  isConfigured: cohereConfigured,
  buildPreferenceQuery,
  cohereRerank,
  combineHybridScores,
} = require('../services/cohereRecommendation');

function requireConsumer(req, res) {
  const user = authRouter.getSessionUser ? authRouter.getSessionUser(req) : null;
  if (!user) {
    res.status(401).json({ error: 'Login required.' });
    return null;
  }
  if (user.role !== 'consumer') {
    res.status(403).json({ error: 'Consumer account required.' });
    return null;
  }
  return user;
}

router.get('/', async (req, res) => {
  try {
    const user = requireConsumer(req, res);
    if (!user) return;

    const [products, preferences, interactions] = await Promise.all([
      db.getProducts(),
      db.getConsumerPreferences(user.id),
      db.getInteractions(user.id),
    ]);

    const fallbackPrefs = preferences || {
      categories: [],
      materials: [],
      occasions: [],
      styles: [],
      regions: [],
      budgetMin: 0,
      budgetMax: 999999,
    };

    // Stage 1: KalaSetu's own explainable recommendation engine creates
    // a high-quality candidate set using preferences + behavior + popularity.
    const localCandidates = recommend(products, fallbackPrefs, interactions, 12);
    const popular = bestsellers(products, 6);

    let personalized = localCandidates.slice(0, 6);
    let aiStatus = {
      enabled: cohereConfigured(),
      used: false,
      provider: 'Cohere',
      model: process.env.COHERE_RERANK_MODEL || 'rerank-v4.0-fast',
      fallback: false,
      message: cohereConfigured()
        ? 'Cohere semantic reranking ready'
        : 'Using KalaSetu local hybrid ranking until Cohere is configured',
    };

    // Stage 2: Cohere semantically reranks the candidate products.
    // If Cohere is unavailable, KalaSetu automatically keeps the local ranking.
    if (cohereConfigured() && localCandidates.length) {
      const query = buildPreferenceQuery(fallbackPrefs, interactions, products);
      const rerank = await cohereRerank({
        query,
        products: localCandidates.map(x => x.product),
        topN: localCandidates.length,
      });

      if (rerank.ok) {
        personalized = combineHybridScores(localCandidates, rerank.results, 6);
        aiStatus = {
          enabled: true,
          used: true,
          provider: 'Cohere',
          model: rerank.model,
          fallback: false,
          message: 'Cohere semantic reranking applied',
        };
      } else {
        aiStatus = {
          enabled: true,
          used: false,
          provider: 'Cohere',
          model: process.env.COHERE_RERANK_MODEL || 'rerank-v4.0-fast',
          fallback: true,
          message: 'Cohere unavailable — safe local fallback used',
        };
      }
    }

    res.json({
      userId: user.id,
      hasPreferences: Boolean(preferences),
      preferences,
      recommended: personalized.map(x => ({
        ...x.product,
        recommendationScore: x.hybridScore ?? x.score,
        semanticScore: x.semanticScore ?? null,
        recommendationReasons: x.reasons,
        aiReranked: Boolean(aiStatus.used),
      })),
      bestsellers: popular.map((x, idx) => ({
        ...x.product,
        bestsellerRank: idx + 1,
        bestsellerReason: x.reason,
      })),
      engine: {
        type: aiStatus.used
          ? 'hybrid-kalasetu-plus-cohere-rerank'
          : 'hybrid-content-popularity-behavior',
        ai: aiStatus,
        signals: [
          'selected categories',
          'materials',
          'occasion',
          'style',
          'budget',
          'buyer interactions',
          'bestseller/popularity',
          ...(aiStatus.used ? ['Cohere semantic relevance'] : [])
        ]
      },
      database: db.status(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not generate recommendations.', message: err.message });
  }
});


router.get('/status', async (req, res) => {
  const user = requireConsumer(req, res);
  if (!user) return;
  res.json({
    provider: 'Cohere',
    configured: cohereConfigured(),
    model: process.env.COHERE_RERANK_MODEL || 'rerank-v4.0-fast',
    architecture: 'KalaSetu candidate ranking → Cohere semantic rerank → hybrid final score',
    fallback: 'KalaSetu local hybrid recommender',
  });
});

router.post('/interaction', async (req, res) => {
  try {
    const user = requireConsumer(req, res);
    if (!user) return;

    const { productId, eventType, metadata } = req.body || {};
    const allowed = ['view', 'wishlist', 'unwishlist', 'enquiry', 'purchase'];
    if (!productId || !allowed.includes(eventType)) {
      return res.status(400).json({ error: 'Valid productId and eventType are required.' });
    }

    await db.recordInteraction(user.id, productId, eventType, metadata || {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not save interaction.', message: err.message });
  }
});

module.exports = router;
