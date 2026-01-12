'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { addChannel, toggleChannelApproval, deleteChannel } from '@/lib/actions/channels';
import type { Channel } from '@/types/database';

interface ChannelManagerProps {
    channels: Channel[];
}

export function ChannelManager({ channels }: ChannelManagerProps) {
    const [isPending, startTransition] = useTransition();
    const [newChannelId, setNewChannelId] = useState('');
    const [newChannelName, setNewChannelName] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    const handleAdd = () => {
        if (!newChannelId.trim() || !newChannelName.trim()) return;

        startTransition(async () => {
            await addChannel(newChannelId.trim(), newChannelName.trim());
            setNewChannelId('');
            setNewChannelName('');
            setShowAddForm(false);
        });
    };

    const handleToggle = (id: string, currentApproval: boolean) => {
        startTransition(() => {
            toggleChannelApproval(id, !currentApproval);
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm('Delete this channel? All associated videos will also be deleted.')) return;

        startTransition(() => {
            deleteChannel(id);
        });
    };

    return (
        <div className="space-y-6">
            {/* Add button */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="neo-button inline-flex items-center gap-2 px-4 py-2"
                >
                    <Plus size={18} />
                    Add Channel
                </button>
            </div>

            {/* Add form */}
            {showAddForm && (
                <div className="neo-panel p-4 space-y-4">
                    <h3 className="font-display text-lg text-card-foreground">Add New Channel</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1 ml-2">
                                YouTube Channel ID
                            </label>
                            <div className="neo-input-wrapper w-full">
                                <input
                                    type="text"
                                    placeholder="UCxxxxxxxxxxxxxx"
                                    value={newChannelId}
                                    onChange={(e) => setNewChannelId(e.target.value)}
                                    className="neo-input-field"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 ml-2">
                                Find this in the channel URL or page source
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1 ml-2">
                                Display Name
                            </label>
                            <div className="neo-input-wrapper w-full">
                                <input
                                    type="text"
                                    placeholder="Channel Name"
                                    value={newChannelName}
                                    onChange={(e) => setNewChannelName(e.target.value)}
                                    className="neo-input-field"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleAdd}
                            disabled={isPending || !newChannelId.trim() || !newChannelName.trim()}
                            className="neo-button inline-flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPending && <Loader2 size={16} className="animate-spin" />}
                            Add
                        </button>
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="neo-button-ghost px-4 py-2"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Channel list */}
            <div className="neo-panel overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                                Channel
                            </th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                                YouTube ID
                            </th>
                            <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                                Status
                            </th>
                            <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                                Last Synced
                            </th>
                            <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {channels.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                    No channels added yet
                                </td>
                            </tr>
                        ) : (
                            channels.map((channel) => (
                                <tr key={channel.id} className="border-b border-border last:border-b-0">
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-card-foreground">
                                            {channel.name}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <code className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                                            {channel.youtube_channel_id}
                                        </code>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${channel.approved
                                                ? 'bg-green-500/20 text-green-500'
                                                : 'bg-red-500/20 text-red-500'
                                                }`}
                                        >
                                            {channel.approved ? 'Active' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                                        {channel.last_synced_at
                                            ? new Date(channel.last_synced_at).toLocaleDateString()
                                            : 'Never'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="inline-flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggle(channel.id, channel.approved)}
                                                disabled={isPending}
                                                className="p-2 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-card-foreground"
                                                title={channel.approved ? 'Disable' : 'Enable'}
                                            >
                                                {channel.approved ? (
                                                    <ToggleRight size={20} className="text-green-500" />
                                                ) : (
                                                    <ToggleLeft size={20} />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(channel.id)}
                                                disabled={isPending}
                                                className="p-2 rounded hover:bg-red-500/20 transition-colors text-muted-foreground hover:text-red-500"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
