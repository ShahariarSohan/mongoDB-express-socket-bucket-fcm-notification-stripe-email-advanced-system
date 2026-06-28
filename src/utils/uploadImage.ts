import AWS from "aws-sdk"
import httpStatus from "http-status"
import { v4 as uuidv4 } from "uuid"
import ApiError from "../app/error/ApiErrors"
import config from "../config"

// Configure AWS SDK
const spacesEndpoint = new AWS.Endpoint(config.DO_SPACE_ENDPOINT as string) // Just the endpoint, no https://
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: config.DO_SPACE_ACCESS_KEY,
  secretAccessKey: config.DO_SPACE_SECRET_KEY,
  s3ForcePathStyle: false, // Use virtual-hosted-style URLs
  signatureVersion: "v4",
  sslEnabled: true, // Force SSL/HTTPS
  region: "us-east-1", // Required for AWS SDK, but endpoint overrides this
})

// Helper function to get MIME type from file extension
const getMimeType = (filename: string): string => {
  const ext = filename.toLowerCase().split(".").pop()
  const mimeTypes: { [key: string]: string } = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    txt: "text/plain",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
  }
  return mimeTypes[ext || ""] || "application/octet-stream"
}

export const uploadImageToSpaces = async (
  file: Express.Multer.File
): Promise<string> => {
  const fileKey = `${uuidv4()}-${file.originalname}` // Generate a unique file name

  if (!config.DO_SPACE_BUCKET) {
    throw new Error("DigitalOcean Spaces bucket name is not configured.")
  }

  const params = {
    Bucket: config.DO_SPACE_BUCKET, // Name of your DigitalOcean Space
    Key: fileKey, // File name in the Space
    Body: file.buffer, // File content
    ACL: "public-read", // Make the file publicly readable
    ContentType: file.mimetype || getMimeType(file.originalname), // Set proper MIME type
    ContentDisposition: "inline", // Force inline display instead of download
    CacheControl: "public, max-age=31536000", // Optional: Set cache control for better performance
    Metadata: {
      "original-name": file.originalname,
      "upload-date": new Date().toISOString(),
    },
  }

  try {
    const data = await s3.upload(params).promise()
    if (!data.Location.startsWith("https://")) {
      if (data.Location.startsWith("http://")) {
        data.Location = data.Location.replace("http://", "https://")
      } else {
        data.Location = `https://${data.Location}`
      }
    }
    return data.Location // The public URL of the uploaded file
  } catch (error) {
    console.error("Error uploading image to DigitalOcean Spaces:", error)
    throw new Error("Failed to upload image.")
  }
}

// Alternative function for files that should be downloaded (like documents)
export const uploadFileForDownload = async (
  file: Express.Multer.File
): Promise<string> => {
  const fileKey = `${uuidv4()}-${file.originalname}`

  if (!config.DO_SPACE_BUCKET) {
    throw new Error("DigitalOcean Spaces bucket name is not configured.")
  }

  const params = {
    Bucket: config.DO_SPACE_BUCKET,
    Key: fileKey,
    Body: file.buffer,
    ACL: "public-read",
    ContentType: file.mimetype || getMimeType(file.originalname),
    ContentDisposition: `attachment; filename="${file.originalname}"`, // Force download
    Metadata: {
      "original-name": file.originalname,
      "upload-date": new Date().toISOString(),
    },
  }

  try {
    const data = await s3.upload(params).promise()
    return data.Location
  } catch (error) {
    console.error("Error uploading file to DigitalOcean Spaces:", error)
    throw new Error("Failed to upload file.")
  }
}

export const removeFileFromSpaces = async (fileUrl: string): Promise<void> => {
  // Extract the key (filename) from the file URL
  const urlParts = fileUrl.split("/")
  const fileKey = decodeURIComponent(urlParts[urlParts.length - 1])

  if (!config.DO_SPACE_BUCKET) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "DigitalOcean Spaces bucket name is not configured."
    )
  }

  const params = {
    Bucket: config.DO_SPACE_BUCKET, // Name of your DigitalOcean Space
    Key: fileKey, // File name in the Space
  }

  try {
    await s3.deleteObject(params).promise()
    console.log(
      `File ${fileKey} deleted successfully from DigitalOcean Spaces.`
    )
  } catch (error) {
    console.error("Error deleting file from DigitalOcean Spaces:", error)
    throw new Error("Failed to delete file.")
  }
}

// Utility function to update existing file metadata (if needed)
export const updateFileMetadata = async (
  fileUrl: string,
  contentDisposition: "inline" | "attachment" = "inline"
): Promise<void> => {
  const urlParts = fileUrl.split("/")
  const fileKey = decodeURIComponent(urlParts[urlParts.length - 1])

  if (!config.DO_SPACE_BUCKET) {
    throw new Error("DigitalOcean Spaces bucket name is not configured.")
  }

  try {
    // First get the existing object
    const getParams = {
      Bucket: config.DO_SPACE_BUCKET,
      Key: fileKey,
    }

    const existingObject = await s3.getObject(getParams).promise()

    // Copy the object with new metadata
    const copyParams = {
      Bucket: config.DO_SPACE_BUCKET,
      Key: fileKey,
      CopySource: `${config.DO_SPACE_BUCKET}/${fileKey}`,
      ACL: "public-read",
      ContentType: existingObject.ContentType,
      ContentDisposition: contentDisposition,
      MetadataDirective: "REPLACE",
      Metadata: existingObject.Metadata || {},
    }

    await s3.copyObject(copyParams).promise()
    console.log(`File ${fileKey} metadata updated successfully.`)
  } catch (error) {
    console.error("Error updating file metadata:", error)
    throw new Error("Failed to update file metadata.")
  }
}
