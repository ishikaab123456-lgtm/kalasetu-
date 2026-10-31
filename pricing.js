const express = require('express');
const router = express.Router();

const CATEGORY_BASE_PRICE = {
  'pottery': 450, 'clay': 450, 'jewelry': 850, 'textiles': 650,
  'woodwork': 950, 'paintings': 1100, 'bags': 550, 'default': 500
};

const MATERIAL_MULTIPLIER = {
  'silver': 1.8, 'gold': 3.2, 'clay': 1.0, 'cotton': 1.15,
  'silk': 1.65, 'wood': 1.35, 'natural plant dyes': 1.25, 'default': 1.0
};

router.post('/pricing', (req, res) => {
  let { category = 'default', materials = [], materialCost, labourCost, hours } = req.body;

  let suggestedPrice = 0;
  let minPrice = 0;
  let maxPrice = 0;

  if (materialCost !== undefined && labourCost !== undefined) {
    const mat = Number(materialCost) || 0;
    const lab = Number(labourCost) || 0;
    const hrs = Number(hours) || 1;
    
    // Transparent Artisan Pricing Formula: Material + (Labour * Hours) + 25% Fair Craft Margin
    const baseCost = mat + (lab * hrs);
    suggestedPrice = Math.round(baseCost * 1.25);
    minPrice = Math.round(suggestedPrice * 0.9);
    maxPrice = Math.round(suggestedPrice * 1.2);
  } else {
    const catKey = (category || 'default').toLowerCase();
    const base = CATEGORY_BASE_PRICE[catKey] || CATEGORY_BASE_PRICE.default;
    
    let mult = 1.0;
    if (Array.isArray(materials) && materials.length) {
      mult = Math.max(...materials.map(m => MATERIAL_MULTIPLIER[m.toLowerCase()] || 1.0));
    }
    suggestedPrice = Math.round(base * mult);
    minPrice = Math.round(suggestedPrice * 0.85);
    maxPrice = Math.round(suggestedPrice * 1.25);
  }

  res.json({
    suggestedPrice,
    priceRange: { min: minPrice, max: maxPrice },
    explanation: `Calculated from raw material inputs, artisan craft labor, and local fair market benchmarks.`
  });
});

module.exports = router;