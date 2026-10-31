const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// In-memory auction data structures
let auctions = {};
let bids = {};
let likes = {};

// Helper to seed initial sample auctions using products data
function seedInitialAuctions() {
  try {
    const productsFile = path.join(__dirname, '../data/products.json');
    if (fs.existsSync(productsFile)) {
      const products = JSON.parse(fs.readFileSync(productsFile, 'utf-8'));
      if (products && products.length > 0) {
        const p1 = products[0];
        const p2 = products[1] || products[0];

        // Live Auction 1
        auctions['auc_1'] = {
          auctionId: 'auc_1',
          productId: p1.id,
          productTitle: p1.title,
          productImage: p1.image,
          artisanName: p1.artisanName,
          category: p1.category,
          startPrice: p1.price || 1299,
          currentPrice: p1.price || 1299,
          increment: 100,
          maxBid: 2500, // Buyout target threshold
          highestBidder: null,
          status: 'live',
          timer: null,
          createdAt: new Date().toISOString()
        };
        bids['auc_1'] = [];
        likes['auc_1'] = ['Rohan M.', 'Priya S.'];

        // Live Auction 2
        auctions['auc_2'] = {
          auctionId: 'auc_2',
          productId: p2.id,
          productTitle: p2.title,
          productImage: p2.image,
          artisanName: p2.artisanName,
          category: p2.category,
          startPrice: p2.price || 899,
          currentPrice: p2.price || 899,
          increment: 50,
          maxBid: 1800,
          highestBidder: null,
          status: 'live',
          timer: null,
          createdAt: new Date().toISOString()
        };
        bids['auc_2'] = [];
        likes['auc_2'] = ['Aman K.'];
      }
    }
  } catch (err) {
    console.error('Error seeding initial auctions:', err);
  }
}

// Seed on module load
seedInitialAuctions();

// Setup WebSockets logic
function initAuctionSocket(io) {
  io.on('connection', (socket) => {
    console.log('⚡ Socket connected:', socket.id);

    // Join Auction Room
    socket.on('joinAuction', ({ auctionId, userId }) => {
      socket.join(auctionId);
      console.log(`User ${userId || socket.id} joined auction ${auctionId}`);
      const auction = auctions[auctionId];
      const auctionLikes = likes[auctionId] ? likes[auctionId].length : 0;
      const auctionBids = bids[auctionId] || [];

      socket.emit('auctionInitState', {
        auction,
        bids: auctionBids,
        likesCount: auctionLikes
      });

      io.to(auctionId).emit('userJoined', { userId: userId || 'Anonymous Consumer' });
    });

    // Place Bid
    socket.on('placeBid', ({ auctionId, userId, amount }) => {
      if (!auctions[auctionId]) return;
      const auction = auctions[auctionId];

      if (auction.status === 'ended') {
        socket.emit('errorMsg', { message: 'This auction has already ended!' });
        return;
      }

      const minRequired = auction.currentPrice + auction.increment;
      if (amount < minRequired) {
        socket.emit('errorMsg', { message: `Bid must be at least ₹${minRequired}` });
        return;
      }

      // Update state
      auction.currentPrice = amount;
      auction.highestBidder = userId || 'Bidder ' + socket.id.substr(0, 4);

      if (!bids[auctionId]) bids[auctionId] = [];
      bids[auctionId].push({
        userId: auction.highestBidder,
        amount,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      // Check if Target Max Bid (Buyout) reached
      if (auction.maxBid && amount >= auction.maxBid) {
        if (auction.timer) clearTimeout(auction.timer);
        auction.status = 'ended';
        auction.winner = auction.highestBidder;

        io.to(auctionId).emit('bidPlaced', {
          userId: auction.highestBidder,
          amount,
          currentPrice: auction.currentPrice,
          highestBidder: auction.highestBidder
        });

        io.to(auctionId).emit('auctionEnded', {
          winner: auction.highestBidder,
          finalPrice: auction.currentPrice,
          reason: 'target_reached'
        });
        return;
      }

      // Regular bid: Emit bid placed event
      io.to(auctionId).emit('bidPlaced', {
        userId: auction.highestBidder,
        amount,
        currentPrice: auction.currentPrice,
        highestBidder: auction.highestBidder
      });

      // Reset 5-second demo inactivity timer
      if (auction.timer) clearTimeout(auction.timer);
      auction.timer = setTimeout(() => {
        auction.status = 'ended';
        auction.winner = auction.highestBidder;
        io.to(auctionId).emit('auctionEnded', {
          winner: auction.highestBidder,
          finalPrice: auction.currentPrice,
          reason: 'timeout'
        });
      }, 5000); // 5 seconds timer for demo as requested
    });

    // Like Product
    socket.on('likeProduct', ({ auctionId, userId }) => {
      if (!likes[auctionId]) likes[auctionId] = [];
      const user = userId || 'Artisan Fan';
      likes[auctionId].push(user);

      io.to(auctionId).emit('productLiked', {
        userId: user,
        count: likes[auctionId].length
      });
    });
  });
}

// REST Routes
router.get('/', (req, res) => {
  const list = Object.values(auctions).map(auc => ({
    ...auc,
    likesCount: likes[auc.auctionId] ? likes[auc.auctionId].length : 0,
    bidsCount: bids[auc.auctionId] ? bids[auc.auctionId].length : 0,
    timer: undefined // Don't serialize timer object
  }));
  res.json(list);
});

router.get('/:id', (req, res) => {
  const auction = auctions[req.params.id];
  if (!auction) return res.status(404).json({ error: 'Auction not found' });

  res.json({
    ...auction,
    likesCount: likes[auction.auctionId] ? likes[auction.auctionId].length : 0,
    bids: bids[auction.auctionId] || [],
    timer: undefined
  });
});

router.post('/', (req, res) => {
  const { productId, productTitle, productImage, artisanName, category, startPrice, increment, maxBid } = req.body;

  const auctionId = 'auc_' + Date.now();
  auctions[auctionId] = {
    auctionId,
    productId: productId || 'p1',
    productTitle: productTitle || 'Handcrafted Craft Piece',
    productImage: productImage || 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80',
    artisanName: artisanName || 'Sunita Devi',
    category: category || 'Bags',
    startPrice: Number(startPrice) || 500,
    currentPrice: Number(startPrice) || 500,
    increment: Number(increment) || 100,
    maxBid: maxBid ? Number(maxBid) : null,
    highestBidder: null,
    status: 'live',
    timer: null,
    createdAt: new Date().toISOString()
  };
  bids[auctionId] = [];
  likes[auctionId] = [];

  res.status(201).json({ message: 'Auction created successfully', auction: { ...auctions[auctionId], timer: undefined } });
});

module.exports = {
  router,
  initAuctionSocket
};
