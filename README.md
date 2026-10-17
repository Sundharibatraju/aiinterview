



**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` (a local `.env` is included as a starting point) and set the credentials you need.
   Set `DATABASE_URL` to your PostgreSQL/Neon connection string. For Neon, use the pooled connection string and retain `sslmode=require`.
3. Run the app:
   `npm run dev`

The server loads `.env` at startup and uses `DATABASE_URL` to connect to PostgreSQL. Keep `.env` private; do not commit real API keys, passwords, or database connection strings.

## Deploying to Netlify

This project is configured to deploy directly to **Netlify** using Netlify Serverless Functions for the Express backend and Netlify CDN for the React frontend, **without requiring any changes to `server.ts`**.

### Configuration Summary
- `netlify.toml`: Defines build settings (`npm run build`, `publish = "dist"`), function directory (`netlify/functions`), and automatic rewrite rules for API (`/api/*` &rarr; `/.netlify/functions/api/:splat`) and SPA client routes (`/*` &rarr; `/index.html`).
- `netlify/functions/api.ts`: Wraps and serves the Express backend serverlessly while preserving all routes, authentication, and file upload endpoints.
- `public/_redirects`: Provides static redirect guarantees for SPA routing and API proxying.

### Steps to Deploy

#### Option 1: Git Integration (Recommended)
1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Go to [Netlify Dashboard](https://app.netlify.com/) and click **"Add new site" > "Import an existing project"**.
3. Select your repository. Netlify will auto-detect the configuration from `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
4. Under **Site configuration > Environment variables**, add your secrets:
   - `GEMINI_API_KEY`: Your Google Gemini API key.
   - `DATABASE_URL`: PostgreSQL / Neon pooled connection string (`sslmode=require`).
   - `SECRET_KEY`: Session/auth secret token.
   - `APP_URL`: Your Netlify site URL (e.g., `https://your-site-name.netlify.app`).
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: (Optional) Google OAuth credentials.
   - `SMTP_USER` / `SMTP_PASS` / `SMTP_HOST`: (Optional) Email SMTP credentials.
5. Click **Deploy Site**.

#### Option 2: Netlify CLI
1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```
2. Link or initialize your project:
   ```bash
   netlify init
   ```
3. Deploy to production:
   ```bash
   netlify deploy --prod
   ```
