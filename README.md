# MEGO FORCE Management System

Sistema de gestión de contratos, pedidos de uniformes, registros de participantes y control de producción de MEGO FORCE.

- Portal público (clientes): https://mego-registro.systemagencygarciavargas.tech
- Panel administrativo: https://mego-admin.systemagencygarciavargas.tech

Stack: React 19 + Vite + Tailwind v4, servidor Express (`server.ts`), Firebase Auth y Firestore.

## Desarrollo local

Requisito: Node.js 22.

1. `npm install`
2. `cp .env.example .env` (opcional; en localhost se ven el portal y el panel a la vez)
3. `npm run dev` y abre http://localhost:3000

Comandos útiles: `npm run lint`, `npm run build`, `npm test`, `npm start` (producción, tras el build).

## Publicación

Ver [DEPLOY.md](DEPLOY.md): imagen Docker en GitHub Container Registry y despliegue en el Docker Manager de Hostinger.
