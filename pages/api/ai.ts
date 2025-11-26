/**
 * AI Study Helper API Route
 * Handles requests for summaries, quiz questions, and flashcards using OpenAI or Gemini
 */

import { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit } from "../../utils/rate-limiter";

// Types for request/response
type AIRequestType = "summary" | "quiz" | "flashcards";
type AIProvider = "openai" | "gemini";

interface AIRequest {
  text: string;
  type: AIRequestType;
  provider: AIProvider; // AI provider (OpenAI or Gemini)
  apiKey: string; // User-provided API key
  options?: {
    numQuestions?: number;
    numFlashcards?: number;
  };
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface Flashcard {
  front: string;
  back: string;
}

interface AIResponse {
  success: boolean;
  data?: {
    summary?: string;
    quiz?: QuizQuestion[];
    flashcards?: Flashcard[];
  };
  error?: string;
}

/**
 * Get user identifier for rate limiting (IP address or user ID)
 */
function getUserIdentifier(req: NextApiRequest): string {
  // Try to get IP address
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]
      : req.socket.remoteAddress || "unknown";

  // In production, you might also use user ID from session
  // const userId = req.session?.user?.id;
  // return userId || ip;

  return ip;
}

/**
 * Generate a summary of the provided text
 */
async function generateSummary(openai: OpenAI, text: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful study assistant. Create clear, concise summaries of study materials that capture the key concepts and important details.",
      },
      {
        role: "user",
        content: `Please summarize the following text in a clear and organized way:\n\n${text}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content || "Unable to generate summary";
}

/**
 * Generate quiz questions from the provided text
 */
async function generateQuiz(
  openai: OpenAI,
  text: string,
  numQuestions: number = 5
): Promise<QuizQuestion[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful study assistant. Create multiple-choice quiz questions based on study materials. Return ONLY valid JSON with no additional text.",
      },
      {
        role: "user",
        content: `Create ${numQuestions} multiple-choice questions from this text. Return as JSON array with format: [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "..."}]\n\nText:\n${text}`,
      },
    ],
    temperature: 0.8,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content || "[]";

  try {
    // Try to parse the JSON response
    const questions = JSON.parse(content);
    return Array.isArray(questions) ? questions : [];
  } catch (error) {
    console.error("Failed to parse quiz questions:", error);
    // Fallback: return empty array if parsing fails
    return [];
  }
}

/**
 * Generate flashcards from the provided text
 */
async function generateFlashcards(
  openai: OpenAI,
  text: string,
  numFlashcards: number = 10
): Promise<Flashcard[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful study assistant. Create flashcards from study materials with concise questions/prompts on the front and clear answers on the back. Return ONLY valid JSON with no additional text.",
      },
      {
        role: "user",
        content: `Create ${numFlashcards} flashcards from this text. Return as JSON array with format: [{"front": "question or prompt", "back": "answer or explanation"}]\n\nText:\n${text}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content || "[]";

  try {
    const flashcards = JSON.parse(content);
    return Array.isArray(flashcards) ? flashcards : [];
  } catch (error) {
    console.error("Failed to parse flashcards:", error);
    return [];
  }
}

/**
 * Generate a summary using Gemini
 */
async function generateSummaryGemini(genAI: GoogleGenerativeAI, text: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  const prompt = `You are a helpful study assistant. Create a clear, concise summary of the following study materials that captures the key concepts and important details:\n\n${text}`;
  
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text() || "Unable to generate summary";
}

/**
 * Generate quiz questions using Gemini
 */
async function generateQuizGemini(
  genAI: GoogleGenerativeAI,
  text: string,
  numQuestions: number = 5
): Promise<QuizQuestion[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  const prompt = `You are a helpful study assistant. Create ${numQuestions} multiple-choice questions from the following text. Return ONLY valid JSON with no additional text or formatting. Use this exact format: [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "..."}]\n\nText:\n${text}`;
  
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();
  
  try {
    // Clean up the response (remove markdown code blocks if present)
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const questions = JSON.parse(cleanContent);
    return Array.isArray(questions) ? questions : [];
  } catch (error) {
    console.error("Failed to parse quiz questions from Gemini:", error);
    return [];
  }
}

/**
 * Generate flashcards using Gemini
 */
async function generateFlashcardsGemini(
  genAI: GoogleGenerativeAI,
  text: string,
  numFlashcards: number = 10
): Promise<Flashcard[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  const prompt = `You are a helpful study assistant. Create ${numFlashcards} flashcards from the following text with concise questions/prompts on the front and clear answers on the back. Return ONLY valid JSON with no additional text or formatting. Use this exact format: [{"front": "question or prompt", "back": "answer or explanation"}]\n\nText:\n${text}`;
  
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();
  
  try {
    // Clean up the response (remove markdown code blocks if present)
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const flashcards = JSON.parse(cleanContent);
    return Array.isArray(flashcards) ? flashcards : [];
  } catch (error) {
    console.error("Failed to parse flashcards from Gemini:", error);
    return [];
  }
}

/**
 * Main API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AIResponse>
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    // Check rate limit
    const identifier = getUserIdentifier(req);
    const rateLimit = checkRateLimit(identifier, 10, 60000); // 10 requests per minute

    if (!rateLimit.success) {
      return res.status(429).json({
        success: false,
        error: `Rate limit exceeded. Please try again in ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds.`,
      });
    }

    // Parse and validate request body
    const { text, type, provider, apiKey, options } = req.body as AIRequest;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    if (text.length > 15000) {
      return res.status(400).json({
        success: false,
        error: "Text exceeds maximum length of 15,000 characters",
      });
    }

    if (!["summary", "quiz", "flashcards"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "Invalid request type. Must be 'summary', 'quiz', or 'flashcards'",
      });
    }

    if (!["openai", "gemini"].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: "Invalid provider. Must be 'openai' or 'gemini'",
      });
    }

    // Check if user provided an API key
    if (!apiKey || apiKey.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "API key is required. Please provide your own key.",
      });
    }

    // Validate API key format based on provider
    if (provider === "openai" && !apiKey.startsWith("sk-")) {
      return res.status(400).json({
        success: false,
        error: "Invalid OpenAI API key format. Key should start with 'sk-'",
      });
    }

    if (provider === "gemini" && !apiKey.startsWith("AIza")) {
      return res.status(400).json({
        success: false,
        error: "Invalid Gemini API key format. Key should start with 'AIza'",
      });
    }

    // Process request based on provider and type
    let result: AIResponse["data"] = {};

    if (provider === "openai") {
      // Create OpenAI client with user's API key
      const openai = new OpenAI({
        apiKey: apiKey,
      });

      switch (type) {
        case "summary":
          const summary = await generateSummary(openai, text);
          result = { summary };
          break;

        case "quiz":
          const numQuestions = options?.numQuestions || 5;
          const quiz = await generateQuiz(openai, text, numQuestions);
          result = { quiz };
          break;

        case "flashcards":
          const numFlashcards = options?.numFlashcards || 10;
          const flashcards = await generateFlashcards(openai, text, numFlashcards);
          result = { flashcards };
          break;
      }
    } else if (provider === "gemini") {
      // Create Gemini client with user's API key
      const genAI = new GoogleGenerativeAI(apiKey);

      switch (type) {
        case "summary":
          const summary = await generateSummaryGemini(genAI, text);
          result = { summary };
          break;

        case "quiz":
          const numQuestions = options?.numQuestions || 5;
          const quiz = await generateQuizGemini(genAI, text, numQuestions);
          result = { quiz };
          break;

        case "flashcards":
          const numFlashcards = options?.numFlashcards || 10;
          const flashcards = await generateFlashcardsGemini(genAI, text, numFlashcards);
          result = { flashcards };
          break;
      }
    }

    // Return success response
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("AI API error:", error);

    // Handle OpenAI specific errors
    if (error?.status === 401) {
      return res.status(500).json({
        success: false,
        error: "Invalid OpenAI API key",
      });
    }

    if (error?.status === 429) {
      return res.status(429).json({
        success: false,
        error: "OpenAI API rate limit exceeded. Please try again later.",
      });
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      error: error?.message || "An error occurred while processing your request",
    });
  }
}

