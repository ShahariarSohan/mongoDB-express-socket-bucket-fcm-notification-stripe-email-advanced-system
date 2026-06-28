import multer from "multer"

// Configure Multer to store files in memory
export const upload = multer({
  storage: multer.memoryStorage(), // Store the file buffer in memory
  limits: { fileSize: 50 * 1024 * 1024 }, // Limit file size to 5 MB
})

export const uploadSingle = upload.single("image")

export const uploadMiddleware = upload.fields([
  { name: "invoice", maxCount: 1 }, // Single invoice field
  { name: "image", maxCount: 1 }, // Single image field
])

export const uploadVideo = upload.single("video")
