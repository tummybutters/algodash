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
                    className="gpt-button"
                >
                    <Plus size={18} strokeWidth={1.5} />
                    Add Channel
                </button>
            </div>

            {/* Add form */}
            {showAddForm && (
                <div className="gpt-panel p-6 space-y-5 fade-in">
                    <h3 className="text-lg font-semibold text-card-foreground">Add New Channel</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="gpt-label-muted">
                                YouTube Channel ID
                            </label>
                            <input
                                type="text"
                                placeholder="UCxxxxxxxxxxxxxx"
                                value={newChannelId}
                                onChange={(e) => setNewChannelId(e.target.value)}
                                className="gpt-input w-full mt-2"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                Find this in the channel URL or page source
                            </p>
                        </div>
                        <div>
                            <label className="gpt-label-muted">
                                Display Name
                            </label>
                            <input
                                type="text"
                                placeholder="Channel Name"
                                value={newChannelName}
                                onChange={(e) => setNewChannelName(e.target.value)}
                                className="gpt-input w-full mt-2"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleAdd}
                            disabled={isPending || !newChannelId.trim() || !newChannelName.trim()}
                            className="gpt-button disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPending && <Loader2 size={16} className="animate-spin" />}
                            Add Channel
                        </button>
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="gpt-button-ghost"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Channel list */}
            <div className="gpt-panel overflow-hidden">
                <table className="gpt-table">
                    <thead>
                        <tr>
                            <th>Channel</th>
                            <th>YouTube ID</th>
                            <th className="text-center">Status</th>
                            <th className="text-center">Last Synced</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {channels.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                                    No channels added yet
                                </td>
                            </tr>
                        ) : (
                            channels.map((channel) => (
                                <tr key={channel.id}>
                                    <td>
                                        <span className="font-medium text-card-foreground">
                                            {channel.name}
                                        </span>
                                    </td>
                                    <td>
                                        <code className="text-xs bg-secondary px-2.5 py-1 rounded-full text-muted-foreground">
                                            {channel.youtube_channel_id}
                                        </code>
                                    </td>
                                    <td className="text-center">
                                        <span
                                            className={`gpt-chip text-xs ${channel.approved
                                                ? 'process-success'
                                                : 'process-failed'
                                                }`}
                                        >
                                            {channel.approved ? 'Active' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td className="text-center text-sm text-muted-foreground">
                                        {channel.last_synced_at
                                            ? new Date(channel.last_synced_at).toLocaleDateString()
                                            : 'Never'}
                                    </td>
                                    <td className="text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <button
                                                onClick={() => handleToggle(channel.id, channel.approved)}
                                                disabled={isPending}
                                                className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-card-foreground"
                                                title={channel.approved ? 'Disable' : 'Enable'}
                                            >
                                                {channel.approved ? (
                                                    <ToggleRight size={20} strokeWidth={1.5} className="text-primary" />
                                                ) : (
                                                    <ToggleLeft size={20} strokeWidth={1.5} />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(channel.id)}
                                                disabled={isPending}
                                                className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} strokeWidth={1.5} />
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
