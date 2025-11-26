# AI Study Helper Setup Guide

This guide will help you set up and use the AI Study Helper feature in StudyBuddy.

## Overview

The AI Study Helper allows students to:
- Generate **summaries** of their study notes
- Create **quiz questions** for practice and testing
- Generate **flashcards** for active recall

## Features

### 1. Summary Generation
Paste your notes or upload a PDF, and the AI will generate a concise summary highlighting key concepts and important details.

### 2. Quiz Questions
Generate multiple-choice questions based on your study materials. Each question includes:
- 4 answer options
- Correct answer highlighting
- Explanations for better understanding

### 3. Flashcards
Create flashcards with:
- Front: Question or prompt
- Back: Answer or explanation
- Interactive flip animation (click to reveal)

## Setup Instructions

### 1. Install Dependencies

The required packages have already been installed:
```bash
npm install openai @google/generative-ai pdfjs-dist
```

### 2. Choose Your AI Provider

The AI Study Helper supports **two AI providers**. Choose the one that works best for you:

#### **Option A: Google Gemini (Recommended - FREE!)**

**Why Gemini:**
- ✅ **Completely FREE** for personal use
- ✅ 1,500 requests per day (45,000/month!)
- ✅ 15 requests per minute
- ✅ No credit card required
- ✅ Quality comparable to GPT-3.5

**How to Get Your FREE Gemini API Key:**

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key immediately (starts with `AIza`)
5. No credit card needed!

#### **Option B: OpenAI GPT-3.5**

**Why OpenAI:**
- High-quality responses
- Well-established API
- ~$0.002 per request (very affordable)
- New accounts get $5-$18 in free credits

**How to Get Your OpenAI API Key:**

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in to OpenAI
3. Click **"Create new secret key"**
4. Give it a name (e.g., "StudyBuddy App")
5. Copy the key immediately (starts with `sk-`)
6. **Important**: You can only see the key once!

#### How to Use Your API Key:

1. Open the AI Study Helper modal in the app
2. **Select your provider** (Gemini or OpenAI) from the dropdown
3. Paste your API key and click "Save Key"
4. Your key is stored **locally in your browser only** (not on any server)
5. You can change provider or key anytime

**Security Notes:**
- Your API key never leaves your browser (stored in localStorage)
- The key is sent directly to the AI provider's servers (Google or OpenAI)
- Not stored in our database
- You can clear your key anytime by clicking "Change Key"

### 3. Cost Information

**Who Pays?**: Each user pays for their own AI usage (not the app developer!)

#### **Gemini (FREE!):**
- ✅ **$0.00 per request**
- ✅ 1,500 requests per day (FREE forever)
- ✅ 15 requests per minute
- ✅ No billing setup required

**Monitor Gemini Usage:**
- No billing dashboard (it's free!)
- Rate limits automatically enforced by Google

#### **OpenAI (Paid):**
- ~$0.002 per request on average
- New OpenAI accounts get $5-$18 in free credits
- 10 requests per minute rate limiting prevents runaway costs

**Monitor OpenAI Usage:**
1. Visit [OpenAI Usage Dashboard](https://platform.openai.com/usage)
2. Set up billing alerts in your OpenAI account
3. Set spending limits to control costs

**Recommendation**: Use **Gemini** for unlimited free usage! Only switch to OpenAI if you prefer its responses.

## Usage

### From the My Notes Page

1. Navigate to **My Notes** in the sidebar
2. Click the **AI Study Helper** button in the header
3. Choose your input method:
   - **Upload PDF**: Click "Choose PDF" and select a file (max 10MB)
   - **Paste Text**: Copy and paste your notes directly (max 15,000 characters)

### Generate Study Materials

1. **For Summaries**: Click "Generate Summary"
2. **For Quizzes**: Click "Generate Quiz" (creates 5 questions)
3. **For Flashcards**: Click "Generate Flashcards" (creates 10 cards)

### Interactive Features

**Quiz Mode:**
- Click on an answer to select it
- Correct answers show in green ✓
- Incorrect selections show in red ✗
- Read the explanation after answering

**Flashcard Mode:**
- Click any card to flip it
- Front shows the question/prompt
- Back shows the answer/explanation
- Review at your own pace

## Technical Details

### Architecture

```
User Input (Text/PDF)
    ↓
Client-side PDF extraction (if PDF)
    ↓
API Route (/api/ai.ts)
    ↓
Rate Limiting Check
    ↓
OpenAI API (GPT-3.5-turbo)
    ↓
Formatted Response
    ↓
Client Display
```

### Files Created

1. **API Route**: `/pages/api/ai.ts`
   - Handles OpenAI requests
   - Implements rate limiting
   - Validates input

2. **Components**: `/components/ai/AIStudyHelper.tsx`
   - Main UI component
   - Handles file uploads
   - Displays results

3. **Utilities**:
   - `/utils/rate-limiter.ts` - Rate limiting logic
   - `/utils/pdf-extractor.ts` - PDF text extraction

4. **Styles**: `/styles/globals.css`
   - 3D flip card animations

### Rate Limiting

- **Limit**: 10 requests per minute per user
- **Tracking**: By IP address (can be extended to use user ID)
- **Storage**: In-memory (resets on server restart)
- **Production**: Consider Redis for distributed rate limiting

### PDF Processing

- **Client-side extraction**: Uses PDF.js library
- **Max file size**: 10MB
- **Supported format**: PDF only
- **Text extraction**: Handles multi-page documents

### Input Validation

- **Text length**: 15,000 characters max
- **Empty check**: Prevents blank submissions
- **File size**: 10MB maximum
- **File type**: PDF validation

## Troubleshooting

### "Please provide your OpenAI API key first"
- Click the "AI Study Helper" button
- You'll see an API key input field
- Paste your key from https://platform.openai.com/api-keys
- Click "Save Key"

### "Invalid API key format"
- Make sure your key starts with `sk-`
- Copy the entire key (don't trim it)
- Get a fresh key if needed

### "Rate limit exceeded"
- Wait 1 minute before trying again
- Rate limits reset automatically (10 requests/minute)

### "Failed to extract text from PDF"
- Try a different PDF file
- Ensure the PDF contains text (not just images)
- Check file size is under 10MB

### "Text exceeds maximum length"
- Reduce input to under 15,000 characters
- Split large documents into smaller sections

### "Unauthorized" or "Invalid API key"
- Your OpenAI API key may be incorrect
- Click "Change Key" and enter a new one
- Verify your key at https://platform.openai.com/api-keys

## Best Practices

1. **Input Quality**: Better input = better output
   - Use clear, well-formatted notes
   - Include complete sentences
   - Organize by topic

2. **Request Management**:
   - Generate summaries for large content
   - Use quizzes for active recall
   - Create flashcards for key concepts

3. **Cost Optimization**:
   - Review generated content before regenerating
   - Batch similar requests
   - Monitor API usage regularly

## Future Enhancements

Potential improvements for v2:
- Save generated materials to database
- Share quizzes with study groups
- Export flashcards to Anki format
- Support for images in PDFs (OCR)
- Custom quiz difficulty levels
- Spaced repetition for flashcards

## Support

For issues or questions:
1. Check this documentation
2. Review browser console for errors
3. Verify API key configuration
4. Check OpenAI service status

---

**Note**: This feature requires an active OpenAI account with available credits. Student discounts may be available through OpenAI's education program.

