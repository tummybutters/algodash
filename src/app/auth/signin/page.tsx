'use client';

import { FormEvent, useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
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
        <div className="flex min-h-[calc(100vh-(var(--page-padding-y)*2))] items-center justify-center bg-background">
            <div className="gpt-panel p-10 max-w-md w-full space-y-6">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-primary rounded-xl mx-auto flex items-center justify-center text-white font-semibold text-lg">
                        EA
                    </div>
                    <h1 className="text-2xl font-semibold text-card-foreground">
                        Welcome back
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Sign in to access your newsletter dashboard.
                    </p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                        <label className="gpt-label-muted">
                            Email address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            autoComplete="email"
                            required
                            className="gpt-input w-full"
                            placeholder="you@domain.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="gpt-label-muted">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            autoComplete="current-password"
                            required
                            className="gpt-input w-full"
                            placeholder="••••••••"
                        />
                    </div>

                    {errorMessage && (
                        <p className="text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-lg">
                            {errorMessage}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="gpt-button w-full py-3 text-sm font-medium disabled:opacity-70"
                    >
                        {isLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <LogIn size={18} strokeWidth={1.5} />
                        )}
                        {isLoading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>
            </div>
        </div>
    );
}
