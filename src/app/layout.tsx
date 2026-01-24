import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/sidebar';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-sans',
    weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
    title: 'The Conviction Index',
    description: 'Capture, triage, and curate podcast content for your newsletter',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={`${inter.variable} font-sans antialiased`}>
                <Sidebar />
                <div className="main-with-sidebar">
                    <main className="page-shell">
                        {children}
                    </main>
                </div>
            </body>
        </html>
    );
}
