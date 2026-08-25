# AI Chatbot Web App

A MERN-style AI assistant web app for:
- personal finance guidance
- study / DSA / programming explanations
- hybrid finance + productivity prompts

## Features
- Real-time chat interface with sidebar and responsive layout
- Login / signup modal with guest-mode support
- Guest message limit with re-prompt to sign in
- Express API with JWT auth and MongoDB-ready schema
- In-memory fallback mode when MongoDB is not configured
- Rule-based intent detection for finance and study queries
- Message persistence in chat history for authenticated users

## Tech stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Auth: JWT + bcrypt
- Database: MongoDB-ready Mongoose models with in-memory fallback

## Run locally
1. Install dependencies:
   npm install
   npm --prefix client install
2. Start the app:
   npm run dev
3. Open:
   - Frontend: http://localhost:5173
   - API: http://localhost:5050/api/health

## Environment variables
Copy the examples and configure values:
- .env.example
- client/.env.example

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` if you want the site owner to log in and view the stored client list and login counts.

## Notes
- The app uses a fallback in-memory store when MONGODB_URI is not provided.
- This allows the project to run locally without a live MongoDB instance.
- Registered users are stored in the backend, and owner/admin access can fetch the user list and totals from `/api/admin/overview`.
