# KalaSetu + Cohere Smart Recommendation System

This build adds **Cohere Rerank** on top of the recommendation system already in KalaSetu.

## Final architecture

Consumer onboarding preferences
+
Budget / material / category / style / purpose / region
+
Consumer behavior (views, wishlist, enquiries, purchases)
+
Bestseller signals (sales, enquiries, impressions)
↓
KalaSetu local recommendation engine
↓
Top 12 candidate products
↓
Cohere Rerank semantic AI
↓
60% KalaSetu score + 40% Cohere semantic relevance
↓
Top 6 "Recommended for You"

## Why this is better than using only an AI API

KalaSetu still controls:
- budget rules
- bestseller data
- user interactions
- explainable reasons
- safe fallback

Cohere adds semantic understanding. It can understand that a consumer interested in
"traditional eco-friendly gifts" may like a handcrafted jute or natural-dye product
even when the wording is not an exact keyword match.

## Automatic fallback

If:
- the key is missing
- internet is unavailable
- Cohere times out
- Cohere returns an API error

KalaSetu automatically uses the existing local hybrid recommendation engine.

The consumer website still works.

## One-time setup on Windows

1. Extract the project.
2. Double-click `SETUP_COHERE_AI.bat`.
3. Paste your Cohere API key.
4. Press Enter.
5. Double-click `START_KALASETU.bat`.

The key is saved only in `.env`.

`.env` is excluded by `.gitignore`.

## Never upload your key

Do NOT put the key in:
- `public/app.js`
- `public/index.html`
- GitHub
- screenshots or PPTs

## API

`GET /api/recommendations`

returns:
- recommended products
- bestseller products
- recommendation reasons
- local/hybrid score
- Cohere semantic score when live
- engine status

`GET /api/recommendations/status`

shows whether Cohere is configured.

## UI

When live Cohere reranking succeeds, the Consumer Home shows:
- `COHERE AI`
- AI semantic match percentage on recommendations
- recommendation reasons such as:
  - strong AI semantic match
  - inside your budget
  - preferred material
  - popular with buyers
