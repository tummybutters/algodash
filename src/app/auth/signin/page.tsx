'use client';

import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignInPage() {
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();

    const handleSignIn = async () => {
        setIsLoading(true);
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="neo-panel p-10 max-w-lg w-full text-center space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Executive Algo</p>
                <h1 className="font-display text-3xl text-card-foreground">
                    Sign in to the dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                    Use your Google account to access the newsletter workflow.
                </p>
                <button
                    onClick={handleSignIn}
                    disabled={isLoading}
                    className="neo-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm w-full disabled:opacity-70"
                >
                    <LogIn size={16} />
                    Continue with Google
                </button>
            </div>
        </div>
    );
}
