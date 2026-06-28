import dotenv from "dotenv";
import path from "path";
import { validateEnv } from "./env.validation";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env") });

// Validate environment variables
const env = validateEnv();

const config = {
    // Server
    NODE_ENV: env.NODE_ENV,
    port: parseInt(env.PORT, 10),
    clientName: env.CLIENT_NAME || "Backend API",

    // Database
    DATABASE_URL: env.DATABASE_URL,

    // Authentication
    jwt_secret: env.TOKEN_SECRET,
    secretToken: env.TOKEN_SECRET,
    adminPass: env.ADMIN_PASS,

    // DigitalOcean Spaces / S3
    DO_SPACE_ENDPOINT: env.DO_SPACE_ENDPOINT,
    DO_SPACE_ACCESS_KEY: env.DO_SPACE_ACCESS_KEY,
    DO_SPACE_SECRET_KEY: env.DO_SPACE_SECRET_KEY,
    DO_SPACE_BUCKET: env.DO_SPACE_BUCKET,

    // Stripe
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,

    // Firebase
    FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY: env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: env.FIREBASE_CLIENT_EMAIL,

    // Email
    SMTP_HOST: env.SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : undefined,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASS: env.SMTP_PASS,
    SMTP_FROM_EMAIL: env.SMTP_FROM_EMAIL,
    
    // Backwards compatibility for email (used in sendMailFn.ts)
    mail_host: env.SMTP_HOST || env.MAIL_HOST,
    mail_port: env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : (env.MAIL_PORT ? parseInt(env.MAIL_PORT, 10) : 587),
    mail_user: env.SMTP_USER || env.MAIL_USER,
    mail_pass: env.SMTP_PASS || env.MAIL_PASS,

    // Twilio
    TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,

    // Redis
    REDIS_HOST: env.REDIS_HOST,
    REDIS_PORT: parseInt(env.REDIS_PORT, 10),

    // Feature flags
    isDevelopment: env.NODE_ENV === "development",
    isProduction: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
};

export default config;