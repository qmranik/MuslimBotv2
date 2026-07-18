# MuslimBot OS - Landing Page

This repository contains the front-end marketing site for **MuslimBot OS**.

MuslimBot is the open-source, AI-first sovereign command center uniting ERP (Frappe), support (Chatwoot), marketing (TryPost), and workflows (n8n) for growing SMEs. It features a dynamically rendering Generative UI powered by a hyper-fast Go orchestrator.

## Tech Stack
- React
- Vite
- Tailwind CSS
- Lucide Icons
- Framer Motion

## Development

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

## Architecture Notes
The landing page relies heavily on an "Agentic Neo" design system:
- **`src/components/sections/`**: Houses all major page blocks (Hero, Use Cases, Ecosystem, Architecture, etc.).
- **`src/components/MobileNav.jsx` & `FloatingNav.jsx`**: Handles the floating "tool box" navigation scheme.
- **Glassmorphism**: Relies on Tailwind backdrop filters (`backdrop-blur-md`) and subtle white borders (`border-white/10`).

## Sovereignty by Design
Built by the liteERP team. All systems mentioned (Frappe, Chatwoot, n8n, TryPost, Traefik, Authentik) are open-source and deployable via Docker Compose for 100% data sovereignty.
