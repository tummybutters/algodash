import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'YouTube Newsletter Dashboard',
    description: 'Capture, triage, and curate podcast content for your newsletter',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="antialiased">{children}</body>
        </html>
    );
}
