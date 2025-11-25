import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createSupabaseComponentClient } from '@/utils/supabase/clients/component';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();

  useEffect(() => {
    const handleCallback = async () => {
      // The session is automatically handled by Supabase
      // Just redirect to dashboard
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    };

    handleCallback();
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Verifying your email...</h2>
        <p className="text-gray-600">Please wait while we redirect you.</p>
      </div>
    </div>
  );
}
