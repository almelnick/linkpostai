import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const parser = new Parser();

// Initialize Gemini API
const getAi = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  return new GoogleGenAI({ apiKey });
};

// Endpoint to scan a website or RSS feed
app.get('/api/scan', async (req, res) => {
  let { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  try {
    // Try parsing as RSS first
    try {
      const feed = await parser.parseURL(url);
      const items = feed.items.slice(0, 10).map((item) => ({
        title: item.title,
        link: item.link,
        snippet: item.contentSnippet || item.content || '',
        pubDate: item.pubDate,
      }));
      return res.json({ items });
    } catch (rssError) {
      // If not RSS, try scraping the HTML for links and titles
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const html = await response.text();
      const $ = cheerio.load(html);
      const items: any[] = [];

      // A simple heuristic to find articles/news
      $('a').each((i, el) => {
        const title = $(el).text().trim();
        const link = $(el).attr('href');
        if (title && title.length > 15 && link && !link.startsWith('javascript:') && !link.startsWith('#')) {
          try {
            const absoluteLink = new URL(link, url).href;
            const lowerLink = absoluteLink.toLowerCase();
            
            // Filter out common non-news links
            if (
              !lowerLink.includes('/login') && 
              !lowerLink.includes('/cart') &&
              !lowerLink.includes('/contacto') &&
              !lowerLink.includes('/about')
            ) {
              if (!items.find((item) => item.link === absoluteLink || item.title === title)) {
                items.push({
                  title,
                  link: absoluteLink,
                  snippet: '',
                  pubDate: new Date().toISOString(),
                });
              }
            }
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      });

      if (items.length === 0) {
        return res.status(404).json({ error: 'No se encontraron noticias o artículos en esta URL. Intenta usar la "Entrada Manual".' });
      }

      return res.json({ items: items.slice(0, 15) });
    }
  } catch (error: any) {
    console.error('Error scanning URL:', error);
    res.status(500).json({ error: 'Failed to scan URL: ' + error.message });
  }
});

// Endpoint to generate LinkedIn post and Image
app.post('/api/generate', async (req, res) => {
  const { title, snippet, category, imageTemplate } = req.body;

  if (!title || !category) {
    return res.status(400).json({ error: 'Title and category are required' });
  }

  try {
    const ai = getAi();

    // 1. Generate Copy
    const copyPrompt = `
      Actúa como un Social Media Manager experto.
      Genera un post para la Company Page de LinkedIn basado en la siguiente noticia.
      
      Noticia: "${title}"
      Resumen: "${snippet}"
      Categoría: ${category}
      
      Instrucciones de Template por Categoría:
      - Si es SEO: Usa un tono analítico, menciona algoritmos, tráfico orgánico y posicionamiento. Usa emojis como 🚀, 📈, 🔍.
      - Si es Paid Media: Usa un tono orientado a resultados, ROI, conversiones y optimización de presupuesto. Usa emojis como 💸, 🎯, 📊.
      - Si es Consultoría: Usa un tono corporativo, estratégico y de liderazgo empresarial. Usa emojis como 💼, 🧠, 🤝.
      - Si es IA: Usa un tono innovador, futurista y de transformación digital. Usa emojis como 🤖, ⚡, 🔮.
      - Si es General: Usa un tono profesional, informativo y directo. Usa emojis como 📰, 💡, 📢.
      
      El post debe tener:
      1. Un gancho atractivo (1-2 líneas).
      2. El desarrollo o insight principal de la noticia.
      3. Una pregunta de cierre para generar engagement.
      4. 3-5 hashtags relevantes.
      
      No incluyas saludos ni despedidas, solo el texto del post listo para publicar.
    `;

    const copyResponse = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: copyPrompt,
    });

    const copy = copyResponse.text;

    // 2. Generate Image
    let styleInstruction = "Estilo moderno, minimalista, colores corporativos (azul, naranja, gris), diseño plano (flat design)";
    if (imageTemplate === 'SEO') styleInstruction = "Estilo analítico, gráficos abstractos, líneas de tendencia, colores azules y verdes, diseño plano";
    if (imageTemplate === 'Paid Media') styleInstruction = "Estilo dinámico, iconos de clics, monedas, gráficos de barras, colores vibrantes, diseño plano";
    if (imageTemplate === 'Consultoría') styleInstruction = "Estilo corporativo, elegante, minimalista, formas geométricas, colores oscuros y dorados";
    if (imageTemplate === 'IA') styleInstruction = "Estilo futurista, redes neuronales, nodos brillantes, colores púrpuras y cian, diseño tecnológico";
    if (imageTemplate === 'General') styleInstruction = "Estilo profesional, limpio, formas abstractas suaves, colores neutros y corporativos";

    const imagePrompt = `Una ilustración profesional para un post de LinkedIn sobre ${category}. Tema: ${title}. ${styleInstruction}, sin texto, sin letras, sin palabras.`;

    const imageResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: imagePrompt,
          },
        ],
      },
    });

    let imageUrl = '';
    const parts = imageResponse.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }

    res.json({ copy, imageUrl });
  } catch (error: any) {
    console.error('Error generating content:', error);
    res.status(500).json({ error: 'Failed to generate content: ' + error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
