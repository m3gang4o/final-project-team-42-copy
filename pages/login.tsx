import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
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

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      router.push("/dashboard");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Login - StudyBuddy</title>
        <meta
          name="description"
          content="Sign in to StudyBuddy to access your study groups, notes, and AI-powered study tools."
        />
      </Head>
      <div className="flex min-h-screen">
        <div className="hidden flex-col justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-12 lg:flex lg:w-1/2 dark:from-blue-950 dark:to-blue-900">
          <div className="max-w-md space-y-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <Book className="text-foreground h-10 w-10" />
              <span className="text-foreground text-3xl font-bold">
                StudyBuddy
              </span>
            </div>

            <h2 className="text-foreground text-2xl font-semibold">
              Study Smarter, Together
            </h2>

            <p className="text-foreground/80 text-base leading-relaxed">
              Join UNC students in creating collaborative group chats, sharing
              resources, and using AI-powered tools to ace your classes.
            </p>

            {/* Features */}
            <div className="space-y-6 pt-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <Users className="text-foreground h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-foreground mb-1 font-semibold">
                    Course-Specific Groups
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Connect with classmates in your courses
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <GraduationCap className="text-foreground h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-foreground mb-1 font-semibold">
                    AI Study Assistant
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Summarize notes and generate quiz questions
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <MessageSquare className="text-foreground h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-foreground mb-1 font-semibold">
                    Real-Time Chat
                  </h3>
                  <p className="text-muted-foreground text-sm">
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
              <Tabs value="login" className="w-full">
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

                {/* Login Form */}
                <TabsContent value="login" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="Please Enter Email"
                        className="pl-10"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Must be a valid email address!
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Please Enter Password"
                        className="pl-10"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button
                    onClick={handleLogin}
                    disabled={loading}
                    className="mt-2 h-10 w-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </TabsContent>

                {/* Sign Up Form */}
                <TabsContent value="signup" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Username</Label>
                    <div className="relative">
                      <User className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input
                        id="signup-username"
                        type="text"
                        placeholder="John Doe"
                        className="pl-10"
                        value={signupUsername}
                        onChange={(e) => setSignupUsername(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Please Enter Email"
                        className="pl-10"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Must be a valid email address!
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Please Enter Password"
                        className="pl-10"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                      <Input
                        id="signup-confirm-password"
                        type="password"
                        placeholder="Please Confirm Password"
                        className="pl-10"
                        value={signupConfirmPassword}
                        onChange={(e) =>
                          setSignupConfirmPassword(e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <Button className="mt-2 h-10 w-full bg-blue-600 text-white hover:bg-blue-700">
                    Create Account
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
