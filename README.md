# Rentlee Cloud

> Enterprise-grade property management — built for landlords, tenants, and platform administrators.

---

## Overview

Rentlee Cloud is a full-stack property management platform that streamlines operations across all stakeholders. Landlords manage properties and financials, tenants handle payments and maintenance, and platform administrators maintain global oversight — all through secure, role-specific portals.

---

## Features

- **Role-Based Access Control (RBAC)** — Distinct, secure portals for Platform Admins, Landlords, Caretakers, and Tenants.
- **Dynamic Financials & PDF Reports** — Automated rent generation, payment tracking, and professional ledger statement exports.
- **M-Pesa Integration** — Seamless mobile money payment processing via the Daraja STK Push API.
- **System Audit Logs** — Real-time, database-driven tracking of system events, property creations, and user registrations.
- **Fully Responsive UI** — Mobile-first design with smooth drawer navigation across all dashboard portals.

---

## Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Landing Page | HTML5, CSS3, Vanilla JavaScript |
| Dashboard | React.js (Vite), React Router, Context API |
| Deployment | Vercel |

### Backend
| Layer | Technology |
|---|---|
| Server | Node.js, Express.js, RESTful APIs |
| Database | PostgreSQL (Supabase) |
| Deployment | Render |

---

## Getting Started

### Prerequisites

- Node.js v16 or higher
- A PostgreSQL / Supabase account
- Git

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/mayorshadeey04-del/rentlee-cloud.git
cd rentlee-cloud
```

**2. Install backend dependencies**

```bash
cd BACKEND
npm install
```

**3. Install frontend dashboard dependencies**

```bash
cd ../FRONTEND/dashboard
npm install
```

### Environment Variables

Create a `.env` file inside the `BACKEND` directory and add the following:

```env
PORT=5001
DATABASE_URL=your_supabase_connection_string
JWT_SECRET=your_jwt_secret
MPESA_CONSUMER_KEY=your_mpesa_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
```

### Running Locally

Open two separate terminal windows:

**Terminal 1 — Backend**

```bash
cd BACKEND
npm start
```

**Terminal 2 — Frontend Dashboard**

```bash
cd FRONTEND/dashboard
npm run dev
```

To view the landing page, open `FRONTEND/landing/index.html` directly in your browser or use the VS Code Live Server extension.

---

## Project Structure

```
rentlee-cloud/
├── BACKEND/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── config/
│   └── server.js
└── FRONTEND/
    ├── dashboard/          # React app (Vite)
    │   └── src/
    │       ├── pages/
    │       ├── components/
    │       └── context/
    └── landing/            # Static HTML/CSS/JS
```

---

## Security

- JWT-based authentication with secure token handling
- Password hashing before storage
- Strict frontend and backend route guards
- Role-based middleware on all protected API endpoints

---

## License

This project is developed as a comprehensive solution for modern property management.
