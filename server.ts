import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { CensusRecord } from './src/types/census';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'census_live_records.json');

function ensureDataFile(): CensusRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error('Error reading/creating census data file:', err);
  }
  return [];
}

function writeDataFile(records: CensusRecord[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing census data file:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  // Disable caching on API routes so clients always receive the latest modified data
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // GET /api/census -> Read all patient census records
  app.get('/api/census', (_req, res) => {
    try {
      const records = ensureDataFile();
      res.json({
        success: true,
        records,
        serverTime: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || String(err),
        records: [],
      });
    }
  });

  // POST /api/census -> Insert or Update a patient record
  app.post('/api/census', (req, res) => {
    try {
      const record = req.body as CensusRecord;
      if (!record || !record.id || !record.date) {
        res.status(400).json({
          success: false,
          error: 'ข้อมูลไม่ครบถ้วน กรุณาระบุวันที่และรหัสรายการ',
        });
        return;
      }

      const records = ensureDataFile();
      const nowIso = new Date().toISOString();
      const normalizedRecord: CensusRecord = {
        id: String(record.id),
        date: String(record.date),
        shift: (record.shift as any) || 'เช้า',
        totalPatients: Number(record.totalPatients) || 0,
        capacity: Number(record.capacity) || 30,
        availableBeds: Number(record.availableBeds) || 0,
        newPatients: Number(record.newPatients) || 0,
        discharges: Number(record.discharges) || 0,
        referrals: Number(record.referrals) || 0,
        cat1: Number(record.cat1) || 0,
        cat2: Number(record.cat2) || 0,
        cat3: Number(record.cat3) || 0,
        cat4: Number(record.cat4) || 0,
        cat5: Number(record.cat5) || 0,
        note: String(record.note || ''),
        updatedAt: nowIso,
      };

      const foundIndex = records.findIndex(
        (r) =>
          String(r.id) === String(normalizedRecord.id) ||
          (r.date === normalizedRecord.date && r.shift === normalizedRecord.shift)
      );

      if (foundIndex >= 0) {
        normalizedRecord.id = records[foundIndex].id;
        records[foundIndex] = normalizedRecord;
      } else {
        records.push(normalizedRecord);
      }

      writeDataFile(records);
      res.json({
        success: true,
        message: 'บันทึกสำเร็จ',
        record: normalizedRecord,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // DELETE /api/census/:id -> Delete a census record by ID
  app.delete('/api/census/:id', (req, res) => {
    try {
      const id = String(req.params.id);
      const records = ensureDataFile();
      const foundIndex = records.findIndex((r) => String(r.id) === id);
      if (foundIndex === -1) {
        res.status(404).json({ success: false, error: 'ไม่พบรายการที่ต้องการลบ' });
        return;
      }
      records.splice(foundIndex, 1);
      writeDataFile(records);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Ongkharak Hospital Inpatient Census Server running on http://0.0.0.0:${PORT}`
    );
  });
}

startServer();
