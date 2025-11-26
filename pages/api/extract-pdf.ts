/**
 * PDF Text Extraction API Route
 * Handles PDF file uploads and extracts text server-side
 */

import { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";

// Dynamic import for pdf-parse to handle CommonJS module
async function extractPdfText(buffer: Buffer): Promise<any> {
  const pdfParseModule = await import("pdf-parse");
  // Handle both default and named exports
  const pdfParse = pdfParseModule.default || pdfParseModule;
  return await pdfParse(buffer);
}

// Disable body parsing so formidable can handle the file upload
export const config = {
  api: {
    bodyParser: false,
  },
};

interface ExtractPDFResponse {
  success: boolean;
  text?: string;
  error?: string;
}

/**
 * Parse the incoming multipart form data
 */
function parseForm(req: NextApiRequest): Promise<{ file: formidable.File }> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true,
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      
      if (!file) {
        reject(new Error("No file uploaded"));
        return;
      }

      resolve({ file });
    });
  });
}

/**
 * Main API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExtractPDFResponse>
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    // Parse the uploaded file
    const { file } = await parseForm(req);

    // Validate file type
    if (file.mimetype !== "application/pdf") {
      return res.status(400).json({
        success: false,
        error: "Invalid file type. Please upload a PDF file.",
      });
    }

    // Read the file buffer
    const dataBuffer = fs.readFileSync(file.filepath);

    // Extract text from PDF
    const data = await extractPdfText(dataBuffer);
    
    // Clean up: delete the temporary file
    fs.unlinkSync(file.filepath);

    // Validate extracted text
    if (!data.text || data.text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "No text found in PDF. The file might be image-based or empty.",
      });
    }

    // Check text length
    if (data.text.length > 15000) {
      return res.status(400).json({
        success: false,
        error: "Extracted text exceeds 15,000 character limit. Please use a shorter document.",
      });
    }

    // Return extracted text
    return res.status(200).json({
      success: true,
      text: data.text.trim(),
    });
  } catch (error: any) {
    console.error("PDF extraction error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to extract text from PDF",
    });
  }
}

