import z from "zod";
const loginUser = z.object({
    email: z
        .string({
            required_error: "Email is required!",
        })
        .email({
            message: "Invalid email format!",
        }),
    password: z.string({
        required_error: "Password is required!",
    }),
    fcmToken: z.string().optional(),
    platform: z.enum(["ANDROID", "IOS"]).optional(),
});

const forgotPassword = z.object({
    email: z
        .string({
            required_error: "Email is required!",
        })
        .email({
            message: "Invalid email format!",
        }),
});

const verifyOtp = z.object({
    email: z
        .string({
            required_error: "Email is required!",
        })
        .email({
            message: "Invalid email format!",
        }).optional(),
    otp: z.number({
        required_error: "OTP is required!",
    }),
});

const changePassword = z.object({
    newPassword: z.string({
        required_error: "New password is required!",
    }),
});

const resetPassword = z.object({
    email: z
        .string({
            required_error: "Email is required!",
        })
        .email({
            message: "Invalid email format!",
        }),
    newPassword: z.string({
        required_error: "New password is required!",
    }),
});

const resendOtp = z.object({
    email: z
        .string({
            required_error: "Email is required!",
        })
        .email({
            message: "Invalid email format!",
        }),
});

export const authValidation = { loginUser, forgotPassword, verifyOtp, changePassword, resetPassword, resendOtp };
