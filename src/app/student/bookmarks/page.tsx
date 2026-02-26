"use client";

import { Bookmark, Trash2, ExternalLink } from "lucide-react";

const bookmarks = [
    { id: 1, type: "Question", title: "Calculus: Integration by Parts", note: "Need to review the formula.", date: "2 days ago" },
    { id: 2, type: "Paper", title: "Physics May/June 2023 Paper 2", note: "Hardest paper so far.", date: "1 week ago" },
    { id: 3, type: "Topic", title: "Organic Chemistry mechanisms", note: "", date: "2 weeks ago" },
];

export default function BookmarksPage() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8 flex items-center gap-3">
                <Bookmark className="text-primary" size={32} />
                <div>
                    <h1 className="text-3xl font-bold font-display text-gray-900">Your Bookmarks</h1>
                    <p className="text-gray-500">Saved questions, papers, and topics for quick access.</p>
                </div>
            </div>

            <div className="space-y-4">
                {bookmarks.map((item) => (
                    <div key={item.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${item.type === 'Question' ? 'bg-blue-100 text-blue-700' :
                                        item.type === 'Paper' ? 'bg-purple-100 text-purple-700' :
                                            'bg-orange-100 text-orange-700'
                                    }`}>
                                    {item.type}
                                </span>
                                <span className="text-xs text-gray-400">{item.date}</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">{item.title}</h3>
                            {item.note && <p className="text-gray-500 text-sm italic">&ldquo;{item.note}&rdquo;</p>}
                        </div>

                        <div className="flex items-center gap-2 self-start md:self-center">
                            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                                View <ExternalLink size={16} />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}

                {bookmarks.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                        <Bookmark className="mx-auto text-gray-300 mb-4" size={48} />
                        <h3 className="text-lg font-medium text-gray-900">No bookmarks yet</h3>
                        <p className="text-gray-500">Save items while practicing to see them here.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
