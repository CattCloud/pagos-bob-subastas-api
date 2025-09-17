## **ARQUITECTURA GENERAL**

### **Tipo de Arquitectura: Frontend-Backend Separado**

```
┌─────────────────┐    HTTP/REST API    ┌─────────────────┐
│                 │ ←----------------→  │                 │
│    FRONTEND     │                     │    BACKEND      │
│   (React SPA)   │                     │  (Express API)  │
│                 │                     │                 │
└─────────────────┘                     └─────────────────┘
                                                 │
                                                 ▼
                                        ┌─────────────────┐
                                        │   POSTGRESQL    │
                                        │   (Neon Cloud)  │
                                        └─────────────────┘

```

---

## **STACK TECNOLÓGICO COMPLETO**

### **FRONTEND**

| Tecnología | Propósito |
| --- | --- |
| **React** | UI Framework |
| **JavaScript** | Lenguaje Programacion |
| **Vite** | Build Tool |
| **TailwindCSS** | CSS Framework |
| **React Router** | Routing SPA |
| **React Hook Form** | Manejo Formularios |
| **Fetch** | HTTP Client |
| **React Icons** | Iconografía |
| **React Hot Toast** | Notificaciones UI |
| **React Dropzone** | File Upload |
| **React Query** | State Management |
| **EmailJS** | Envío correos desde frontend |

### **BACKEND**

| Tecnología | Propósito |
| --- | --- |
| **JavaScript** | Lenguaje Programacion |
| **Node.js** | Runtime |
| **Express.js** | API Builder |
| **Joi** | Validación |
| **Multer** | File Upload |
| **Cloudinary** | File Storage |
| **Cors** | CORS Policy |
| **Winston** | Logging |
| **Node Cron** | Cron Jobs |
| **UUID** | UUID Generation |
| **Prisma** | ORM + Migrations |

### **BASE DE DATOS**

| Tecnología | Propósito |
| --- | --- |
| **PostgreSQL**  | Base de datos principal |
| **Neon** | Database Hosting |
| **Prisma** | ORM + Migrations |

### **SERVICIOS EXTERNOS**

| Servicio | Propósito |
| --- | --- |
| **Cloudinary** | Storage archivos (comprobantes, vouchers) |
| **EmailJS** | Envío automático de correos sin backend SMTP |

### **DESARROLLO Y DEPLOYMENT**

| Tecnología | Propósito |
| --- | --- |
| **Git** | Control versiones |
| **GitHub** | Repository hosting |
| **ESLint** | Code Linting |
| **Prettier** | Code Formatting |
| **Render** | Frontend Hosting |
| **Railway** | Backend Hosting |

---

## **ESTRUCTURA DE CARPETAS DETALLADA**

- Uso del Patron MVC en Fronted y Backend

### **FRONTEND - Estructura de Carpetas**

```
src/
├── components/          # Componentes reutilizables
│   ├── ui/             # Componentes base (Button, Input, Modal)
│   ├── forms/          # Formularios específicos
│   ├── layout/         # Header, Sidebar, Layout
│   └── common/         # Loading, Error, Toast
├── pages/              # Páginas/Vistas principales
│   ├── client/         # HU del cliente
│   ├── admin/          # HU del administrador
│   └── auth/           # Identificación
├── hooks/              # Custom hooks
├── services/           # API calls (Axios)
├── utils/              # Utilidades, helpers
├── constants/          # Constantes, configs
├──App.jsx
├──index.css            # Archivo de estilos CSS - Tailwind
├──main.jsx

```

### **BACKEND - Estructura de Carpetas**

```
src/
├── controllers/        # Lógica de endpoints
├── services/           # Lógica de negocio
├── models/             # Prisma schema
├── middleware/         # Auth, validation, error handling
├── routes/             # Definición de rutas
├── utils/              # Helpers, validations
├── config/             # Database, cloudinary config
├── jobs/               # Cron jobs
└── tests/              # Unit & integration tests
└── utils/
└── index.js

```

### **BASE DE DATOS - Estructura Prisma**

```
prisma/
├── schema.prisma       # Schema principal
├── migrations/         # Historial de cambios
└── seed.ts             # Data inicial (admin user)

```

---

## **MANEJO DE ESTADO**

### **Frontend**

```bash
┌─────────────────────┐
│   React Query       │  ← Server State (API data, cache)
│   (Server State)    │
└─────────────────────┘

┌─────────────────────┐
│   React useState    │  ← Local State (forms, UI state)
│   (Component State) │
└─────────────────────┘

┌─────────────────────┐
│   LocalStorage      │  ← Session State (user session)
│   (Session State)   │
└─────────────────────┘

```

### **Backend**

- **Stateless API** - No estado entre requests
- **Database** - Single source of truth
- **Session Management** - UUID en LocalStorage (1 hora)