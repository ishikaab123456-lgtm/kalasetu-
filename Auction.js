import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:4000');

export default function Auction({ auctionId, userId }) {
  const [currentPrice, setCurrentPrice] = useState(0);
  const [highestBidder, setHighestBidder] = useState(null);
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.emit('joinAuction', { auctionId, userId });

    socket.on('bidPlaced', ({ userId, amount, currentPrice }) => {
      setCurrentPrice(currentPrice);
      setHighestBidder(userId);
      setMessages(prev => [...prev, `Bid placed: ${amount} by ${userId}`]);
    });

    socket.on('productLiked', ({ userId }) => {
      setLikes(prev => prev + 1);
      setMessages(prev => [...prev, `${userId} liked the product`]);
    });

    socket.on('auctionEnded', ({ winner, finalPrice }) => {
      setMessages(prev => [...prev, `SOLD to ${winner} for ${finalPrice}`]);
    });
  }, [auctionId, userId]);

  const placeBid = () => {
    socket.emit('placeBid', { auctionId, userId, amount: currentPrice + 100 });
  };

  const likeProduct = () => {
    socket.emit('likeProduct', { auctionId, userId });
  };

  return (
    <div className="auction-container">
      <h2>Auction #{auctionId}</h2>
      <p>Current Price: ₹{currentPrice}</p>
      <p>Highest Bidder: {highestBidder || 'None yet'}</p>
      <button onClick={placeBid}>Raise Price</button>
      <button onClick={likeProduct}>❤️ Like</button>
      <p>Likes: {likes}</p>
      <div className="messages">
        {messages.map((msg, i) => <p key={i}>{msg}</p>)}
      </div>
    </div>
  );
}
