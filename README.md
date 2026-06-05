# CodeSphere

CodeSphere is a full-stack developer collaboration SaaS with workspaces, projects, tasks, docs, snippets, realtime collaboration, AI assistance, global search, profiles, billing UI, and seed data.

## Stack

- Frontend: React, Vite, Tailwind CSS, Socket.IO client
- Backend: Node.js, Express.js, MongoDB, Mongoose, JWT, Socket.IO
- AI: Gemini via `@google/generative-ai`

## Setup

1. Install dependencies:
   ```bash
   npm run install:all
   ```
2. Copy `.env.example` to `server/.env` and set values.
3. Start MongoDB locally or set `MONGO_URI`.
4. Seed the database:
   ```bash
   npm run seed
   ```
5. Build the React frontend and run the Express server:
   ```bash
   npm start
   ```

Default seeded login:

- Email: `owner@codesphere.dev`
- Password: `Password123!`

## URL

- App and API: `http://localhost:5000`

## OAuth

Real OAuth setup is documented in `docs/oauth-setup.md`. Provider client secrets belong only in `server/.env`.
