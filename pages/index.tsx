import { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";

export default function HomePage() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    };

    checkAuth();
  }, [router, supabase]);

  return (
    <>
      <Head>
        <title>StudyBuddy - Study Smarter, Together</title>
        <meta
          name="description"
          content="Join UNC students in creating collaborative group chats, sharing resources, and using AI-powered tools to ace your classes."
        />
      </Head>
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div
            className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900"
            role="status"
            aria-label="Loading"
          ></div>
          <p className="text-muted-foreground mt-4" aria-live="polite">
            Loading...
          </p>
        </div>
      </div>
    </>
  );
}
