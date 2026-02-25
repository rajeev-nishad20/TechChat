import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { networkInterfaces } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 5000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(bodyParser.json());

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend'), {
    setHeaders: (res, path) => {
        res.set('Cache-Control', 'no-cache');
        if (path.endsWith('.html')) {
            res.set('Content-Type', 'text/html; charset=UTF-8');
        }
        if (path.endsWith('.js')) {
            res.set('Content-Type', 'application/javascript');
        }
        if (path.endsWith('.css')) {
            res.set('Content-Type', 'text/css');
        }
    }
}));

// Initialize Gemini
const genAI = new GoogleGenerativeAI("AIzaSyBqGbO0bhbNDBjsgsu3aOAx7finJ1Pv0lE");

// Serve frontend index.html for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Create a new chat model instance
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.9,
        topP: 0.8,
        topK: 40,
    },
    safetySettings: [
        {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
    ],
});

// Chat API route
app.post("/chat", async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: "Message is required", success: false });
        }

        console.log('Received message:', message);
        
        // Generate content using the model
        const result = await model.generateContent(message);
        const response = await result.response;
        const reply = response.text();
        
        console.log('Generated reply length:', reply.length);
        
        // Ensure response is always valid JSON
        res.json({ 
            reply: reply,
            success: true,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Chat error:', err);
        console.error('Error type:', err.constructor.name);
        console.error('Error message:', err.message);
        
        res.status(500).json({ 
            error: "Something went wrong processing your message",
            success: false,
            details: process.env.NODE_ENV === 'development' ? err.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// Serve index.html for any route not found (SPA support)
app.use((req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api') || req.path === '/chat' || req.path === '/health') {
        res.status(404).json({ error: 'Not found' });
    } else {
        // Serve index.html for SPA routes
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    }
});

// Function to get local IP address
function getLocalIP() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('Access URLs:');
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`Network: http://${getLocalIP()}:${PORT}`);
});
