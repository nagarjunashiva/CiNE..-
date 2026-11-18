# CiNE.. — Discover. Explore. Watch. Repeat.

A modern cinematic web application featuring 4K movie discovery, secure MongoDB authentication with OTP verification, and a cloud-synced personal watchlist.

---

## Highlights

* **Full-Stack Authentication**: Complete user authentication system built with Node.js, Express, MongoDB, and Nodemailer.
* **Protected Watchlist**: Curate your favorite films and sync your personal collection across any device. Automatic redirection & login prompt for unauthenticated visitors.
* **Interactive Sliding Auth Card**: Glassmorphism UI with smooth split-sliding animations, password visibility toggle, and instant email verification.
* **Seamless Page Refresh**: Auto-reloads state on login and logout with queued flash notifications.

---

## Tech Stack

### Frontend
* **React 18** (Standalone Babel engine with zero build-step overhead)
* **Tailwind CSS** (Cinematic dark theme with Crimson `#E5242A` accents)
* **Lucide Icons** (Ultra-clean SVG iconography)
* **Cloudflare Workers Proxy** (Edge caching for high-speed TMDB imagery)

### Backend
* **Node.js & Express** (RESTful API architecture)
* **MongoDB & Mongoose** (Persistent local and cloud database storage)
* **Nodemailer** (Transactional SMTP email verification)
* **JWT & bcryptjs** (Encrypted authentication & tokens)

---

## Project Structure

```text
CiNE/
├── assets/                  # Hero artwork & imagery
│   └── luffy-login.jpg      # Cinematic sliding hero banner
├── server/                  # Backend API service
│   ├── middleware/          # JWT authorization guards
│   ├── models/              # Mongoose database models (User)
│   ├── routes/              # Auth & Watchlist REST endpoints
│   ├── utils/               # Nodemailer template engine
│   ├── .env.example         # Environment template
│   └── server.js            # Express server entry point
├── .gitignore               # Ignored credentials & binaries
├── index.html               # Single-page cinematic web application
├── start-server.bat         # One-click Windows server launcher
└── README.md                # Project documentation
```

---

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/nagarjunashiva/CiNE..-.git
cd CiNE..-
```

### 2. Start the Backend Server
```bash
cd server
npm install
npm run dev
# or double-click start-server.bat
```

### 3. Launch the Application
Open `index.html` directly in your browser or serve via any static web server:
```bash
# Example with npx serve
npx serve ..
```

---

## License

This project is licensed under the MIT License.
API data provided by [The Movie Database (TMDB)](https://www.themoviedb.org).
