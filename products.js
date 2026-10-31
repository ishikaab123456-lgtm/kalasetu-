const express = require('express');
const router = express.Router();
const db = require('../services/database');

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { category, search, artisanId, status } = req.query;
    let list = await db.getProducts();

    if (status) {
      list = list.filter(p => String(p.status || '').toLowerCase() === String(status).toLowerCase());
    }

    if (artisanId) {
      list = list.filter(p => String(p.artisanId || '') === String(artisanId));
    }

    if (category && category !== 'All') {
      list = list.filter(p => String(p.category || '').toLowerCase() === String(category).toLowerCase());
    }

    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(p =>
        String(p.title || '').toLowerCase().includes(q) ||
        String(p.category || '').toLowerCase().includes(q) ||
        String(p.material || '').toLowerCase().includes(q) ||
        String(p.artisanName || '').toLowerCase().includes(q)
      );
    }

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Could not load products.', message: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const products = await db.getProducts();
    const product = products.find(p => String(p.id) === String(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });

    product.views = Number(product.views || 0) + 1;
    await db.upsertProduct(product);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Could not load product.', message: err.message });
  }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const {
      title, category, material, description, story, price, min, max, image,
      artisanName, artisanLoc, status, tags
    } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    const numericPrice = Number(price) || 999;
    const newProduct = {
      id: 'p_' + Date.now(),
      title: title || 'Untitled Craft',
      category: category || 'Handicrafts',
      material: material || 'Natural Materials',
      description: description || 'Handcrafted Indian craft piece.',
      story: story || 'Made with ancestral craftsmanship.',
      price: numericPrice,
      min: Number(min) || Math.round(numericPrice * 0.85),
      max: Number(max) || Math.round(numericPrice * 1.25),
      status: status || 'Published',
      views: 0,
      enquiries: 0,
      sales: 0,
      artisanId: 'a1',
      artisanName: artisanName || 'Sunita Devi',
      artisanLoc: artisanLoc || 'Jaipur, Rajasthan',
      image: image || 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80',
      emoji: '✨',
      tags: Array.isArray(tags) ? tags : [],
      createdAt: new Date().toISOString()
    };

    await db.upsertProduct(newProduct);
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: 'Could not create product.', message: err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  try {
    const products = await db.getProducts();
    const idx = products.findIndex(p => String(p.id) === String(req.params.id));
    if (idx < 0) return res.status(404).json({ error: 'Product not found' });

    const updated = { ...products[idx], ...req.body, id: products[idx].id };
    await db.upsertProduct(updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Could not update product.', message: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    const products = await db.getProducts();
    const exists = products.some(p => String(p.id) === String(req.params.id));
    if (!exists) return res.status(404).json({ error: 'Product not found' });

    await db.deleteProduct(req.params.id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete product.', message: err.message });
  }
});

module.exports = router;
