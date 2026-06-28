import express from "express"
import { upload } from "../../../utils/multer"
import { UploadControllers } from "./upload.controller"

const router = express.Router()

router.post(
  "/multiple/images",
  upload.array("images", 30),
  UploadControllers.uploadImages
)

export const UploadRoutes = router
