import { z } from "zod";

const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().default("7022"),
    CLIENT_NAME: z.string().optional(),

    // Database
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // Authentication
    TOKEN_SECRET: z.string().min(32, "TOKEN_SECRET must be at least 32 characters"),
    ADMIN_PASS: z.string().min(8, "ADMIN_PASS must be at least 8 characters"),

    // DigitalOcean Spaces / S3
    DO_SPACE_ENDPOINT: z.string().optional(),
    DO_SPACE_ACCESS_KEY: z.string().optional(),
    DO_SPACE_SECRET_KEY: z.string().optional(),
    DO_SPACE_BUCKET: z.string().optional(),

    // Stripe
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // Firebase (Optional)
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),

    // Email (Nodemailer)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM_EMAIL: z.string().optional(),
    
    // Backwards compatibility for brevo/smtp-relay (used in sendMailFn.ts)
    MAIL_HOST: z.string().optional(),
    MAIL_PORT: z.string().optional(),
    MAIL_USER: z.string().optional(),
    MAIL_PASS: z.string().optional(),

    // Twilio (SMS)
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_PHONE_NUMBER: z.string().optional(),

    // Redis
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.string().default("6379"),
    REDIS_PASSWORD: z.string().optional(),
    FRONTEND_URL: z.string().optional(),
    
    // Brevo SMTP (Replaces nodemailer config)
    BREVO_HOST: z.string().optional(),
    BREVO_USER: z.string().optional(),
    BREVO_PASSWORD: z.string().optional(),
    BREVO_EMAIL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (): Env => {
    try {
        const env = envSchema.parse(process.env);
        console.log("✅ Environment variables validated successfully");
        return env;
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error("❌ Environment variable validation failed:");
            error.errors.forEach((err) => {
                console.error(`  - ${err.path.join(".")}: ${err.message}`);
            });
        }
        process.exit(1);
    }
};
