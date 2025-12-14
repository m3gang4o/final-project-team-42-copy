import { api } from "@/utils/trpc/api";
import { useState } from "react";
import { useRouter } from "next/router";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import {
  Book,
  Users,
  GraduationCap,
  MessageSquare,
  User,
  Mail,
  Lock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const createUserMutation = api.users.createUser.useMutation();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: username,
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        await createUserMutation.mutateAsync({
          id: parseInt(data.user.id.substring(0, 8), 16),
          name: username,
          email: email,
        });
      }

      router.push("/dashboard");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-col justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-12 lg:flex lg:w-1/2 dark:from-blue-950 dark:to-blue-900">
        <div className="max-w-md space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Book className="h-10 w-10 text-[#13294B]" />
            <span className="text-3xl font-bold text-[#13294B]">
              StudyBuddy
            </span>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900">
            Study Smarter, Together
          </h2>

          <p className="text-base leading-relaxed text-gray-700">
            Join UNC students in creating collaborative group chats, sharing
            resources, and using AI-powered tools to ace your classes.
          </p>

          {/* Features */}
          <div className="space-y-6 pt-2">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                <Users className="h-6 w-6 text-[#13294B]" />
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-gray-900">
                  Course-Specific Groups
                </h3>
                <p className="text-sm text-gray-600">
                  Connect with classmates in your courses
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                <GraduationCap className="h-6 w-6 text-[#13294B]" />
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-gray-900">
                  AI Study Assistant
                </h3>
                <p className="text-sm text-gray-600">
                  Summarize notes and generate quiz questions
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                <MessageSquare className="h-6 w-6 text-[#13294B]" />
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-gray-900">
                  Real-Time Chat
                </h3>
                <p className="text-sm text-gray-600">
                  Discuss and collaborate with your group chats
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-background flex flex-1 items-center justify-center p-8">
        <Card className="dark:bg-card w-full max-w-md border-0 bg-white shadow-lg">
          <CardHeader className="space-y-1 px-6 pt-6">
            <CardTitle className="text-2xl font-bold">
              Welcome to StudyBuddy
            </CardTitle>
            <CardDescription className="text-sm">
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Tabs value="signup" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="login"
                  onClick={() => router.push("/login")}
                >
                  Login
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  onClick={() => router.push("/signup")}
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signup" className="mt-4">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <User className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input
                        id="username"
                        type="text"
                        placeholder="John Doe"
                        className="pl-10"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Please Enter Email"
                        className="pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Must be a valid email address!
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Please Enter Password"
                        className="pl-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Please Confirm Password"
                        className="pl-10"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button
                    type="submit"
                    disabled={loading}
                    className="mt-2 h-10 w-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {loading ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
