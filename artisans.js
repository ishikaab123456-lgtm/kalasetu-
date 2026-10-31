const express = require('express');
const router = express.Router();
const db = require('../services/database');
const authRouter = require('./auth');

const PUBLIC_ARTISANS = {
  a1: {
    id: 'a1',
    name: 'Sunita Devi',
    craft: 'Mirror-Work & Embroidery',
    location: 'Jaipur, Rajasthan',
    language: 'Hindi',
    years: 18,
    rating: 4.9,
    productsCount: 8,
    bio: 'Sunita has been practicing traditional Rajasthani mirror embroidery for over 18 years, training young women artisans in her village to preserve handmade textile heritage.'
  },
  a2: {
    id: 'a2',
    name: 'Meera Devi',
    craft: 'Khurja Blue Pottery',
    location: 'Khurja, Uttar Pradesh',
    language: 'Hindi',
    years: 22,
    rating: 4.8,
    productsCount: 12,
    bio: 'Meera learned blue pottery from her family over two decades ago. She operates a traditional pottery kiln keeping Khurja glaze craft traditions alive.'
  },
  a3: {
    id: 'a3',
    name: 'Ranjit Singh',
    craft: 'Phulkari Textiles',
    location: 'Ludhiana, Punjab',
    language: 'Punjabi',
    years: 15,
    rating: 4.9,
    productsCount: 6,
    bio: 'Ranjit preserves ancestral Punjabi Phulkari embroidery, blending classical silk thread motifs with vibrant contemporary styling.'
  },
  a4: {
    id: 'a4',
    name: 'Arjun Meena',
    craft: 'Wood Carving & Brass Inlay',
    location: 'Jodhpur, Rajasthan',
    language: 'Hindi',
    years: 20,
    rating: 4.7,
    productsCount: 10,
    bio: 'Arjun carves seasoned Sheesham wood with brass inlay work using regional Marwari artisan tools passed down through generations.'
  },
  a5: {
    id: 'a5',
    name: 'Fatima Sheikh',
    craft: 'Madhubani Folk Painting',
    location: 'Madhubani, Bihar',
    language: 'Hindi',
    years: 14,
    rating: 4.9,
    productsCount: 14,
    bio: 'Fatima depicts traditional Mithila folklore on handmade canvas using organic plant pigments and natural indigo dyes.'
  }
};

function requireArtisan(req, res) {
  const user = authRouter.getSessionUser ? authRouter.getSessionUser(req) : null;
  if (!user) {
    res.status(401).json({ error: 'Login required.' });
    return null;
  }
  if (user.role !== 'artisan') {
    res.status(403).json({ error: 'Artisan account required.' });
    return null;
  }
  return user;
}

router.get('/me', async (req, res) => {
  try {
    const user = requireArtisan(req, res);
    if (!user) return;

    let profile = await db.getArtisanProfile(user.id);
    if (!profile) {
      profile = await db.saveArtisanProfile(user.id, {
        name: user.name,
        craft: 'Handicrafts',
        location: '',
        language: 'Hindi',
        bio: '',
        years: 0,
      });
    }

    res.json({ profile, database: db.status() });
  } catch (err) {
    res.status(500).json({ error: 'Could not load artisan profile.', message: err.message });
  }
});

router.put('/me', async (req, res) => {
  try {
    const user = requireArtisan(req, res);
    if (!user) return;

    const profile = await db.saveArtisanProfile(user.id, {
      ...req.body,
      name: req.body.name || user.name,
    });

    res.json({ success: true, profile, database: db.status() });
  } catch (err) {
    res.status(500).json({ error: 'Could not save artisan profile.', message: err.message });
  }
});

router.get('/', (req, res) => {
  res.json(Object.values(PUBLIC_ARTISANS));
});

router.get('/:id', (req, res) => {
  const artisan = PUBLIC_ARTISANS[req.params.id] || PUBLIC_ARTISANS.a1;
  res.json(artisan);
});

module.exports = router;
