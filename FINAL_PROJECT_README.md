# KalaSetu AI — Final SIH Prototype

This is the integrated SIH prototype with both **Artisan** and **Consumer** experiences.

## Added in this final version

### Authentication
- Artisan / Consumer role toggle
- Phone / Email + Password
- Create Account
- Forgot Password
- Password hashing + session tokens

### Artisan Side
- Dashboard
- AI Add Product flow
- Photo / voice / listing / pricing
- Catalogue management
- Profile
- Analytics

### Consumer Side
- Preference onboarding after first signup/login
- Multiple interests can be selected
- AI-ranked “Recommended for You”
- Bestseller section
- Search / category browse
- Product detail
- Wishlist
- Enquiry / order interest
- Live auctions already present in your project

### Database
- Supabase integration
- Profiles
- Products
- Consumer preferences
- Interaction events
- Automatic local JSON fallback for SIH reliability

### Recommendation Engine
- Content-based personalization
- Bestseller popularity
- Behavior learning
- Explainable “why recommended” labels

## Run on Windows

1. Extract the ZIP.
2. Double-click `START_KALASETU.bat`.
3. Wait for npm install/start.
4. Open `http://localhost:4000`.

## Demo Consumer

Email:
`consumer@kalasetu.demo`

Password:
`KalaSetu@123`

On the first consumer login, choose preferences and the system will immediately rank products.

## Demo Artisan

Email:
`artisan@kalasetu.demo`

Password:
`KalaSetu@123`

## Supabase

The app works without Supabase using local fallback.

To activate real cloud database:
read `SUPABASE_SETUP.md`.

## Important for GitHub

Do NOT commit:
- `.env`
- Supabase service-role key
- AI API secrets
- passwords / tokens

The `.gitignore` already excludes `.env`.


## Cohere AI recommendation

Run `SETUP_COHERE_AI.bat` once, paste your Cohere API key, then restart KalaSetu. See `COHERE_RECOMMENDATION_SETUP.md`.
