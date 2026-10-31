const express = require('express');
const router = express.Router();
const db = require('../services/database');

router.get('/', async (req, res) => {
  try {
    const enquiries = await db.getEnquiries();
    res.json(enquiries);
  } catch (err) {
    res.status(500).json({ error: 'Could not load enquiries.', message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { productId, productName, buyerName, contact, message, intent } = req.body;

    if (!productName || !buyerName) {
      return res.status(400).json({ error: 'Product name and buyer name are required' });
    }

    const newEnquiry = {
      id: 'e_' + Date.now(),
      productId: productId || 'p1',
      productName,
      buyerName,
      contact: contact || 'Shared via app',
      message: message || 'Inquiring about this craft piece.',
      intent: intent || 'Ask a question',
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    await db.createEnquiry(newEnquiry);

    const products = await db.getProducts();
    const product = products.find(x => String(x.id) === String(newEnquiry.productId));
    if (product) {
      product.enquiries = Number(product.enquiries || 0) + 1;
      await db.upsertProduct(product);
    }

    res.status(201).json(newEnquiry);
  } catch (err) {
    res.status(500).json({ error: 'Could not send enquiry.', message: err.message });
  }
});

module.exports = router;
