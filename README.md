# 🚀 starter pack Backend API

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-blueviolet)](https://www.prisma.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-success)](https://www.mongodb.com/)

## 📋 Overview

A **production-grade**, **scalable**, and **modular** Node.js/TypeScript backend boilerplate built with industry best practices. Features comprehensive security, monitoring, logging, and auto-generated documentation.

## ✨ Features

### Core Features
- ⚡ **TypeScript** for type safety and better DX
- 🚀 **Express.js** REST API framework
- 🗄️ **MongoDB** with **Prisma ORM**
- 🔐 **JWT Authentication** with role-based access control
- 📁 **File Upload** (DigitalOcean Spaces/AWS S3)
- 🔍 **Dynamic Query Builder** with filtering & pagination
- 🔌 **WebSocket** support for real-time features
- 📚 **Swagger/OpenAPI** auto-generated documentation
- 🔍 **Advanced Search** with autocomplete and filters

### Production-Grade Features
- 🛡️ **Security Hardening**
  - Helmet.js for HTTP headers
  - Rate limiting (100 req/15min in production)
  - MongoDB injection prevention
  - XSS protection
  - HPP (HTTP Parameter Pollution) prevention
- 📊 **Monitoring & Health Checks**
  - `/health` - Basic health endpoint
  - `/health/detailed` - Comprehensive system check
  - `/health/liveness` - Kubernetes liveness probe
  - `/health/readiness` - Kubernetes readiness probe
- 📝 **Winston Logger** with file rotation
- ✅ **Environment Validation** with Zod
- 🔄 **Graceful Shutdown** handling (30s timeout)
- 🗜️ **Response Compression**
- 🎯 **Centralized Error Handling**

### Advanced Features 🆕
- 💾 **Redis Caching** with automatic invalidation
- 🔄 **BullMQ Message Queues** (email, notifications, image processing)
- ⏰ **Cron Jobs** (OTP cleanup, reports, backups)
- 📡 **Event-Driven Architecture** (11 event types)
- 💬 **WebSocket Enhancements**
  - Typing indicators
  - Online status tracking
  - Heartbeat mechanism
- 🔍 **Search Functionality**
  - Global search (users, services)
  - Advanced filters (price range, sorting)
  - Autocomplete suggestions
- 🗄️ **Database Optimization** (15+ indexes)
- 🧪 **Testing Infrastructure** (Jest + Supertest)

## 📁 Project Structure

```
src/
├── app/
│   ├── db/                     # Database connection & seeding
│   ├── error/                  # Custom error classes
│   ├── helper/                 # Helper functions
│   ├── interface/              # TypeScript interfaces
│   ├── middleware/             # Express middleware
│   │   ├── auth.ts
│   │   ├── security.ts         # Security middleware
│   │   ├── cache.ts            # Redis caching middleware
│   │   ├── globalErrorHandler.ts
│   │   └── validateRequest.ts
│   ├── modules/               # Feature modules
│   │   ├── auth/
│   │   ├── user/
│   │   ├── upload/
│   │   ├── notifications/
│   │   ├── payment/
│   │   ├── webhook/
│   │   ├── search/            # 🆕 Search endpoints
│   │   └── health/            # Health check endpoints
│   └── route/                 # Route registration
├── config/                    # Configuration files
│   ├── index.ts              # Main config
│   ├── env.validation.ts     # Environment validation
│   └── swaggerConfig.ts
├── shared/                    # Shared utilities
├── socket/                    # 🆕 WebSocket server
│   └── setupWebSocket.ts
├── utils/                     # Utility functions
│   ├── cron/                 # 🆕 Scheduled jobs
│   │   ├── index.ts
│   │   └── jobs/
│   ├── events/               # 🆕 Event emitter system
│   │   ├── index.ts
│   │   ├── loader.ts
│   │   ├── user.listeners.ts
│   │   ├── booking.listeners.ts
│   │   ├── payment.listeners.ts
│   │   └── review.listeners.ts
│   ├── queue/                # 🆕 BullMQ job queues
│   │   ├── index.ts
│   │   └── workers/
│   ├── prisma.ts             # Prisma client (singleton)
│   ├── redis.ts              # 🆕 Redis client
│   ├── logger.ts             # Winston logger
│   ├── multer.ts             # File upload config
│   ├── stripe.ts             # Stripe integration
│   └── uploadImage.ts        # Image upload to S3
├── app.ts                     # Express app setup
└── server.ts                  # Server entry point

prisma/
└── schema.prisma             # Database schema

scripts/
├── generateModule.js         # Module generator
└── templates/                # Code templates

tests/                        # 🆕 Test files
├── setup.ts
├── integration/
└── unit/

logs/                         # Application logs
├── combined.log
├── error.log
└── exceptions.log
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 18.x
- **npm** or **yarn**
- **MongoDB** (local or cloud)
- **DigitalOcean Spaces** or **AWS S3** (optional, for file uploads)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd backend-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   
   Create a `.env` file in the root directory:
   ```env
   # Server
   NODE_ENV=development
   PORT=5000
   CLIENT_NAME=My Backend API

   # Database
   DATABASE_URL=mongodb://localhost:27017/your-database

   # Authentication
   TOKEN_SECRET=your-super-secret-jwt-token-min-32-chars-long
   ADMIN_PASS=SecureAdminPassword123

   # DigitalOcean Spaces / AWS S3
   DO_SPACE_ENDPOINT=nyc3.digitaloceanspaces.com
   DO_SPACE_ACCESS_KEY=your-access-key
   DO_SPACE_SECRET_KEY=your-secret-key
   DO_SPACE_BUCKET=your-bucket-name

   # Stripe
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...

   # Email (Optional)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM_EMAIL=noreply@yourdomain.com

   # Twilio (Optional)
   TWILIO_ACCOUNT_SID=ACxxx...
   TWILIO_AUTH_TOKEN=xxx...
   TWILIO_PHONE_NUMBER=+1234567890
   ```

4. **Generate Prisma Client & Push Schema**
   ```bash
   npm run gen
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

   Server will start on `http://localhost:5000`

## 📜 Available Scripts

| Command              | Description                                    |
|---------------------|------------------------------------------------|
| `npm run dev`       | Start development server with hot reload      |
| `npm run build`     | Build TypeScript to JavaScript               |
| `npm start`         | Run production build                          |
| `npm run lint`      | Run ESLint                                    |
| `npm run lint:fix`  | Fix ESLint errors                             |
| `npm run prettier`  | Format code with Prettier                     |
| `npm run gen`       | Generate Prisma client & push schema         |
| `npm run cModule`   | Generate new module with templates            |
| `npm run genDoc`    | Generate Swagger documentation for module     |
| `npm run genPostman`| 🆕 Auto-generate Postman collection from routes |

## 🔌 API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system health
- `GET /health/liveness` - Kubernetes liveness probe
- `GET /health/readiness` - Kubernetes readiness probe

### Core APIs
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/users` - Get all users (protected)
- `POST /api/v1/upload/multiple/images` - Upload images
- `GET /api/v1/notifications` - Get notifications
- `POST /api/v1/payments/create` - Create payment

### Documentation
- `GET /api-docs` - Swagger UI documentation

## � Postman Collection

A comprehensive Postman collection is available in the `postman/` directory with:
- ✅ **31 API endpoints** fully documented
- ✅ **Automatic token management** (auto-saves JWT after login)
- ✅ **2 environments** (Local & Production)
- ✅ **Test scripts** for automated testing
- ✅ **Examples** for all request types

### Quick Import
1. Open Postman
2. Click **Import**
3. Select files from `postman/` directory:
   - `Cadence_Backend_API.postman_collection.json`
   - `Local.postman_environment.json`
   - `Production.postman_environment.json`

See [postman/README.md](postman/README.md) for detailed usage instructions.

## �🛡️ Security Features

- ✅ **Helmet.js** - Security headers
- ✅ **Rate Limiting** - Prevent DDoS attacks
- ✅ **MongoDB Injection Prevention** - Sanitize queries
- ✅ **XSS Protection** - Prevent cross-site scripting
- ✅ **HPP Protection** - Prevent HTTP parameter pollution
- ✅ **CORS Configuration** - Controlled origin access
- ✅ **JWT Authentication** - Secure token-based auth

## 📊 Monitoring

### Logging
- **Winston** logger with multiple transports
- Logs stored in `logs/` directory
- Separate files for errors, combined logs, exceptions
- Request logging with Morgan

### Health Monitoring
Use health endpoints for:
- Docker health checks
- Kubernetes probes
- Monitoring tools (Prometheus, etc.)
- Load balancer health checks

## 🔧 Module Generation

Generate a new module with all boilerplate:

```bash
npm run cModule

# Follow the prompts to create:
# - Controller
# - Service
# - Routes
# - Validation
# - Documentation
```

## 🚢 Deployment

### Docker (Coming Soon)
```bash
docker build -t backend-api .
docker run -p 5000:5000 backend-api
```

### Environment Variables
Ensure all required environment variables are set in production:
- Use secret management (AWS Secrets Manager, Vault, etc.)
- Never commit `.env` files
- Validate env vars on startup

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS origins
- [ ] Set strong `TOKEN_SECRET`
- [ ] Enable HTTPS
- [ ] Configure rate limiting
- [ ] Set up monitoring and alerting
- [ ] Configure log rotation
- [ ] Set up database backups
- [ ] Configure CDN for static files

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Contact: [your-email@example.com]

---

**Made with ❤️ for scalable backend development**
