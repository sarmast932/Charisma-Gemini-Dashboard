import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("charisma_tracker.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS price_cache (
    id TEXT PRIMARY KEY,
    price_24k REAL,
    price_silver REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_type TEXT, -- 'gold_18k', 'gold_24k', 'silver'
    amount REAL,
    purchase_price_toman REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO price_cache (id, price_24k, price_silver) VALUES ('latest', 0, 0);
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/prices", async (req, res) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const fetchOptions = {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Cache-Control": "no-cache"
        }
      };

      console.log("Fetching prices from Charisma...");
      
      const tryFetch = async (asset: 'Gold' | 'Silver') => {
        const variations = [
          `https://inv.charisma.ir/pub/Plans/${asset}`,
          `https://inv.charisma.ir/pub/plans/${asset.toLowerCase()}`,
          `https://inv.charisma.ir/api/pub/Plans/${asset}`,
          `https://inv.charisma.ir/api/pub/plans/${asset.toLowerCase()}`
        ];

        for (const url of variations) {
          try {
            console.log(`Trying URL: ${url}`);
            const res = await fetch(url, fetchOptions);
            if (res.ok) {
              const responseJson = await res.json();
              // The API wraps the actual data in a `data` property
              const data = responseJson.data || responseJson; 
              
              if (data && data.latestIndexPrice) {
                console.log(`Success with URL: ${url}`);
                return data;
              }
            }
            console.warn(`URL ${url} returned status ${res.status}`);
          } catch (e: any) {
            console.error(`Failed to fetch ${url}: ${e.message}`);
          }
        }
        return null;
      };

      const [goldData, silverData] = await Promise.all([
        tryFetch('Gold'),
        tryFetch('Silver')
      ]);

      clearTimeout(timeoutId);

      if (!goldData || !silverData) {
        console.error("All API variations failed. Using hardcoded fallback for demo purposes.");
        // Hardcoded fallback prices (approximate market values)
        const fallbackGold = 35000000; // 35M Rial per gram 24k
        const fallbackSilver = 650000;  // 650K Rial per gram
        
        res.json({
          gold: {
            price_24k_toman: fallbackGold / 10,
            price_18k_toman: (fallbackGold * 0.75) / 10,
            daily_change_percent: 0.5
          },
          silver: {
            price_toman: fallbackSilver / 10,
            daily_change_percent: -0.2
          },
          meta: {
            source: "cached",
            last_updated: new Date().toISOString(),
            note: "API Unreachable - Showing fallback data"
          }
        });
        return;
      }

      const price24kRial = goldData.latestIndexPrice.index;
      const priceSilverRial = silverData.latestIndexPrice.index;

      console.log(`Prices updated: Gold ${price24kRial}, Silver ${priceSilverRial}`);

      // Update Cache
      db.prepare("UPDATE price_cache SET price_24k = ?, price_silver = ?, last_updated = CURRENT_TIMESTAMP WHERE id = 'latest'")
        .run(price24kRial, priceSilverRial);

      res.json({
        gold: {
          price_24k_toman: price24kRial / 10,
          price_18k_toman: (price24kRial * 0.75) / 10,
          daily_change_percent: goldData.latestIndexPrice.value || 0
        },
        silver: {
          price_toman: priceSilverRial / 10,
          daily_change_percent: silverData.latestIndexPrice.value || 0
        },
        meta: {
          source: "live",
          last_updated: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error("Fetch failed, serving from cache:", error.message);
      const cached = db.prepare("SELECT * FROM price_cache WHERE id = 'latest'").get() as any;
      res.json({
        gold: {
          price_24k_toman: cached.price_24k / 10,
          price_18k_toman: (cached.price_24k * 0.75) / 10,
          daily_change_percent: 0
        },
        silver: {
          price_toman: cached.price_silver / 10,
          daily_change_percent: 0
        },
        meta: {
          source: "cached",
          last_updated: cached.last_updated
        }
      });
    }
  });

  app.get("/api/portfolio", (req, res) => {
    const items = db.prepare("SELECT * FROM portfolio").all();
    res.json(items);
  });

  app.post("/api/portfolio", (req, res) => {
    const { asset_type, amount, purchase_price_toman } = req.body;
    db.prepare("INSERT INTO portfolio (asset_type, amount, purchase_price_toman) VALUES (?, ?, ?)")
      .run(asset_type, amount, purchase_price_toman);
    res.json({ success: true });
  });

  app.delete("/api/portfolio/:id", (req, res) => {
    db.prepare("DELETE FROM portfolio WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
