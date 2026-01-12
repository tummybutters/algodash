'use client';

import { useEffect, useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function AuthButton() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        let isMounted = true;

        supabase.auth.getUser().then(({ data }) => {
            if (!isMounted) return;
            setIsSignedIn(Boolean(data.user));
            setIsLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!isMounted) return;
            setIsSignedIn(Boolean(session?.user));
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [supabase]);

    const handleSignIn = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setIsSignedIn(false);
    };

    if (isLoading) {
        return (
            <button className="neo-button-ghost inline-flex items-center gap-2 px-4 py-2 text-sm opacity-70">
                Loading...
            </button>
        );
    }

    if (isSignedIn) {
        return (
            <button
                onClick={handleSignOut}
                className="neo-button-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
                <LogOut size={16} />
                Sign out
            </button>
        );
    }

    return (
        <button
            onClick={handleSignIn}
            className="neo-button inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
            <LogIn size={16} />
            Sign in
        </button>
    );
}
