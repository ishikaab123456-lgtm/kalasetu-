const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(bodyParser.json());

// In-memory store (replace with DB later)
let auctions = {};
let bids = {};
let likes = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinAuction', ({ auctionId, userId }) => {
    socket.join(auctionId);
    io.to(auctionId).emit('userJoined', { userId });
  });

  socket.on('placeBid', ({ auctionId, userId, amount }) => {
    if (!auctions[auctionId]) return;
    const auction = auctions[auctionId];

    if (amount >= auction.currentPrice + auction.increment) {
      auction.currentPrice = amount;
      auction.highestBidder = userId;
      bids[auctionId].push({ userId, amount, time: Date.now() });

      io.to(auctionId).emit('bidPlaced', {
        userId,
        amount,
        currentPrice: auction.currentPrice
      });

      // Reset inactivity timer
      clearTimeout(auction.timer);
      auction.timer = setTimeout(() => {
        io.to(auctionId).emit('auctionEnded', {
          winner: auction.highestBidder,
          finalPrice: auction.currentPrice
        });
      }, 20000);
    }
  });

  socket.on('likeProduct', ({ auctionId, userId }) => {
    if (!likes[auctionId]) likes[auctionId] = [];
    likes[auctionId].push(userId);
    io.to(auctionId).emit('productLiked', { userId });
  });
});

// REST endpoint to create auction
app.post('/auction', (req, res) => {
  const { auctionId, productId, startPrice, increment } = req.body;
  auctions[auctionId] = {
    productId,
    startPrice,
    increment,
    currentPrice: startPrice,
    highestBidder: null,
    timer: null
  };
  bids[auctionId] = [];
  res.json({ message: 'Auction created', auctionId });
});

server.listen(4000, () => console.log('Server running on port 4000'));
