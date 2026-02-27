"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Eye, Search, Filter, Calendar, Book } from "lucide-react";
import { apiCall } from "@/lib/api";

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading past papers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-gray-900 mb-2">
          Past Papers Library
        </h1>
        <p className="text-gray-500">
          Access past papers and mark schemes directly from our collection
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by subject, year, session..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Book className="text-blue-600" size={24} />
            <div>
              <p className="text-sm text-gray-600">Total Papers</p>
              <p className="text-2xl font-bold text-gray-900">{papers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Calendar className="text-green-600" size={24} />
            <div>
              <p className="text-sm text-gray-600">Latest Update</p>
              <p className="text-lg font-semibold text-gray-900">
                {papers.length > 0 ? formatDate(papers[0].modifiedTime) : "N/A"}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Filter className="text-purple-600" size={24} />
            <div>
              <p className="text-sm text-gray-600">Filtered Results</p>
              <p className="text-2xl font-bold text-gray-900">{filteredPapers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Papers Grid */}
      {filteredPapers.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No papers found</h3>
          <p className="text-gray-500">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPapers.map((paper) => (
            <div
              key={paper.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <FileText className="text-blue-600" size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{paper.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{formatFileSize(paper.size)}</span>
                      <span>•</span>
                      <span>{formatDate(paper.modifiedTime)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleView(paper)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Eye size={18} />
                    <span>View</span>
                  </button>
                  <button
                    onClick={() => handleDownload(paper)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download size={18} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Viewer Modal */}
      {showViewer && selectedPaper && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">{selectedPaper.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(selectedPaper)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Download size={16} className="inline mr-2" />
                  Download
                </button>
                <button
                  onClick={() => setShowViewer(false)}
                  className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
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
