'use client';

import { signIn } from 'next-auth/react';
import { LogIn } from 'lucide-react';

export default function SignInPage() {
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
                    onClick={() => signIn('google')}
                    className="neo-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm w-full"
                >
                    <LogIn size={16} />
                    Continue with Google
                </button>
            </div>
        </div>
    );
}
