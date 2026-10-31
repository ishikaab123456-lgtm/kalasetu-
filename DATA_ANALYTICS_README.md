# KalaSetu Data Intelligence — SIH Analytics Page

This build adds one complete **Data Intelligence** page covering both sides of the marketplace:

## Artisan Selling
- Units sold
- Sales value / revenue
- Product impressions/views
- Sales-to-view conversion signal
- Six-month sales trend
- Top products sold
- Revenue by craft category
- Buyer enquiries
- Average order value
- AI-generated business insight statements

## Consumer Buying
- Marketplace buyer spending
- Average buyer spend
- Active craft categories
- Products bought
- "What's Trending Now" category ranking
- Six-month spending trend
- Buyer spend by category donut
- Fields of interest
- Personal preference chips
- Popular price bands
- AI market insight statements

## How it is calculated

The analytics API aggregates:
- `products` — views, enquiries, sales, price, category
- `consumer_preferences` — selected categories/materials/styles
- `interactions` — views, wishlists, enquiries
- existing Supabase tables when Supabase is configured
- local JSON fallback when Supabase is not configured

The same database adapter is used, so no new Supabase table is required.

## Important SIH data note

The existing project contains demo product metrics (`sales`, `views`, `enquiries`), so the dashboard labels them as demo marketplace data.

The six-month line charts are **illustrative trends** created by distributing the current demo totals over six months. They are clearly labelled in the UI. After deployment, replace them with real dated order/history records.

## API

Authenticated endpoint:

`GET /api/analytics`

Returns:
- `selling`
- `buying`
- `database`
- `dataNote`

## Navigation

- Artisan bottom navigation now contains **Insights**
- Consumer bottom navigation now contains **Insights**
- Consumer Home has a "Market Trends & Buyer Insights" quick card
- Artisan Studio has a "Sales & Performance Analytics" quick card
