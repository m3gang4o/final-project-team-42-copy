import type { NextApiRequest, NextApiResponse } from "next";
import createApiClient from "@/utils/supabase/clients/api";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = createApiClient(req, res);

  // Temporarily skip auth for testing
  // const {
  //   data: { user },
  //   error: authError,
  // } = await supabase.auth.getUser();

  // if (authError || !user) {
  //   return res.status(401).json({ error: "Unauthorized" });
  // }

  try {
    const { file, fileName, contentType, groupId } = req.body;

    if (!file || !fileName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Handle both base64 with and without data URL prefix
    const base64Data = file.includes(",") ? file.split(",")[1] : file;
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "File size exceeds 10MB limit" });
    }

    const filePath = groupId ? `${groupId}/${Date.now()}-${fileName}` : `notes/${Date.now()}-${fileName}`;
    const { data, error } = await supabase.storage
      .from("group-files")
      .upload(filePath, buffer, {
        contentType: contentType || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("group-files").getPublicUrl(filePath);

    return res.status(200).json({ url: publicUrl, path: data.path });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: "Upload failed" });
  }
}
