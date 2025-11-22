# Deployment Guide

Since this app uses a backend server (Node.js + Socket.io), you cannot use static hosts like Netlify or Vercel (unless you use their serverless functions, which don't support WebSockets easily).

## Recommended Options (Free Tiers)

### Option 1: Render (Easiest)
1.  **Push to GitHub**:
    - Create a new repository on GitHub.
    - Run these commands in your terminal:
      ```bash
      git add .
      git commit -m "Ready for deployment"
      git branch -M main
      git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
      git push -u origin main
      ```
2.  **Deploy on Render**:
    - Go to [dashboard.render.com](https://dashboard.render.com/).
    - Click **New +** -> **Web Service**.
    - Connect your GitHub repository.
    - **Settings**:
        - **Runtime**: Node
        - **Build Command**: `npm install`
        - **Start Command**: `npm start`
    - Click **Create Web Service**.

### Option 2: Railway
1.  **Push to GitHub** (same as above).
2.  **Deploy on Railway**:
    - Go to [railway.app](https://railway.app/).
    - Click **Start a New Project** -> **Deploy from GitHub repo**.
    - Select your repo.
    - It will automatically detect Node.js and deploy.

## Important Notes
- **Ephemeral Storage**: Remember that messages are stored in memory. If the server restarts (which happens on free tiers when idle), chat history will be lost.
