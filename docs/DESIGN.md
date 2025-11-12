# Design Document

> Written by: Team 42 (Megan Gao, Oscar Cheung, Fletcher Stuart, & Mairui Li)for COMP 426: Modern Web Programming at UNC-Chapel Hill.

## Feature Plan

### Feature 1: Group Creation and Join System

**Description:**

Users can create study groups for specific UNC courses and invite classmates to join via a shareable link or through a searchable directory. Each group includes a name, course number, description, and an optional icon.

**User(s):**

Registered students seeking peers in the same class or wanting organized, course-specific study spaces.

**Purpose:**

This feature enables students to quickly form focused study communities. It reduces friction in finding peers, especially in large courses where collaboration outside class is difficult.

**Technical Notes:**

- Frontend: Next.js pages router, group creation form with client-side validation using Shadcn UI components, server-rendered group list with search filters (course code, name).
- Backend: Database tables involved: `groups`, `memberships`, `users`. `groups` table fields: `id`, `name`, `course_code`, `description`, `created_by`, `created_at`. `memberships` table (many-to-many): `user_id`, `group_id`, `role`. Supabase Row Level Security (RLS) ensures only members can access group content.
- Additional Notes: Invite links encoded as `/join/[groupId]`. Automatic membership creation upon joining.

### Feature 2: Shared Notes Board (+ File Uploads)

**Description:**

Each study group has a shared notes board where users can post text notes or upload files (PDFs, images, screenshots). Files appear in a resource list that members can view or download.

**User(s):**

Students within the same group who want to pool class notes, homework guides, and study resources.

**Purpose:**

Creates a centralized and persistent hub for organizing study materials. Prevents fragmented notes spread across Discord chats, Google Drive folders, or random screenshots.

**Technical Notes:**

- Frontend: Shadcn components for text posts and file upload interface. File previews generated where possible (PDF thumbnails, image previews).
- Backend: Tables: `messages` (with attachments) and Supabase Storage buckets. `messages` table fields: `id`, `group_id`, `user_id`, `text`, `file_url`, `created_at`. Supabase Storage used for PDFs/images; URL stored in `messages.file_url`. Realtime subscription on the `messages` table to update the feed without refresh.
- Additional Notes: Limit on file size (e.g., 10MB per upload). Upload progress shown via client-side events. Note: The `notes` table is merged with `messages` since they share similar structure.

### Feature 3: Realtime Presence & Group Chat

**Description:**

Shows which group members are currently online and allows realtime chat within the group page. Presence information appears as online indicators next to member avatars.

**User(s):**

Active group members collaborating during study sessions, planning ahead for tests, or checking in with their peers.

**Purpose:**

Promotes live collaboration and helps groups coordinate study hours, share resources instantly, and discuss problems together in real time.

**Technical Notes:**

- Frontend: Realtime chat rendered using Supabase's Realtime channel subscription. Online status displayed with Shadcn avatars + presence indicator. Chat input built with React Hook Form + Shadcn UI.
- Backend: Tables: `messages` (`id`, `group_id`, `user_id`, `text`, `created_at`). Presence powered by Supabase Realtime presence API: Tracks join/leave events of connected clients per group. Writes online states into in-memory channel, not DB. RLS ensures only group members see messages.
- Additional Notes: Typing indicator optionally included later. Autoscroll on new messages.

### Feature 4: AI Study Helper (OpenAI API)

**Description:**

Users can submit written notes or upload text-based files (PDF → extracted text) to request: Summaries, auto-generated quiz questions, and flashcards (optional v2).

**User(s):**

Any student wanting AI-powered review material or quick study guidance.

**Purpose:**

Adds value by giving students an automated way to better understand dense notes, prepare for tests, and engage in active recall without manually creating study tools.

**Technical Notes:**

- Frontend: Modal or side panel for submitting text or selecting files from the notes board. Output displayed as formatted cards or bullet lists.
- Backend: Simple route handler (API route in `/pages/api/ai.ts`) that: Receives raw text from client, sends it to the OpenAI API, returns a formatted summary or quiz questions. No long-term storage required; results ephemeral. Rate limiting (e.g., limit user to X questions per minute) using middleware.
- Additional Notes: PDF text extraction done client-side where possible before sending to API. Safety checks ensure users cannot send blank or excessively large input.

### Feature 5: User Profiles & Dashboard

**Description:**

Each user has a personal dashboard showing: Joined groups, recent activity (notes posted, messages, uploads), quick actions (join/create group), and saved AI-generated materials.

**User(s):**

All registered users accessing the app.

**Purpose:**

Provides a personalized hub so students can quickly jump back into their groups, find recent notes, and track their study activities in one place.

**Technical Notes:**

- Frontend: Next.js server-rendered dashboard at `/dashboard`. Shadcn UI cards displaying user metrics and quick navigation. Dark/light mode support.
- Backend: Tables used: `users`, `memberships`, `groups`, `messages`. Aggregation logic: Fetch groups via `memberships`. Fetch recent notes/messages by filtering within user's groups. Profile fields: `id`, `name`, `email`, `avatar_url`, `created_at`. Avatar stored in Supabase Storage or synced from OAuth provider (if used).
- Additional Notes: Optional: Activity timeline using combined queries from `messages`. Dashboard rendered server-side for speed and SEO.

## Backend Database Schema

<img width="1206" height="767" alt="image" src="https://github.com/user-attachments/assets/cc324525-2ea1-43fd-98b7-fa1eeb18e601" />

## High-Fidelity Prototype

<iframe style="border: 1px solid rgba(0, 0, 0, 0.1);" width="800" height="450" src="https://embed.figma.com/design/NmEYEIOuuh0vovPcLrevVI/StudyBuddy-Hi-Fi-Prototype?node-id=0-1&embed-host=share" allowfullscreen></iframe>
