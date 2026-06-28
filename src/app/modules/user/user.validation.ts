import z from "zod";

const createUser = z.object({
  name: z.string().optional(),
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
  platform: z.enum(["ANDROID", "IOS"], {
    invalid_type_error: "Platform must be ANDROID or IOS!",
  }).optional(),
});

export const userValidation = {
  createUser,
};
