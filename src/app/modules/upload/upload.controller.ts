import catchAsync from "../../../shared/catchAsync"
import { UploadServices } from "./upload.service"

const uploadImages = catchAsync(async (req: any, res: any) => {
  const imageUrls = await UploadServices.uploadImages(req)

  res.status(200).json({
    success: true,
    message: "Images uploaded successfully",
    data: imageUrls,
  })
})

export const UploadControllers = {
  uploadImages,
}
