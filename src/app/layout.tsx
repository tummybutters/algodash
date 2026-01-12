import type { Metadata } from 'next';
import { Space_Grotesk, DM_Serif_Display } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/sidebar';

const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    variable: '--font-sans',
    weight: ['400', '500', '600', '700'],
});

const dmSerif = DM_Serif_Display({
    subsets: ['latin'],
    variable: '--font-display',
    weight: ['400'],
});

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
            <body className={`${spaceGrotesk.variable} ${dmSerif.variable} antialiased`}>
                <Sidebar />
                <div className="main-with-sidebar">
                    {children}
                </div>
            </body>
        </html>
    );
}
