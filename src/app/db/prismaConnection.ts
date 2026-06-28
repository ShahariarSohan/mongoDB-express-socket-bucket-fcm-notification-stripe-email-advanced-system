import { hash } from "bcrypt"
import { prisma } from "../../utils/prisma"

export const PrismaConnection = async () => {
    try {
        // Test database connection
        await prisma.$connect()
        console.log("✅ Database connected successfully")

        // Check if admin user exists
        const User = await prisma.user.findUnique({
            where: {
                email: "admin123@gmail.com"
            }
        })

        const newPass = await hash(process.env.ADMIN_PASS as string, 10)

        if (!User) {
            await prisma.user.create({
                data: {
                    email: "admin123@gmail.com",
                    password: newPass,
                    name: "Admin",
                    role: "ADMIN",
                    status: "ACTIVE",
                }
            })
            console.log("✅ Admin user created successfully")
        }
    } catch (error) {
        console.error("❌ Database connection error:", error)
        throw error
    }
}