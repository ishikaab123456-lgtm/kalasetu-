# KalaSetu Consumer AI Recommendation System

## User flow

Consumer Signup/Login
→ Preference onboarding
→ Personalized ranking
→ Recommended for You
→ Bestsellers
→ System learns from views / wishlist / enquiries

## Preference onboarding

The consumer can select multiple values:

- Categories: Bags, Textiles, Jewelry, Pottery, Woodwork, Paintings, Metalwork
- Shopping purpose: Gifting, Home Décor, Fashion, Festivals/Weddings, Collectibles, Everyday Use
- Style: Traditional, Contemporary, Eco-friendly, Colorful, Minimal, Heritage
- Material: Cotton, Silk, Jute, Wood, Clay, Brass, Natural Dyes
- Budget
- Preferred craft regions

## Recommendation logic

This prototype uses an **explainable hybrid recommender**.

It combines:

1. Content-based matching
   - category
   - material
   - occasion
   - style
   - budget
   - region

2. Bestseller/popularity signals
   - demo sales
   - enquiries
   - product views

3. Behavioral signals
   - product views
   - wishlist
   - enquiries

The ranking is recalculated on the backend.

This is stronger for the SIH prototype than a black-box recommendation because judges can understand why a product was suggested.

## API

### Get recommendations
`GET /api/recommendations`

### Get preferences
`GET /api/preferences`

### Save preferences
`PUT /api/preferences`

### Record user activity
`POST /api/recommendations/interaction`

## Viva answer

“Our consumer recommendation system is a hybrid, explainable recommender. At onboarding, the consumer selects multiple interests such as craft category, budget, use case, style and materials. We combine those content signals with bestseller popularity and later behavior such as views, wishlist actions and enquiries. This allows recommendations to be useful immediately for a new user and become more personalized as the user interacts with the marketplace.”
