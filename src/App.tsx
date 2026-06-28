import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Database, 
  Key, 
  Activity, 
  Github, 
  Layers, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  BookMarked,
  Sparkles,
  GitPullRequest,
  Check,
  Sprout,
  Search,
  Grid,
  List
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Book {
  id: number;
  title: string;
  author: string;
  genre: string;
  year: number;
  addedAt: string;
}

interface IntegrationStatus {
  postgres: string;
  rabbitmq: string;
  vault: string;
  mode: string;
  environment?: {
    isVaultMounted: boolean;
    vaultDir: string;
    dbHost: string;
    dbDatabase: string;
    rabbitmqQueue: string;
  };
}

export default function App() {
  // Book states
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  
  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [activeTab, setActiveTab] = useState<"inventory" | "architecture">("inventory");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewLayout, setViewLayout] = useState<"grid" | "list">("grid");

  // Filtered books based on search query
  const filteredBooks = books.filter(book => {
    const query = searchQuery.toLowerCase();
    return (
      book.title.toLowerCase().includes(query) ||
      book.author.toLowerCase().includes(query) ||
      book.genre.toLowerCase().includes(query) ||
      book.year.toString().includes(query)
    );
  });

  // Fetch books & connection status
  const fetchData = async () => {
    try {
      setIsLoading(true);
      // Fetch books
      const booksRes = await fetch("/api/books");
      if (!booksRes.ok) throw new Error("Failed to load books from server.");
      const booksData = await booksRes.json();
      setBooks(booksData);

      // Fetch integration status
      const statusRes = await fetch("/api/status");
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not connect to the full-stack backend. Please verify your dev server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle book creation
  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || !genre || !year) {
      setErrorMessage("Please fill out all fields before submitting.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author, genre, year })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to add the book.");
      }

      const newBook = await response.json();
      setBooks(prev => [newBook, ...prev]);
      
      // Clear inputs
      setTitle("");
      setAuthor("");
      setGenre("");
      setYear(new Date().getFullYear().toString());
      
      setSuccessMessage(`"${newBook.title}" was successfully logged! Event dispatched to RabbitMQ.`);
      
      // Auto dismiss success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
      
      // Refresh status to see if any broker triggers updated
      const statusRes = await fetch("/api/status");
      if (statusRes.ok) setStatus(await statusRes.json());

    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle book deletion
  const handleDeleteBook = async (id: number, titleToDelete: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/books/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to delete the book.");
      }

      setBooks(prev => prev.filter(book => book.id !== id));
      setSuccessMessage(`Removed "${titleToDelete}". Delete audit event broadcasted.`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // Refresh status
      const statusRes = await fetch("/api/status");
      if (statusRes.ok) setStatus(await statusRes.json());
      
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  // Helper for status badge color
  const getStatusBadge = (statusStr: string) => {
    if (!statusStr) return { color: "bg-gray-100 text-gray-700 border-gray-200", text: "Unknown" };
    const lower = statusStr.toLowerCase();
    if (lower.includes("connected") || lower.includes("active")) {
      return { color: "bg-emerald-100 text-emerald-800 border-emerald-200", text: statusStr };
    }
    if (lower.includes("skipped") || lower.includes("sandbox") || lower.includes("preview")) {
      return { color: "bg-amber-100 text-amber-800 border-amber-200", text: statusStr };
    }
    return { color: "bg-rose-100 text-rose-800 border-rose-200", text: statusStr };
  };

  const statusPostgres = getStatusBadge(status?.postgres || "Disconnected");
  const statusRabbitMQ = getStatusBadge(status?.rabbitmq || "Disconnected");
  const statusVault = getStatusBadge(status?.vault || "Disconnected");

  return (
    <div id="app-root" className="min-h-screen bg-gradient-to-br from-[#f2faf5] via-[#e8f5ed] to-[#daf0e3] text-slate-800 pb-20 selection:bg-emerald-200 selection:text-emerald-900">
      
      {/* 1. Header Banner */}
      <header className="border-b border-emerald-100/60 bg-white/75 backdrop-blur-md sticky top-0 z-50 transition-all duration-300 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-md shadow-emerald-600/10 flex items-center justify-center">
              <Sprout className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-emerald-950 flex items-center gap-2">
                Book Inventory Manager
              </h1>
              <p className="text-xs text-emerald-800 font-mono font-medium">GitOps & Cloud-Native Blueprint</p>
            </div>
          </div>

          {/* Navigation/Toggle Tabs */}
          <div className="flex bg-emerald-950/5 p-1 rounded-xl border border-emerald-950/10">
            <button
              id="tab-inventory"
              onClick={() => setActiveTab("inventory")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === "inventory" 
                  ? "bg-white text-emerald-900 shadow-sm font-bold" 
                  : "text-emerald-800/80 hover:text-emerald-950 hover:bg-white/30"
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              Live App View
            </button>
            <button
              id="tab-architecture"
              onClick={() => setActiveTab("architecture")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === "architecture" 
                  ? "bg-white text-emerald-900 shadow-sm font-bold" 
                  : "text-emerald-800/80 hover:text-emerald-950 hover:bg-white/30"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Infrastructure Blueprint
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Alerts Center */}
        <AnimatePresence mode="popLayout">
          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="mb-6 p-4 rounded-xl border border-rose-100 bg-rose-50 text-rose-900 flex items-start gap-3 shadow-sm"
              id="alert-error"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-semibold">Error:</span> {errorMessage}
              </div>
            </motion.div>
          )}

          {successMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="mb-6 p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-950 flex items-start gap-3 shadow-sm"
              id="alert-success"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-semibold">Success:</span> {successMessage}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === "inventory" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN: Controls & Status Panel (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Add Book Card */}
              <section className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-emerald-100/50">
                <div className="flex items-center gap-2 pb-4 mb-4 border-b border-emerald-100/50">
                  <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h2 className="text-md font-bold text-emerald-950">Add Book to Registry</h2>
                </div>

                <form onSubmit={handleAddBook} className="space-y-4">
                  <div>
                    <label htmlFor="title-input" className="block text-xs font-semibold text-emerald-900/80 mb-1.5 uppercase tracking-wider">Book Title</label>
                    <input 
                      id="title-input"
                      type="text" 
                      placeholder="e.g. The Hobbit"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full text-sm bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="author-input" className="block text-xs font-semibold text-emerald-900/80 mb-1.5 uppercase tracking-wider">Author Name</label>
                    <input 
                      id="author-input"
                      type="text" 
                      placeholder="e.g. J.R.R. Tolkien"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="w-full text-sm bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="genre-select" className="block text-xs font-semibold text-emerald-900/80 mb-1.5 uppercase tracking-wider">Genre</label>
                      <select 
                        id="genre-select"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        className="w-full text-sm bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all text-slate-700"
                        required
                      >
                        <option value="">Select Genre</option>
                        <option value="Classic Fiction">Classic Fiction</option>
                        <option value="Fantasy">Fantasy</option>
                        <option value="Science Fiction">Sci-Fi</option>
                        <option value="Mystery / Thriller">Mystery/Thriller</option>
                        <option value="Biography / History">Biography</option>
                        <option value="Technology">Technology</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="year-input" className="block text-xs font-semibold text-emerald-900/80 mb-1.5 uppercase tracking-wider">Pub Year</label>
                      <input 
                        id="year-input"
                        type="number" 
                        max={new Date().getFullYear()}
                        placeholder="e.g. 1937"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="w-full text-sm bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                        required
                      />
                    </div>
                  </div>

                  <button
                    id="submit-book"
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl py-2.5 font-semibold text-sm transition-all duration-150 shadow-sm shadow-emerald-600/10 hover:shadow-md hover:shadow-emerald-600/15 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add Book
                      </>
                    )}
                  </button>
                </form>
              </section>

              {/* Status Diagnostic Panel */}
              <section className="bg-[#0f1d15] text-emerald-100 rounded-2xl p-6 shadow-xl border border-emerald-950/40 relative overflow-hidden">
                <div className="absolute -right-16 -bottom-16 w-36 h-36 bg-emerald-600/10 rounded-full blur-2xl"></div>
                
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-emerald-900/50">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-bold tracking-tight">Active Integrations</h2>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                    LIVE FEED
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Database */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-900/40 text-emerald-400 rounded-lg border border-emerald-800/30 shrink-0">
                      <Database className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-300">PostgreSQL</span>
                        <span className={`inline-block px-1.5 py-0.5 text-[9px] rounded-md font-mono border font-semibold truncate ${statusPostgres.color}`}>
                          {statusPostgres.text}
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-400/70 font-mono mt-0.5 truncate">
                        {status?.environment?.dbHost ? `host: ${status.environment.dbHost}` : "Driver: pg.Pool (Ready)"}
                      </p>
                    </div>
                  </div>

                  {/* Message Broker */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-900/40 text-emerald-400 rounded-lg border border-emerald-800/30 shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-300">RabbitMQ Broker</span>
                        <span className={`inline-block px-1.5 py-0.5 text-[9px] rounded-md font-mono border font-semibold truncate ${statusRabbitMQ.color}`}>
                          {statusRabbitMQ.text}
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-400/70 font-mono mt-0.5">
                        queue: {status?.environment?.rabbitmqQueue || "book-events"}
                      </p>
                    </div>
                  </div>

                  {/* Secrets */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-900/40 text-emerald-400 rounded-lg border border-emerald-800/30 shrink-0">
                      <Key className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-300">HashiCorp Vault</span>
                        <span className={`inline-block px-1.5 py-0.5 text-[9px] rounded-md font-mono border font-semibold truncate ${statusVault.color}`}>
                          {statusVault.text}
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-400/70 font-mono mt-0.5 truncate">
                        {status?.environment?.isVaultMounted ? "Sidecar: /vault/secrets" : "Agent Injector ready"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-emerald-900/50">
                  <div className="bg-emerald-950/60 rounded-xl p-3 border border-emerald-900/60 flex items-start gap-2.5">
                    <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-emerald-200/95">
                      <span className="font-bold">Sandbox Live Preview Note:</span> Because third-party database and message brokers are external to this preview container, the backend utilizes safe fallback mocks so you can test features. The code contains the full, production-ready PostgreSQL, Vault, and RabbitMQ drivers.
                    </p>
                  </div>
                </div>
              </section>

            </div>

            {/* RIGHT COLUMN: Book Display Grid (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Book List Header & Counter */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div>
                  <h2 className="text-lg font-bold text-emerald-950 flex items-center gap-2">
                    Registered Book Collection
                    <span className="bg-emerald-600/10 text-emerald-800 border border-emerald-600/20 text-xs px-2 py-0.5 rounded-full font-bold">
                      {books.length} Total
                    </span>
                  </h2>
                  <p className="text-xs text-emerald-800/80 mt-0.5">Manage and view your catalog. Add books on the left to see instant updates.</p>
                </div>
              </div>

              {/* Search and Layout controls */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white/70 backdrop-blur-sm p-3.5 rounded-2xl border border-emerald-100/50 shadow-sm">
                {/* Search Bar */}
                <div className="relative w-full sm:max-w-md">
                  <Search className="w-4 h-4 text-emerald-800/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="search-books"
                    type="text"
                    placeholder="Search by title, author, genre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs bg-slate-50/70 border border-slate-200 rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Grid vs List View Selector */}
                <div className="flex bg-emerald-950/5 p-1 rounded-xl border border-emerald-950/10 self-stretch sm:self-auto justify-center">
                  <button
                    id="view-grid-btn"
                    onClick={() => setViewLayout("grid")}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer ${
                      viewLayout === "grid"
                        ? "bg-white text-emerald-900 shadow-sm font-bold"
                        : "text-emerald-800/80 hover:text-emerald-950 hover:bg-white/30"
                    }`}
                    title="Grid View"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>Grid View</span>
                  </button>
                  <button
                    id="view-list-btn"
                    onClick={() => setViewLayout("list")}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer ${
                      viewLayout === "list"
                        ? "bg-white text-emerald-900 shadow-sm font-bold"
                        : "text-emerald-800/80 hover:text-emerald-950 hover:bg-white/30"
                    }`}
                    title="List View"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>List View</span>
                  </button>
                </div>
              </div>

              {/* Grid or List Layout of Books */}
              {isLoading ? (
                <div className="bg-white/60 rounded-2xl p-12 border border-emerald-100/30 flex flex-col items-center justify-center gap-3 shadow-sm min-h-[300px]">
                  <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-medium text-emerald-800">Reading Catalog Registry...</p>
                </div>
              ) : books.length === 0 ? (
                <div className="bg-white/70 rounded-2xl p-12 border border-emerald-100/50 flex flex-col items-center justify-center text-center gap-4 shadow-sm min-h-[300px]">
                  <div className="bg-emerald-50 text-emerald-700 p-4 rounded-full border border-emerald-100">
                    <BookOpen className="w-8 h-8 opacity-70" />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-950 text-md">The Book Registry is Empty</h3>
                    <p className="text-xs text-emerald-800/85 max-w-sm mt-1 mx-auto">There are no books currently tracked in the database. Use the input form to append your first book.</p>
                  </div>
                </div>
              ) : filteredBooks.length === 0 ? (
                <div className="bg-white/70 rounded-2xl p-12 border border-emerald-100/50 flex flex-col items-center justify-center text-center gap-3 shadow-sm min-h-[300px]">
                  <div className="bg-amber-50 text-amber-700 p-3 rounded-full border border-amber-100">
                    <Search className="w-6 h-6 opacity-80" />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-950 text-sm">No Match Found</h3>
                    <p className="text-xs text-emerald-800/85 max-w-sm mt-1 mx-auto">
                      No books match your query "<span className="font-semibold text-emerald-900">{searchQuery}</span>". Try searching for another title, author, or genre.
                    </p>
                  </div>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 transition-all cursor-pointer font-semibold"
                  >
                    Clear Filter
                  </button>
                </div>
              ) : viewLayout === "grid" ? (
                <motion.div 
                  layout 
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  id="book-grid"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredBooks.map((book) => (
                      <motion.article
                        key={book.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white hover:bg-emerald-50/20 rounded-2xl p-5 border border-emerald-100/40 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between min-h-[170px]"
                        id={`book-card-${book.id}`}
                      >
                        <div>
                          {/* Card Header & Genre Tag */}
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <span className="inline-block px-2.5 py-0.5 text-[10px] bg-emerald-50 border border-emerald-100 rounded-full font-semibold text-emerald-800">
                              {book.genre}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 font-semibold">
                              ID: #{book.id}
                            </span>
                          </div>

                          {/* Book Details */}
                          <h3 className="text-md font-bold text-slate-800 group-hover:text-emerald-950 transition-colors line-clamp-1">
                            {book.title}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            by {book.author}
                          </p>
                        </div>

                        {/* Card Footer */}
                        <div className="flex items-center justify-between border-t border-slate-100/80 pt-3 mt-4">
                          <span className="text-[10px] text-slate-400 font-mono">
                            Published: <span className="font-bold font-sans text-slate-600">{book.year}</span>
                          </span>
                          
                          <button
                            id={`delete-book-${book.id}`}
                            onClick={() => handleDeleteBook(book.id, book.title)}
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer"
                            title="Delete Book"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div 
                  layout 
                  className="flex flex-col gap-3"
                  id="book-list"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredBooks.map((book) => (
                      <motion.article
                        key={book.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white hover:bg-emerald-50/10 rounded-xl p-4 border border-emerald-100/40 shadow-sm hover:shadow transition-all flex items-center justify-between gap-4"
                        id={`book-list-item-${book.id}`}
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="bg-emerald-50 text-emerald-800 font-bold p-3 rounded-xl border border-emerald-100 shrink-0 w-12 h-12 flex items-center justify-center text-xs font-mono shadow-sm">
                            #{book.id}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1">
                                {book.title}
                              </h3>
                              <span className="inline-block px-2 py-0.5 text-[9px] bg-emerald-50 border border-emerald-100 rounded-full font-semibold text-emerald-800">
                                {book.genre}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              by <span className="font-bold text-slate-700">{book.author}</span> • Published: <span className="font-bold text-slate-600">{book.year}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            id={`delete-book-list-${book.id}`}
                            onClick={() => handleDeleteBook(book.id, book.title)}
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-all cursor-pointer"
                            title="Delete Book"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}

            </div>

          </div>
        ) : (
          /* BLUEPRINT TAB (ArgoCD, Kustomize, Podman, Red Hat UBI, GitHub Actions details) */
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-emerald-100/50 max-w-4xl mx-auto">
            
            <div className="flex items-center gap-3 border-b border-emerald-100 pb-5 mb-6">
              <div className="bg-emerald-900 text-white p-2.5 rounded-xl">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-emerald-950">GitOps & Infrastructure Architecture Spec</h2>
                <p className="text-xs text-emerald-800">OpenShift Container Platform & Red Hat GitOps Integration blueprint</p>
              </div>
            </div>

            <div className="space-y-6">
              
              {/* Repo layout description */}
              <div className="bg-emerald-50/70 rounded-xl p-4 border border-emerald-100 flex gap-4">
                <div className="p-2 bg-emerald-600 text-white rounded-lg self-start">
                  <Github className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">Dual-Repository GitOps Topology</h3>
                  <p className="text-xs text-emerald-800/90 leading-relaxed mt-1">
                    To maintain strict security boundaries and follow GitOps best practices, the codebase has been structured into two logical workspaces representing the two GitHub repositories:
                  </p>
                  <ul className="list-disc list-inside text-xs text-emerald-900 mt-2 space-y-1 font-medium">
                    <li><strong className="text-emerald-950 font-bold">Repository 1 (App Code):</strong> Holds the React frontend, Express server, Red Hat UBI Dockerfile, and GitHub Actions CI pipeline.</li>
                    <li><strong className="text-emerald-950 font-bold">Repository 2 (GitOps Configs):</strong> Holds the Kustomize manifests, ArgoCD application spec, Vault secret injection sidecars, RabbitMQ operators, and OpenShift manifests.</li>
                  </ul>
                </div>
              </div>

              {/* Technologies Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Vault Sidecar Card */}
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">1. HashiCorp Vault Secrets</h4>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">
                    Avoids SDK dependencies in application code. Using Vault Agent Injector annotations on the OpenShift Pod, Vault authenticates via OpenShift ServiceAccount, retrieves PG and RabbitMQ secrets, and mounts them to the container at <code className="bg-slate-200/60 text-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">/vault/secrets/*</code>. The application watches and resolves them dynamically.
                  </p>
                </div>

                {/* RabbitMQ Operator Card */}
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">2. RabbitMQ Message Broker</h4>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">
                    A dedicated broker instance is deployed on OpenShift. When books are created or deleted, Express acts as a producer and dispatches structured event audit payloads to a durable queue. This decouples storage logic from microservices (e.g., search, auditing, mail notifications).
                  </p>
                </div>

                {/* Red Hat UBI Image Card */}
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">3. Red Hat UBI-9 Base Image</h4>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">
                    Builds are packaged using <code className="bg-slate-200/60 text-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">registry.access.redhat.com/ubi9/nodejs-20</code> as the base. This provides security, compliance, and support guarantees within enterprise OpenShift environments, fully hardened for container runtime security.
                  </p>
                </div>

                {/* ArgoCD Card */}
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <GitPullRequest className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">4. GitOps Operator / ArgoCD</h4>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">
                    Maintains the active state of PostgreSQL, RabbitMQ, and the Book App. ArgoCD watches the GitOps config repo and continuously reconciles resources. Manifest overlays are managed using Kustomize (with distinct dev/prod configurations).
                  </p>
                </div>

              </div>

              {/* CI/CD flow diagram */}
              <div className="p-5 rounded-xl border border-emerald-100 bg-[#fbfdfc]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Automated GitOps pipeline flow
                </h4>
                <div className="flex flex-col md:flex-row items-stretch justify-between gap-4 font-mono text-[10px]">
                  
                  <div className="p-3 bg-white border border-slate-200 rounded-lg flex-1 text-center">
                    <div className="font-bold text-slate-700">1. APP CODE REPO</div>
                    <p className="text-[9px] text-slate-500 mt-1">Developer pushes new feature to main branch</p>
                  </div>

                  <div className="flex items-center justify-center text-slate-400 font-sans">➔</div>

                  <div className="p-3 bg-white border border-emerald-200 rounded-lg flex-1 text-center">
                    <div className="font-bold text-emerald-700">2. GITHUB ACTIONS</div>
                    <p className="text-[9px] text-emerald-500 mt-1">Builds UBI image with Podman; pushes to Docker.io; updates image tag in Kustomize manifest</p>
                  </div>

                  <div className="flex items-center justify-center text-slate-400 font-sans">➔</div>

                  <div className="p-3 bg-white border border-slate-200 rounded-lg flex-1 text-center">
                    <div className="font-bold text-slate-700">3. GITOPS REPO</div>
                    <p className="text-[9px] text-slate-500 mt-1">GitOps repo receives commit on deployment spec manifest</p>
                  </div>

                  <div className="flex items-center justify-center text-slate-400 font-sans">➔</div>

                  <div className="p-3 bg-emerald-950 text-emerald-200 rounded-lg flex-1 text-center">
                    <div className="font-bold">4. RED HAT ARGOCD</div>
                    <p className="text-[9px] text-emerald-400/80 mt-1">Syncs the update in real-time onto Red Hat OpenShift cluster</p>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}
      </main>
    </div>
  );
}
