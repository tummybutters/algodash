'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { LogIn, LogOut } from 'lucide-react';

export function AuthButton() {
    const { data, status } = useSession();

    if (status === 'loading') {
        return (
            <button className="neo-button-ghost inline-flex items-center gap-2 px-4 py-2 text-sm opacity-70">
                Loading...
            </button>
        );
    }

    if (data?.user) {
        return (
            <button
                onClick={() => signOut()}
                className="neo-button-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
                <LogOut size={16} />
                Sign out
            </button>
        );
    }

    return (
        <button
            onClick={() => signIn('google')}
            className="neo-button inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
            <LogIn size={16} />
            Sign in
        </button>
    );
}
