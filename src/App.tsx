import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Newspaper, Send, Search, Loader2, CheckCircle2, Copy, Settings, Upload, Edit3, Image as ImageIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type NewsItem = {
  title: string;
  link: string;
  snippet: string;
  pubDate: string;
};

const CATEGORIES = ['SEO', 'Paid Media', 'Consultoría', 'IA', 'General'];

export default function App() {
  // Brand Settings
  const [brandWebsite, setBrandWebsite] = useState('www.miempresa.com');
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Scanner & Manual Entry
  const [inputMode, setInputMode] = useState<'scan' | 'manual'>('scan');
  const [url, setUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualSnippet, setManualSnippet] = useState('');
  
  const [isScanning, setIsScanning] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  
  // Generation Settings
  const [category, setCategory] = useState(CATEGORIES[4]); // General
  const [imageTemplate, setImageTemplate] = useState(CATEGORIES[4]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<{ copy: string; imageUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Canvas for Image Composition
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [compositedImageUrl, setCompositedImageUrl] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBrandLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsScanning(true);
    setNews([]);
    setSelectedNews(null);
    setGeneratedPost(null);
    setCompositedImageUrl(null);

    try {
      const res = await fetch(`/api/scan?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.items) {
        setNews(data.items);
      } else {
        alert(data.error || 'Error al escanear la URL');
      }
    } catch (error) {
      console.error(error);
      alert('Error de red al escanear la URL');
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle) return;
    
    const newItem: NewsItem = {
      title: manualTitle,
      snippet: manualSnippet,
      link: '#',
      pubDate: new Date().toISOString()
    };
    
    setSelectedNews(newItem);
    setGeneratedPost(null);
    setCompositedImageUrl(null);
  };

  const handleGenerate = async () => {
    if (!selectedNews) return;

    setIsGenerating(true);
    setGeneratedPost(null);
    setCompositedImageUrl(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedNews.title,
          snippet: selectedNews.snippet,
          category,
          imageTemplate
        }),
      });
      const data = await res.json();
      if (data.copy && data.imageUrl) {
        setGeneratedPost(data);
      } else {
        alert(data.error || 'Error al generar el post');
      }
    } catch (error) {
      console.error(error);
      alert('Error de red al generar el post');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedPost) {
      navigator.clipboard.writeText(generatedPost.copy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Composite Image Effect
  useEffect(() => {
    if (!generatedPost?.imageUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseImage = new Image();
    baseImage.src = generatedPost.imageUrl;

    baseImage.onload = () => {
      // Set canvas size to match base image
      canvas.width = baseImage.width;
      canvas.height = baseImage.height;

      // Draw base image
      ctx.drawImage(baseImage, 0, 0);

      // Draw bottom banner
      const bannerHeight = Math.max(80, canvas.height * 0.1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight);

      // Draw Website Text
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${bannerHeight * 0.4}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(brandWebsite, canvas.width - 30, canvas.height - bannerHeight / 2);

      // Draw Logo if available
      if (brandLogo) {
        const logoImg = new Image();
        logoImg.src = brandLogo;
        logoImg.onload = () => {
          const maxLogoHeight = bannerHeight * 0.6;
          const scale = maxLogoHeight / logoImg.height;
          const logoWidth = logoImg.width * scale;
          
          ctx.drawImage(
            logoImg, 
            30, 
            canvas.height - bannerHeight / 2 - maxLogoHeight / 2, 
            logoWidth, 
            maxLogoHeight
          );
          setCompositedImageUrl(canvas.toDataURL('image/png'));
        };
      } else {
        setCompositedImageUrl(canvas.toDataURL('image/png'));
      }
    };
  }, [generatedPost?.imageUrl, brandLogo, brandWebsite]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Send className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">LinkPost AI</h1>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Brand Settings Panel */}
        {showSettings && (
          <motion.section 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden"
          >
            <div className="p-6 sm:p-8 border-b border-neutral-100 bg-neutral-50/50">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <Settings className="w-5 h-5 text-neutral-400" />
                Configuración de Marca
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                Estos elementos se añadirán automáticamente a las imágenes generadas.
              </p>
            </div>
            <div className="p-6 sm:p-8 grid sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Sitio Web</label>
                <input
                  type="text"
                  value={brandWebsite}
                  onChange={(e) => setBrandWebsite(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="www.miempresa.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Logo de la Empresa</label>
                <div className="flex items-center gap-4">
                  {brandLogo && (
                    <div className="w-12 h-12 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-center overflow-hidden p-1">
                      <img src={brandLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                  )}
                  <label className="cursor-pointer bg-white border border-neutral-200 text-neutral-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-neutral-50 transition-colors flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Subir Logo
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Input Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="border-b border-neutral-200 flex">
            <button
              onClick={() => setInputMode('scan')}
              className={cn(
                "flex-1 py-4 text-sm font-medium text-center transition-colors",
                inputMode === 'scan' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
              )}
            >
              Escanear URL
            </button>
            <button
              onClick={() => setInputMode('manual')}
              className={cn(
                "flex-1 py-4 text-sm font-medium text-center transition-colors",
                inputMode === 'manual' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
              )}
            >
              Entrada Manual
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {inputMode === 'scan' ? (
              <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  placeholder="Ingresa la URL del sitio web o feed RSS (ej. https://ejemplo.com)"
                  className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  disabled={isScanning}
                  className="bg-neutral-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 min-w-[140px]"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Escaneando...
                    </>
                  ) : (
                    'Escanear'
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Título de la Noticia</label>
                  <input
                    type="text"
                    required
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Ej. Google anuncia nueva actualización del algoritmo..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Resumen (Opcional)</label>
                  <textarea
                    value={manualSnippet}
                    onChange={(e) => setManualSnippet(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[80px]"
                    placeholder="Breve descripción del contenido..."
                  />
                </div>
                <button
                  type="submit"
                  className="bg-neutral-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  Usar esta Noticia
                </button>
              </form>
            )}
          </div>

          {/* News List */}
          {inputMode === 'scan' && news.length > 0 && (
            <div className="border-t border-neutral-200 bg-neutral-50/50 p-6 sm:p-8">
              <h3 className="text-sm font-medium text-neutral-500 mb-4 uppercase tracking-wider">
                Noticias Encontradas ({news.length})
              </h3>
              <div className="grid gap-3">
                {news.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedNews(item)}
                    className={cn(
                      "text-left p-4 rounded-xl border transition-all duration-200 flex items-start gap-4",
                      selectedNews === item
                        ? "bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500"
                        : "bg-white border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg mt-0.5 shrink-0",
                      selectedNews === item ? "bg-indigo-50 text-indigo-600" : "bg-neutral-100 text-neutral-500"
                    )}>
                      <Newspaper className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-neutral-900 line-clamp-2 leading-snug">
                        {item.title}
                      </h4>
                      {item.snippet && (
                        <p className="text-sm text-neutral-500 mt-1 line-clamp-1">
                          {item.snippet}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Generator Section */}
        {selectedNews && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 sm:p-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div className="grid sm:grid-cols-2 gap-4 flex-1">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Tono del Copy</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Plantilla de Imagen</label>
                  <select
                    value={imageTemplate}
                    onChange={(e) => setImageTemplate(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 min-w-[160px] h-[42px]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  'Generar Post'
                )}
              </button>
            </div>

            {/* Selected News Preview */}
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200 mb-8">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Noticia Seleccionada</p>
              <p className="font-medium text-neutral-900">{selectedNews.title}</p>
            </div>

            {/* Results */}
            {generatedPost && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="grid md:grid-cols-2 gap-8 pt-6 border-t border-neutral-200"
              >
                {/* Copy */}
                <div className="space-y-3 flex flex-col">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-neutral-400" />
                      Copy para LinkedIn (Editable)
                    </h3>
                    <button
                      onClick={handleCopy}
                      className="text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1.5 text-sm font-medium"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <textarea
                    value={generatedPost.copy}
                    onChange={(e) => setGeneratedPost({ ...generatedPost, copy: e.target.value })}
                    className="flex-1 w-full bg-neutral-50 border border-neutral-200 rounded-xl p-5 text-sm leading-relaxed text-neutral-700 font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none min-h-[300px]"
                  />
                </div>

                {/* Image */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-neutral-400" />
                    Imagen Generada
                  </h3>
                  
                  {/* Hidden canvas for composition */}
                  <canvas ref={canvasRef} className="hidden" />

                  <div className="aspect-square rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 relative">
                    {!compositedImageUrl && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
                      </div>
                    )}
                    {compositedImageUrl && (
                      <img
                        src={compositedImageUrl}
                        alt="Generated for LinkedIn"
                        className="w-full h-full object-contain bg-neutral-900"
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href={compositedImageUrl || '#'}
                      download="linkedin-post-image.png"
                      className={cn(
                        "block w-full text-center border px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        compositedImageUrl 
                          ? "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50" 
                          : "bg-neutral-100 border-transparent text-neutral-400 cursor-not-allowed pointer-events-none"
                      )}
                    >
                      1. Descargar Imagen
                    </a>
                    <a
                      href="https://www.linkedin.com/feed/?shareActive=true"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "block w-full text-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        compositedImageUrl 
                          ? "bg-[#0a66c2] text-white hover:bg-[#004182]" 
                          : "bg-neutral-100 text-neutral-400 cursor-not-allowed pointer-events-none"
                      )}
                    >
                      2. Abrir LinkedIn
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.section>
        )}
      </main>
    </div>
  );
}
