# Cloudflare D1 & Pages Deployment Guide

This project is built with direct support for Cloudflare D1 Database and Cloudflare Pages/Workers.

## 1. Create Cloudflare D1 Database
Install wrangler CLI if needed:
```bash
npm install -g wrangler
wrangler login
```

Create the D1 database:
```bash
npx wrangler d1 create sarve_d1_database
```

Copy the returned `database_id` into `cloudflare/wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "sarve_d1_database"
database_id = "<YOUR_DATABASE_ID>"
```

## 2. Execute SQL Schema on Cloudflare D1
```bash
npx wrangler d1 execute sarve_d1_database --file=./schema.sql
```

## 3. Deploy the Cloudflare Worker API
```bash
cd cloudflare
npx wrangler deploy
```

## 4. Deploy Frontend to Cloudflare Pages
In the `client` directory:
```bash
cd client
npm run build
npx wrangler pages deploy dist --project-name=sarve-portal
```

