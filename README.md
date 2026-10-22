# FinComm Frontend

React interface for the FinComm team communication prototype. It connects to the companion [backend API](https://github.com/teddythedev700/team-sabi-api-portfolio).

> This is an educational prototype. Do not use it with real users or sensitive data without reviewing and hardening the backend authorization and deployment configuration.

## Requirements

- Node.js and npm
- The FinComm backend running locally or at a configured API URL

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Optionally create `.env.local` and set the backend URL:

   ```dotenv
   REACT_APP_API_URL=http://localhost:5000
   ```

3. Start the development server:

   ```bash
   npm start
   ```

The frontend uses `http://localhost:5000` when `REACT_APP_API_URL` is not set.

## Available scripts

- `npm start` — start the development server
- `npm run build` — create a production build
- `npm test` — run the React Scripts test runner

## Notes

The backend database schema does not include demo accounts. Register an account through the app after starting the backend and applying its schema.
