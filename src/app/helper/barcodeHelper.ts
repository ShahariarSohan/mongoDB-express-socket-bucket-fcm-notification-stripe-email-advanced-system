import { randomInt } from "crypto";
import bwipjs from "bwip-js";
import { uploadImageToSpaces } from "../../utils/uploadImage";

const VOUCHER_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const CODE_128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112",
];

const START_CODE_B = 104;
const STOP_CODE = 106;

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const randomCodePart = (): string =>
  Array.from({ length: 4 }, () => VOUCHER_CODE_CHARS[randomInt(VOUCHER_CODE_CHARS.length)]).join("");

export const generateVoucherCode = (): string => `DM-${randomCodePart()}-${randomCodePart()}`;

export const generateCode128SVG = (code: string): string => {
  const values = Array.from(code).map((char) => {
    const value = char.charCodeAt(0) - 32;

    if (value < 0 || value > 95) {
      throw new Error(`Unsupported Code128 character: ${char}`);
    }

    return value;
  });

  const checksum = values.reduce(
    (sum, value, index) => sum + value * (index + 1),
    START_CODE_B
  ) % 103;

  const encodedValues = [START_CODE_B, ...values, checksum, STOP_CODE];
  const moduleWidth = 2;
  const barHeight = 90;
  const quietZone = 20;
  const textHeight = 22;
  const totalModules = encodedValues
    .map((value) => CODE_128_PATTERNS[value])
    .join("")
    .split("")
    .reduce((sum, width) => sum + Number(width), 0);

  const width = totalModules * moduleWidth + quietZone * 2;
  const height = barHeight + textHeight;
  let x = quietZone;
  const rects: string[] = [];

  encodedValues.forEach((value) => {
    const pattern = CODE_128_PATTERNS[value];

    pattern.split("").forEach((widthPart, index) => {
      const currentWidth = Number(widthPart) * moduleWidth;

      if (index % 2 === 0) {
        rects.push(`<rect x="${x}" y="0" width="${currentWidth}" height="${barHeight}" fill="#000"/>`);
      }

      x += currentWidth;
    });
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="Voucher barcode ${escapeXml(code)}" preserveAspectRatio="xMidYMid meet">`,
    `<rect width="${width}" height="${height}" fill="#fff"/>`,
    ...rects,
    `<text x="${width / 2}" y="${barHeight + 16}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#000">${escapeXml(code)}</text>`,
    "</svg>",
  ].join("");
};

export const generateCode128PNG = async (code: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128", // Barcode type
        text: code, // Text to encode
        scale: 3, // 3x scaling factor
        height: 10, // Bar height, in millimeters
        includetext: true, // Show human-readable text
        textxalign: "center", // Always good to set this
      },
      (err, png) => {
        if (err) {
          reject(err);
        } else {
          resolve(`data:image/png;base64,${png.toString("base64")}`);
        }
      }
    );
  });
};

export const generateCode128Buffer = async (code: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128", // Barcode type
        text: code, // Text to encode
        scale: 3, // 3x scaling factor
        height: 10, // Bar height, in millimeters
        includetext: true, // Show human-readable text
        textxalign: "center", // Always good to set this
      },
      (err, png) => {
        if (err) {
          reject(err);
        } else {
          resolve(png);
        }
      }
    );
  });
};

export const generateAndSaveCode128PNG = async (code: string, voucherId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: code,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: "center",
      },
      async (err, png) => {
        if (err) {
          reject(err);
        } else {
          try {
            const fakeFile = {
              originalname: `${voucherId}-barcode.png`,
              buffer: png,
              mimetype: "image/png",
            } as Express.Multer.File;
            
            const url = await uploadImageToSpaces(fakeFile);
            resolve(url);
          } catch (uploadErr) {
            reject(uploadErr);
          }
        }
      }
    );
  });
};
