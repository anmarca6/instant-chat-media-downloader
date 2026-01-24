/**
 * Analytics Backend - Instant Chat Media Downloader
 * Receives aggregated usage events and persists them in InstantDB
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { init, tx, id } from '@instantdb/admin';

// Configuration
const PORT = process.env.PORT || 3000;
const INSTANTDB_APP_ID = process.env.INSTANTDB_APP_ID;
const INSTANTDB_ADMIN_TOKEN = process.env.INSTANTDB_ADMIN_TOKEN;

// Supported events
const SUPPORTED_EVENTS = ['magic_scan', 'full_scan'];

// Initialize InstantDB
let db = null;
if (INSTANTDB_APP_ID && INSTANTDB_ADMIN_TOKEN) {
  db = init({
    appId: INSTANTDB_APP_ID,
    adminToken: INSTANTDB_ADMIN_TOKEN
  });
}

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting: 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/events', limiter);

/**
 * Convert Unix timestamp to YYYY-MM-DD format
 */
function timestampToDate(timestamp) {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validate event payload
 */
function validatePayload(payload) {
  const errors = [];

  if (!payload.event || typeof payload.event !== 'string') {
    errors.push('event is required and must be a string');
  } else if (!SUPPORTED_EVENTS.includes(payload.event)) {
    errors.push(`event must be one of: ${SUPPORTED_EVENTS.join(', ')}`);
  }

  if (payload.total_items === undefined || typeof payload.total_items !== 'number') {
    errors.push('total_items is required and must be a number');
  } else if (payload.total_items < 0 || !Number.isInteger(payload.total_items)) {
    errors.push('total_items must be a non-negative integer');
  }

  if (!payload.timestamp || typeof payload.timestamp !== 'number') {
    errors.push('timestamp is required and must be a number');
  }

  return errors;
}

/**
 * POST /events - Receive and aggregate usage events
 */
app.post('/events', async (req, res) => {
  try {
    const payload = req.body;

    // Validate payload
    const errors = validatePayload(payload);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Invalid payload', details: errors });
    }

    // Check if InstantDB is configured
    if (!db) {
      // In development without DB, just log and accept
      console.log('Event received (no DB configured):', payload);
      return res.status(200).json({ success: true, message: 'Event received (dev mode)' });
    }

    const { event, total_items, timestamp } = payload;
    const date = timestampToDate(timestamp);

    // Query existing record for this date/event combination
    const { data } = await db.query({
      dailyEvents: {
        $: {
          where: {
            date: date,
            event: event
          }
        }
      }
    });

    const existingRecords = data?.dailyEvents || [];

    if (existingRecords.length > 0) {
      // Update existing record
      const existing = existingRecords[0];
      await db.transact(
        tx.dailyEvents[existing.id].update({
          total_events: existing.total_events + 1,
          total_items: existing.total_items + total_items
        })
      );
    } else {
      // Create new record
      await db.transact(
        tx.dailyEvents[id()].update({
          date: date,
          event: event,
          total_events: 1,
          total_items: total_items
        })
      );
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error processing event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    db_configured: !!db
  });
});

/**
 * GET /stats - Get aggregated stats (for internal use)
 */
app.get('/stats', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data } = await db.query({
      dailyEvents: {}
    });

    const records = data?.dailyEvents || [];

    // Calculate summary statistics
    const summary = {
      total_records: records.length,
      by_event: {},
      last_7_days: []
    };

    // Group by event type
    for (const record of records) {
      if (!summary.by_event[record.event]) {
        summary.by_event[record.event] = {
          total_events: 0,
          total_items: 0
        };
      }
      summary.by_event[record.event].total_events += record.total_events;
      summary.by_event[record.event].total_items += record.total_items;
    }

    // Get last 7 days
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const dayRecords = records.filter(r => r.date === dateStr);
      const dayStats = {
        date: dateStr,
        magic_scan: { events: 0, items: 0 },
        full_scan: { events: 0, items: 0 }
      };

      for (const record of dayRecords) {
        if (dayStats[record.event]) {
          dayStats[record.event].events = record.total_events;
          dayStats[record.event].items = record.total_items;
        }
      }

      summary.last_7_days.push(dayStats);
    }

    res.status(200).json(summary);

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Analytics backend running on port ${PORT}`);
  console.log(`InstantDB configured: ${!!db}`);
});
