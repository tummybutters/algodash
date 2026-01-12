'use client';

import { FormEvent, useState } from 'react';
import { LogIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignInPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const supabase = createClient();

    const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage(null);
        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });
        if (error) {
            setErrorMessage(error.message);
            setIsLoading(false);
            return;
        }
        window.location.href = '/';
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="neo-panel p-10 max-w-lg w-full text-center space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Executive Algo</p>
                <h1 className="font-display text-3xl text-card-foreground">
                    Sign in to the dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                    Use your email and password to access the newsletter workflow.
                </p>
                <form onSubmit={handleSignIn} className="space-y-3 text-left">
                    <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Email
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        required
                        className="neo-input w-full px-3 py-2 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="you@domain.com"
                    />
                    <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Password
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                        className="neo-input w-full px-3 py-2 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="********"
                    />
                    {errorMessage && (
                        <p className="text-sm text-red-500">{errorMessage}</p>
                    )}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="neo-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm w-full disabled:opacity-70"
                    >
                        <LogIn size={16} />
                        Sign in
                    </button>
                </form>
            </div>
        </div>
    );
}
