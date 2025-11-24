import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import { Book, FileText, Star, Share2, Clock, Search, Plus, Grid, List, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Note {
  id: number;
  title: string;
  content: string;
  course: string;
  courseColor: string;
  tags: string[];
  isStarred: boolean;
  isShared: boolean;
  sharedCount?: number;
  createdAt: string;
  updatedAt: string;
}

const mockNotes: Note[] = [
  {
    id: 1,
    title: "Chemical Bonding &",
    content: "Ionic bonds form between metals and non-metals through electron transfer. Covalent bonds involve...",
    course: "CHEM 101",
    courseColor: "bg-purple-500",
    tags: ["Midterm", "Chapter 5"],
    isStarred: false,
    isShared: true,
    sharedCount: 1,
    createdAt: "2 hours ago",
    updatedAt: "Nov 5, 2024",
  },
  {
    id: 2,
    title: "Python Functions &",
    content: "Functions are reusable blocks of code. def keyword defines a function. Parameters vs arguments. Return...",
    course: "COMP 110",
    courseColor: "bg-blue-500",
    tags: ["Assignment 3", "Functions"],
    isStarred: false,
    isShared: false,
    createdAt: "1 day ago",
    updatedAt: "Nov 4, 2024",
  },
  {
    id: 3,
    title: "Integration Techniques",
    content: "u-substitution: choose u to simplify the integral. Integration by parts: ∫udv = uv - ∫vdu. Trigonometric integrals...",
    course: "MATH 231",
    courseColor: "bg-green-500",
    tags: ["Exam Prep", "Chapter 7"],
    isStarred: false,
    isShared: true,
    createdAt: "3 days ago",
    updatedAt: "Nov 3, 2024",
  },
  {
    id: 4,
    title: "Thermodynamics - First",
    content: "Energy cannot be created or destroyed, only transformed. ΔU = Q - W. Internal energy, heat, and work...",
    course: "CHEM 101",
    courseColor: "bg-purple-500",
    tags: ["Chapter 6", "Important"],
    isStarred: false,
    isShared: false,
    createdAt: "4 days ago",
    updatedAt: "Nov 2, 2024",
  },
];

const courses = [
  { name: "CHEM 101", color: "bg-purple-500", count: 2 },
  { name: "COMP 110", color: "bg-blue-500", count: 2 },
  { name: "MATH 231", color: "bg-green-500", count: 2 },
];

const popularTags = ["Midterm", "Final", "Quiz", "Chapter 5", "Chapter 7", "Important"];

export default function MyNotesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState<Note[]>(mockNotes);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [newNote, setNewNote] = useState({
    title: "",
    content: "",
    course: "",
    tags: "",
  });

  const filteredNotes = useMemo(() => {
    let filtered = notes;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query) ||
          note.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedCourse !== "all") {
      filtered = filtered.filter((note) => note.course === selectedCourse);
    }

    return filtered;
  }, [searchQuery, notes, selectedCourse]);

  const starredNotes = notes.filter((note) => note.isStarred);
  const sharedNotes = notes.filter((note) => note.isShared);

  const handleCreateNote = () => {
    if (!newNote.title || !newNote.course) return;

    const courseData = courses.find((c) => c.name === newNote.course);
    const newNoteData: Note = {
      id: notes.length + 1,
      title: newNote.title,
      content: newNote.content,
      course: newNote.course,
      courseColor: courseData?.color || "bg-gray-500",
      tags: newNote.tags.split(",").map((t) => t.trim()).filter(Boolean),
      isStarred: false,
      isShared: false,
      createdAt: "Just now",
      updatedAt: new Date().toLocaleDateString(),
    };

    setNotes([newNoteData, ...notes]);
    setIsNewNoteOpen(false);
    setNewNote({ title: "", content: "", course: "", tags: "" });
  };

  const toggleStar = (noteId: number) => {
    setNotes(notes.map((note) => 
      note.id === noteId ? { ...note, isStarred: !note.isStarred } : note
    ));
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 h-screen fixed left-0 top-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Book className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">StudyBuddy</span>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Menu</p>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Book className="h-5 w-5" />
                  <span>Dashboard</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => router.push("/study-groups")}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Book className="h-5 w-5" />
                  <span>Study Groups</span>
                </button>
              </li>
              <li>
                <button
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-medium"
                >
                  <FileText className="h-5 w-5" />
                  <span>My Notes</span>
                </button>
              </li>
            </ul>
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Account</p>
            <ul className="space-y-1">
              <li>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Book className="h-5 w-5" />
                  <span>Settings</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-800 dark:bg-gray-600 rounded-full flex items-center justify-center text-white font-semibold">
              O
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">Oscar Cheung</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">ocheung@unc.edu</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Notes</h1>
            <Button onClick={() => setIsNewNoteOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              New Note
            </Button>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Organize and share your study notes</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Notes</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{notes.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Across 3 courses</p>
                </div>
                <FileText className="h-6 w-6 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Starred</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{starredNotes.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Important notes</p>
                </div>
                <Star className="h-6 w-6 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Shared</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{sharedNotes.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">With study groups</p>
                </div>
                <Share2 className="h-6 w-6 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Recent Activity</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">5</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Edited this week</p>
                </div>
                <Clock className="h-6 w-6 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access & Filters */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Quick Access */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Quick Access</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">All Notes</span>
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{notes.length}</span>
                </button>
                <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Recent</span>
                  </div>
                </button>
                <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Starred</span>
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{starredNotes.length}</span>
                </button>
                <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Shared</span>
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{sharedNotes.length}</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Courses */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Courses</h3>
              <div className="space-y-2">
                <button 
                  onClick={() => setSelectedCourse("all")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    selectedCourse === "all" ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">All Courses</span>
                </button>
                {courses.map((course) => (
                  <button
                    key={course.name}
                    onClick={() => setSelectedCourse(course.name)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                      selectedCourse === course.name ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 ${course.color} rounded-full`}></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{course.name}</span>
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{course.count}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Popular Tags */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Popular Tags</h3>
              <div className="flex flex-wrap gap-2">
                {popularTags.map((tag) => (
                  <button
                    key={tag}
                    className="px-3 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and View Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search notes by title, content, or tags..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Notes Grid */}
        {filteredNotes.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No notes found. Create your first note!</p>
          </div>
        ) : (
          <div className={viewMode === "grid" ? "grid grid-cols-2 gap-6" : "space-y-4"}>
            {filteredNotes.map((note) => (
              <Card key={note.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`px-2 py-1 ${note.courseColor} text-white text-xs font-medium rounded`}>
                      {note.course}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStar(note.id);
                      }}
                      className="text-gray-400 hover:text-yellow-500 transition-colors"
                    >
                      <Star className={`h-4 w-4 ${note.isStarred ? "fill-yellow-500 text-yellow-500" : ""}`} />
                    </button>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{note.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{note.content}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-4">
                      {note.isShared && (
                        <div className="flex items-center gap-1">
                          <Share2 className="h-3 w-3" />
                          <span>Shared</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{note.createdAt}</span>
                      </div>
                    </div>
                    <span>{note.updatedAt}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* New Note Dialog */}
      <Dialog open={isNewNoteOpen} onOpenChange={setIsNewNoteOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Note</DialogTitle>
            <DialogDescription>Add a new study note to your collection</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter note title..."
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="course">Course</Label>
              <Select value={newNote.course} onValueChange={(value) => setNewNote({ ...newNote, course: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.name} value={course.name}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                placeholder="Write your notes here..."
                className="min-h-[150px]"
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="e.g., Midterm, Chapter 5, Important"
                value={newNote.tags}
                onChange={(e) => setNewNote({ ...newNote, tags: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewNoteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateNote}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!newNote.title || !newNote.course}
            >
              Create Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
