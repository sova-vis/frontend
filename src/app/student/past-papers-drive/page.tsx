"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Eye, Search, Filter, Calendar, Book } from "lucide-react";
import { apiCall } from "@/lib/api";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/Motion";

interface PaperFile {
  id: string;
  name: string;
  size: string;
  modifiedTime: string;
  viewUrl: string;
  downloadUrl: string;
  embedUrl: string;
  mimeType: string;
}

export default function GoogleDrivePapersPage() {
  const [papers, setPapers] = useState<PaperFile[]>([]);
  const [filteredPapers, setFilteredPapers] = useState<PaperFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<PaperFile | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  useEffect(() => {
    fetchPapers();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = papers.filter(paper =>
        paper.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPapers(filtered);
    } else {
      setFilteredPapers(papers);
    }
  }, [searchTerm, papers]);

  const fetchPapers = async () => {
    try {
      const response = await apiCall("/papers/drive/list");
      const data = await response.json();
      setPapers(data.files || []);
      setFilteredPapers(data.files || []);
    } catch (error) {
      console.error("Error fetching papers:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes);
    if (size < 1024) return size + " B";
    if (size < 1024 * 1024) return (size / 1024).toFixed(2) + " KB";
    return (size / (1024 * 1024)).toFixed(2) + " MB";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleView = (paper: PaperFile) => {
    setSelectedPaper(paper);
    setShowViewer(true);
  };

  const handleDownload = (paper: PaperFile) => {
    window.open(paper.downloadUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-crimson mx-auto mb-4"></div>
          <p className="text-ink-muted">Loading past papers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-transparent p-8 max-w-7xl mx-auto text-ink">
      {/* Header */}
      <Reveal>
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display tracking-tight text-ink mb-2">
            Past Papers <span className="italic text-crimson">Library</span>
          </h1>
          <p className="text-ink-muted">
            Access past papers and mark schemes directly from our collection
          </p>
        </div>
      </Reveal>

      {/* Search Bar */}
      <Reveal delay={0.05}>
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint z-10" size={20} />
            <input
              type="text"
              placeholder="Search by subject, year, session..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ed-input pl-10 py-3"
            />
          </div>
        </div>
      </Reveal>

      {/* Stats */}
      <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StaggerItem className="ed-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-crimson-soft text-crimson">
              <Book size={24} />
            </div>
            <div>
              <p className="text-sm text-ink-muted">Total Papers</p>
              <p className="text-2xl font-bold font-display text-ink">{papers.length}</p>
            </div>
          </div>
        </StaggerItem>
        <StaggerItem className="ed-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-soft text-mint">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-sm text-ink-muted">Latest Update</p>
              <p className="text-lg font-semibold font-display text-ink">
                {papers.length > 0 ? formatDate(papers[0].modifiedTime) : "N/A"}
              </p>
            </div>
          </div>
        </StaggerItem>
        <StaggerItem className="ed-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-soft text-gold-deep">
              <Filter size={24} />
            </div>
            <div>
              <p className="text-sm text-ink-muted">Filtered Results</p>
              <p className="text-2xl font-bold font-display text-ink">{filteredPapers.length}</p>
            </div>
          </div>
        </StaggerItem>
      </Stagger>

      {/* Papers Grid */}
      {filteredPapers.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto text-ink-faint mb-4" size={64} />
          <h3 className="text-xl font-semibold font-display text-ink-muted mb-2">No papers found</h3>
          <p className="text-ink-muted">Try adjusting your search criteria</p>
        </div>
      ) : (
        <Stagger className="grid gap-4">
          {filteredPapers.map((paper) => (
            <StaggerItem
              key={paper.id}
              className="ed-card p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 bg-crimson-soft rounded-lg text-crimson">
                    <FileText size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-ink mb-1">{paper.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-ink-muted">
                      <span>{formatFileSize(paper.size)}</span>
                      <span>•</span>
                      <span>{formatDate(paper.modifiedTime)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleView(paper)}
                    className="flex items-center gap-2 px-4 py-2 bg-crimson text-white rounded-xl hover:bg-crimson-deep transition-colors"
                  >
                    <Eye size={18} />
                    <span>View</span>
                  </button>
                  <button
                    onClick={() => handleDownload(paper)}
                    className="flex items-center gap-2 px-4 py-2 border border-line bg-surface text-ink-muted rounded-xl hover:bg-surface-soft transition-colors"
                  >
                    <Download size={18} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {/* PDF Viewer Modal */}
      {showViewer && selectedPaper && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-line bg-surface-soft">
              <h3 className="font-display font-semibold text-ink">{selectedPaper.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(selectedPaper)}
                  className="px-4 py-2 text-sm border border-line bg-surface text-ink-muted rounded-lg hover:bg-surface-soft transition-colors"
                >
                  <Download size={16} className="inline mr-2" />
                  Download
                </button>
                <button
                  onClick={() => setShowViewer(false)}
                  className="px-4 py-2 text-sm bg-surface-soft text-ink rounded-lg hover:bg-surface transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 p-4">
              <iframe
                src={selectedPaper.embedUrl}
                className="w-full h-full rounded-lg"
                title={selectedPaper.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
