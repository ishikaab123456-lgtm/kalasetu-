# KalaSetu AI — Quick SIH Viva Guide

## What did we build?

KalaSetu AI has two sides:

**Artisan Side**
Artisan uploads/speaks about a craft → AI helps create a professional listing + price guidance → artisan reviews and publishes.

**Consumer Side**
Consumer selects what they like → KalaSetu recommends relevant products using preferences, bestsellers and later user behavior.

## What database do we use?

We support **Supabase (PostgreSQL)** as the cloud database.

We store:
- user profiles
- product catalogue
- consumer preferences
- interaction events

For hackathon reliability there is also a local JSON fallback.

## How does the recommendation system work?

It is an **explainable hybrid recommendation engine**.

For a new consumer it uses:
- selected categories
- materials
- purpose/occasion
- style
- budget
- region

Then it also uses:
- product sales/popularity
- views
- enquiries

As the consumer uses the app, it learns from:
- product views
- wishlist actions
- enquiries

So the recommendation system solves the **cold-start problem** with onboarding preferences and bestsellers, then becomes more personalized from behavior.

## Why is it AI/recommendation rather than simple filtering?

Filtering removes products that do not match one condition.

Our recommender gives every product a relevance score from multiple signals and ranks the results. A product can still be recommended because it strongly matches the user or because it is a bestseller.

## Why combine personalization with bestsellers?

A new user has no behavior history. Bestseller signals prevent empty/weak recommendations while the preference survey gives immediate personalization.

## What is explainable about it?

The UI shows reasons such as:
- matches Bags
- preferred material
- inside your budget
- good for gifting
- popular with buyers

## What happens after consumer signup?

Signup → preference onboarding → preferences saved → recommendation API ranks products → Recommended for You + Bestsellers appear automatically.

## Architecture

Browser UI
↓
Node.js / Express backend
↓
Authentication + Recommendation Engine
↓
Supabase PostgreSQL
↓
Products / Profiles / Preferences / Interactions

## Important honesty for judges

This prototype uses an explainable hybrid recommendation algorithm. It does not claim to have trained a large custom ML model. The innovation is in combining user preference signals, behavioral learning and marketplace popularity in a workflow suited to artisan commerce.
