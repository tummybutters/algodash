'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, Star, LayoutList, Upload, Settings, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
    { href: '/', label: 'Inbox', icon: Inbox },
    { href: '/library', label: 'Favorites', icon: Star },
    { href: '/builder', label: 'Newsletter Builder', icon: LayoutList },
    { href: '/import', label: 'Bulk Import', icon: Upload },
    { href: '/channels', label: 'Sources', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        window.location.href = '/auth/signin';
    };

    return (
        <>
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">EA</div>
                    <span className="sidebar-title">The Conviction Index</span>
                </div>

                <nav className="sidebar-nav">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                            >
                                <item.icon size={18} strokeWidth={1.5} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={handleSignOut} className="sidebar-link">
                        <LogOut size={18} strokeWidth={1.5} />
                        <span>Sign out</span>
                    </button>
                </div>
            </aside>

            <nav className="mobile-nav" aria-label="Primary">
                <div className="mobile-nav-list">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`mobile-nav-link ${isActive ? 'mobile-nav-link-active' : ''}`}
                            >
                                <item.icon size={20} strokeWidth={1.5} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}
