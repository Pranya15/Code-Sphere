# Code-Sphere

CodeSphere is a full-stack MERN collaboration platform featuring project management, task tracking, team workspaces, real-time communication, AI-powered assistance, authentication, analytics dashboards, billing management, and secure cloud-based deployment.

## Features

* Team Workspaces
* Project & Task Management
* Real-time Collaboration
* AI-Powered Assistant
* Global Search
* Authentication & Authorization
* Analytics Dashboard
* Profile Management
* Billing Management
* Document & Snippet Sharing

## Tech Stack

### Frontend

* React
* Vite
* Tailwind CSS
* Socket.IO Client

### Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT Authentication
* Socket.IO

### AI Integration

* Google Gemini API

## Installation

```bash
npm run install:all
```

## Environment Setup

Copy `.env.example` and configure:

```bash
MONGO_URI=
JWT_SECRET=
GEMINI_API_KEY=
```

## Run Project

```bash
npm run seed
npm start
```

## Default Login

Email: [owner@codesphere.dev](mailto:owner@codesphere.dev)

Password: Password123!

## Local URL

```text
http://localhost:5000
```

## OAuth

OAuth provider configuration is documented in `docs/oauth-setup.md`.
 