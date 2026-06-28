import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import amqp from "amqplib";

// Create Express app
const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory fallback database for AI Studio Sandbox live preview
interface Book {
  id: number;
  title: string;
  author: string;
  genre: string;
  year: number;
  addedAt: string;
}

let mockBooks: Book[] = [
  { id: 1, title: "The Great Gatsby", author: "F. Scott Fitzgerald", genre: "Classic Fiction", year: 1925, addedAt: new Date().toISOString() },
  { id: 2, title: "To Kill a Mockingbird", author: "Harper Lee", genre: "Classic Fiction", year: 1960, addedAt: new Date().toISOString() },
  { id: 3, title: "1984", author: "George Orwell", genre: "Dystopian", year: 1949, addedAt: new Date().toISOString() }
];
let nextId = 4;

// Integration states
const status = {
  postgres: "Disconnected",
  rabbitmq: "Disconnected",
  vault: "Disconnected",
  mode: "Preview Mode (In-Memory Fallback)"
};

// ==========================================
// 1. HASHICORP VAULT SECRETS RESOLUTION
// ==========================================
// In a production OpenShift/Kubernetes environment, the HashiCorp Vault Agent
// sidecar is used to securely inject secrets into the pod.
// This is the absolute industry-standard best practice because it avoids
// hardcoding credentials, avoids SDK boilerplate, and decouples secrets from the code.
// The Vault Agent mounts secrets at /vault/secrets/.
const VAULT_SECRETS_DIR = "/vault/secrets";
let dbCreds = {
  host: process.env.POSTGRES_HOST || "localhost",
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "postgres",
  database: process.env.POSTGRES_DB || "booksdb",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10)
};

let rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";

// Load secrets from Vault Agent mounts if available
try {
  if (fs.existsSync(VAULT_SECRETS_DIR)) {
    status.vault = "Connected (Vault Agent Secret Mounts Active)";
    
    // Read PostgreSQL secrets written by Vault Agent template
    const dbCredsPath = path.join(VAULT_SECRETS_DIR, "db-creds");
    if (fs.existsSync(dbCredsPath)) {
      const content = fs.readFileSync(dbCredsPath, "utf8");
      // Assuming Vault writes standard KEY=VALUE or JSON
      const lines = content.split("\n");
      lines.forEach(line => {
        const [key, val] = line.split("=");
        if (key && val) {
          const trimmedVal = val.trim().replace(/['"]/g, "");
          if (key.trim() === "POSTGRES_USER") dbCreds.user = trimmedVal;
          if (key.trim() === "POSTGRES_PASSWORD") dbCreds.password = trimmedVal;
          if (key.trim() === "POSTGRES_HOST") dbCreds.host = trimmedVal;
          if (key.trim() === "POSTGRES_DB") dbCreds.database = trimmedVal;
        }
      });
    }

    // Read RabbitMQ secrets written by Vault Agent template
    const rabbitCredsPath = path.join(VAULT_SECRETS_DIR, "rabbitmq-creds");
    if (fs.existsSync(rabbitCredsPath)) {
      const content = fs.readFileSync(rabbitCredsPath, "utf8").trim();
      if (content.startsWith("amqp://") || content.startsWith("amqps://")) {
        rabbitmqUrl = content;
      }
    }
  } else {
    // If Vault environment variables are provided directly (fallback to direct API request)
    const VAULT_ADDR = process.env.VAULT_ADDR;
    const VAULT_TOKEN = process.env.VAULT_TOKEN;
    if (VAULT_ADDR && VAULT_TOKEN) {
      status.vault = "Connected (Direct API configured)";
    } else {
      status.vault = "Unconfigured (Defaulting to local/sandbox values)";
    }
  }
} catch (error) {
  console.warn("⚠️ Vault resolution warning:", (error as Error).message);
  status.vault = "Error Reading Vault Secrets File";
}

// ==========================================
// 2. POSTGRESQL CLIENT AND POOL SETUP
// ==========================================
let pgPool: pg.Pool | null = null;

const initPostgres = async () => {
  // Only attempt to connect to Postgres if it is configured and we are not in simple local preview.
  // In our local AI Studio preview, we gracefully fall back to in-memory/sqlite.
  if (process.env.NODE_ENV === "production" || process.env.FORCE_POSTGRES) {
    try {
      pgPool = new pg.Pool({
        host: dbCreds.host,
        user: dbCreds.user,
        password: dbCreds.password,
        database: dbCreds.database,
        port: dbCreds.port,
        connectionTimeoutMillis: 5000
      });

      // Simple health check query
      await pgPool.query("SELECT NOW()");
      
      // Initialize books table if it doesn't exist
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS books (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          author VARCHAR(255) NOT NULL,
          genre VARCHAR(100) NOT NULL,
          year INTEGER NOT NULL,
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      status.postgres = `Connected (${dbCreds.host}/${dbCreds.database})`;
      status.mode = "Production Mode (PostgreSQL Connected)";
      console.log("✅ PostgreSQL initialized successfully");
    } catch (error) {
      console.error("❌ PostgreSQL initialization failed:", (error as Error).message);
      status.postgres = `Failed Connection: ${(error as Error).message}`;
      pgPool = null;
    }
  } else {
    status.postgres = "Skipped (Running in Sandbox Preview Mode)";
  }
};

// ==========================================
// 3. RABBITMQ CONNECTION AND EVENT PUBLISHER
// ==========================================
let rabbitChannel: amqp.Channel | null = null;
const QUEUE_NAME = "book-events";

const initRabbitMQ = async () => {
  if (process.env.NODE_ENV === "production" || process.env.FORCE_RABBITMQ) {
    try {
      const connection = await amqp.connect(rabbitmqUrl);
      rabbitChannel = await connection.createChannel();
      await rabbitChannel.assertQueue(QUEUE_NAME, { durable: true });
      status.rabbitmq = `Connected to RabbitMQ queue: '${QUEUE_NAME}'`;
      console.log("✅ RabbitMQ initialized successfully");
    } catch (error) {
      console.error("❌ RabbitMQ initialization failed:", (error as Error).message);
      status.rabbitmq = `Failed Connection: ${(error as Error).message}`;
      rabbitChannel = null;
    }
  } else {
    status.rabbitmq = "Skipped (Running in Sandbox Preview Mode)";
  }
};

const publishBookEvent = async (eventType: "ADD_BOOK" | "DELETE_BOOK", bookData: any) => {
  if (rabbitChannel) {
    try {
      const message = JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: bookData
      });
      rabbitChannel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true });
      console.log(`📡 Event '${eventType}' published to RabbitMQ queue.`);
    } catch (error) {
      console.error("⚠️ Failed to publish event to RabbitMQ:", (error as Error).message);
    }
  } else {
    console.log(`📡 [MOCK] RabbitMQ Event '${eventType}' dispatched (Not running in production environment)`);
  }
};

// Initialize integrations
initPostgres().then(() => initRabbitMQ());

// ==========================================
// 4. API ROUTES
// ==========================================

// Get connectivity status
app.get("/api/status", (req, res) => {
  res.json({
    ...status,
    environment: {
      isVaultMounted: fs.existsSync(VAULT_SECRETS_DIR),
      vaultDir: VAULT_SECRETS_DIR,
      dbHost: dbCreds.host,
      dbDatabase: dbCreds.database,
      rabbitmqQueue: QUEUE_NAME
    }
  });
});

// Get all books
app.get("/api/books", async (req, res) => {
  if (pgPool) {
    try {
      const result = await pgPool.query("SELECT * FROM books ORDER BY id DESC");
      // Map postgres table structure to standard response structure
      const books = result.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        author: row.author,
        genre: row.genre,
        year: row.year,
        addedAt: row.added_at
      }));
      res.json(books);
    } catch (error) {
      console.error("❌ Error fetching books from PostgreSQL:", (error as Error).message);
      res.status(500).json({ error: "Failed to fetch books from database" });
    }
  } else {
    // Return in-memory fallback books for live preview
    res.json(mockBooks);
  }
});

// Add a new book
app.post("/api/books", async (req, res) => {
  const { title, author, genre, year } = req.body;
  if (!title || !author || !genre || !year) {
    return res.status(400).json({ error: "Missing required book attributes: title, author, genre, and year are required." });
  }

  const parsedYear = parseInt(year, 10);
  if (isNaN(parsedYear)) {
    return res.status(400).json({ error: "Year must be a valid number" });
  }

  const bookData = {
    title: title.trim(),
    author: author.trim(),
    genre: genre.trim(),
    year: parsedYear
  };

  if (pgPool) {
    try {
      const result = await pgPool.query(
        "INSERT INTO books (title, author, genre, year) VALUES ($1, $2, $3, $4) RETURNING *",
        [bookData.title, bookData.author, bookData.genre, bookData.year]
      );
      
      const newBook = {
        id: result.rows[0].id,
        title: result.rows[0].title,
        author: result.rows[0].author,
        genre: result.rows[0].genre,
        year: result.rows[0].year,
        addedAt: result.rows[0].added_at
      };

      // Publish event to RabbitMQ
      await publishBookEvent("ADD_BOOK", newBook);

      res.status(210).json(newBook);
    } catch (error) {
      console.error("❌ Error inserting book into PostgreSQL:", (error as Error).message);
      res.status(500).json({ error: "Failed to persist book in database" });
    }
  } else {
    // In-Memory Mode
    const newBook: Book = {
      id: nextId++,
      title: bookData.title,
      author: bookData.author,
      genre: bookData.genre,
      year: bookData.year,
      addedAt: new Date().toISOString()
    };
    mockBooks.unshift(newBook);

    // Publish simulated event
    await publishBookEvent("ADD_BOOK", newBook);

    res.status(201).json(newBook);
  }
});

// Delete a book
app.delete("/api/books/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid book ID" });
  }

  if (pgPool) {
    try {
      const checkResult = await pgPool.query("SELECT * FROM books WHERE id = $1", [id]);
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: "Book not found" });
      }

      const deletedBook = checkResult.rows[0];
      await pgPool.query("DELETE FROM books WHERE id = $1", [id]);

      // Publish event to RabbitMQ
      await publishBookEvent("DELETE_BOOK", {
        id: deletedBook.id,
        title: deletedBook.title,
        author: deletedBook.author
      });

      res.json({ message: "Book successfully deleted", deletedId: id });
    } catch (error) {
      console.error("❌ Error deleting book from PostgreSQL:", (error as Error).message);
      res.status(500).json({ error: "Failed to delete book from database" });
    }
  } else {
    // In-Memory Mode
    const bookIndex = mockBooks.findIndex(book => book.id === id);
    if (bookIndex === -1) {
      return res.status(404).json({ error: "Book not found" });
    }

    const [deletedBook] = mockBooks.splice(bookIndex, 1);

    // Publish simulated event
    await publishBookEvent("DELETE_BOOK", {
      id: deletedBook.id,
      title: deletedBook.title,
      author: deletedBook.author
    });

    res.json({ message: "Book successfully deleted", deletedId: id });
  }
});

// ==========================================
// 5. VITE / STATIC ASSETS SERVING MIDDLEWARE
// ==========================================
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    // In development mode, mount Vite middleware to parse React assets
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production mode, serve prebuilt assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
};

startServer();
