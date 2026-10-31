# Add This Final Version to GitHub

Use your own branch instead of replacing main directly.

```powershell
git checkout main
git pull origin main
git checkout -b consumer-ai-supabase
```

Copy the final project files into the repository.

Check:

```powershell
git status
git diff
```

Then:

```powershell
git add .
git commit -m "Add Supabase database and consumer recommendation system"
git push -u origin consumer-ai-supabase
```

Create a Pull Request.

## New important files

```text
services/database.js
services/recommendationEngine.js
routes/preferences.js
routes/recommendations.js
supabase/schema.sql
SUPABASE_SETUP.md
RECOMMENDATION_SYSTEM.md
```

## Never commit

```text
.env
SUPABASE_SERVICE_ROLE_KEY
AI API keys
passwords/tokens
node_modules/
```
