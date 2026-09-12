import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyLineSignature } from './utils/line-signature';
import { KvPromoOrder } from './types';
import { isPromoOrderMessage, parsePromoOrder, generateUniqueOrderKey, isCompletionMessage } from './utils/parser';

const app = new Hono();

// Enable CORS for dashboard
app.use('/*', cors());

// Dashboard UI
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LINE Promo Tracker</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600&display=swap'); body { font-family: 'Sarabun', sans-serif; }</style>
</head>
<body class="bg-gray-50 text-gray-800">
  <div id="app" class="container mx-auto p-4 max-w-5xl">
    <div class="text-center py-10">
      <h1 class="text-2xl font-bold mb-4">📊 LINE Promo Tracker Dashboard</h1>
      <p class="text-gray-600">กำลังโหลดข้อมูล...</p>
    </div>
  </div>
  <script>
    const API_BASE = '';
    async function fetchStats() {
      try {
        const res = await fetch(\`\${API_BASE}/api/stats\`);
        if (!res.ok) throw new Error('Failed');
        return await res.json();
      } catch (e) { return { total: 0, pending: 0, completed: 0, review: 0 }; }
    }
    async function fetchOrders(statusFilter = 'all') {
      try {
        const res = await fetch(\`\${API_BASE}/api/orders?status=\${statusFilter}\`);
        if (!res.ok) throw new Error('Failed');
        return await res.json();
      } catch (e) { return []; }
    }
    function getStatusBadge(status) {
      const map = {
        'pending': '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">🟡 ยังไม่เปิด</span>',
        'completed': '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">🟢 เปิดแล้ว</span>',
        'review': '<span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">⚠️ ต้องตรวจสอบ</span>'
      };
      return map[status] || status;
    }
    function timeAgo(ts) {
      const s = Math.floor((Date.now() - ts) / 1000);
      if (s < 60) return 'เพิ่งส่ง';
      const m = Math.floor(s / 60);
      if (m < 60) return \`\${m} นาทีที่แล้ว\`;
      const h = Math.floor(m / 60);
      if (h < 24) return \`\${h} ชั่วโมงที่แล้ว\`;
      return \`\${Math.floor(h / 24)} วันที่แล้ว\`;
    }
    async function renderDashboard() {
      const stats = await fetchStats();
      const orders = await fetchOrders('all');
      const html = \`
        <div class="mb-6">
          <h1 class="text-2xl font-bold mb-4 text-gray-900">📊 สถานะการเปิดโปร</h1>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200"><div class="text-sm text-gray-500">ทั้งหมด</div><div class="text-2xl font-bold">\${stats.total}</div></div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-yellow-200"><div class="text-sm text-yellow-600">ยังไม่เปิด</div><div class="text-2xl font-bold text-yellow-700">\${stats.pending}</div></div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-green-200"><div class="text-sm text-green-600">เปิดแล้ว</div><div class="text-2xl font-bold text-green-700">\${stats.completed}</div></div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-red-200"><div class="text-sm text-red-600">ต้องตรวจสอบ</div><div class="text-2xl font-bold text-red-700">\${stats.review}</div></div>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div class="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 class="font-semibold text-lg">รายการล่าสุด</h2>
            <span class="text-xs text-gray-500">อัพเดท: \${new Date().toLocaleTimeString('th-TH')}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead class="bg-gray-50 text-gray-600">
                <tr><th class="px-4 py-3">ลำดับ</th><th class="px-4 py-3">สินค้า</th><th class="px-4 py-3">เจ้าของ</th><th class="px-4 py-3">พนักงาน</th><th class="px-4 py-3">สถานะ</th><th class="px-4 py-3">เวลา</th></tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                \${orders.length === 0 ? '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">ยังไม่มีข้อมูล</td></tr>' : ''}
                \${orders.map(o => \`<tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium">\${o.order_number}</td>
                  <td class="px-4 py-3 max-w-xs truncate" title="\${o.product_info}">\${o.product_info}</td>
                  <td class="px-4 py-3">\${o.owner_name}</td>
                  <td class="px-4 py-3">@\${o.assigned_staff}</td>
                  <td class="px-4 py-3">\${getStatusBadge(o.status)}</td>
                  <td class="px-4 py-3 text-gray-500">\${timeAgo(o.created_at)}</td>
                </tr>\`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      \`;
      document.getElementById('app').innerHTML = html;
    }
    renderDashboard();
    setInterval(renderDashboard, 30000);
  </script>
</body>
</html>`);
});

// Webhook Endpoint
app.post('/webhook', async (c) => {
  const signature = c.req.header('X-Line-Signature');
  if (!signature) return c.json({ error: 'No signature' }, 400);

  const body = await c.req.text();
  const channelSecret = c.env?.LINE_CHANNEL_SECRET;
  
  if (channelSecret) {
    const isValid = await verifyLineSignature(body, signature, channelSecret);
    if (!isValid) return c.json({ error: 'Invalid signature' }, 400);
  }

  let event: any;
  try { event = JSON.parse(body); } 
  catch (e) { return c.json({ error: 'Invalid JSON' }, 400); }

  const kv = c.env.PROMO_DB;
  if (!kv) return c.json({ error: 'Database not configured' }, 500);

  const now = Date.now();
  const allOrdersKey = 'all_orders';
  
  // Get or initialize all_orders list
  let allOrderIds: string[] = await kv.get(allOrdersKey, 'json') || [];

  for (const lineEvent of event.events) {
    if (lineEvent.type !== 'message' || lineEvent.message?.type !== 'text') continue;

    const messageText = lineEvent.message.text || '';
    const messageId = lineEvent.message.id;
    const timestamp = lineEvent.timestamp;
    const groupId = lineEvent.source.groupId || 'unknown';
    const userId = lineEvent.source.userId || 'unknown';

    console.log(`[MSG] ${timestamp}: ${messageText.substring(0, 50)}...`);

    // Check if it's a promo order creation
    if (isPromoOrderMessage(messageText)) {
      const parsed = parsePromoOrder(messageText);
      if (parsed) {
        const uniqueId = generateUniqueOrderKey(parsed, messageId);
        const expiresAt = now + (7 * 24 * 60 * 60 * 1000);

        const newOrder: KvPromoOrder = {
          unique_id: uniqueId,
          order_number: parsed.order_number!,
          product_info: parsed.product_info!,
          owner_name: parsed.owner_name!,
          assigned_staff: parsed.assigned_staff!,
          original_message_id: messageId,
          original_message_text: messageText,
          created_at: now,
          status: 'pending',
          expires_at: expiresAt,
          matched_by: 'auto',
          match_confidence: 1.0,
          matching_reason: 'Parsed from new promo message'
        };

        await kv.put(uniqueId, JSON.stringify(newOrder));
        
        if (!allOrderIds.includes(uniqueId)) {
          allOrderIds.push(uniqueId);
          await kv.put(allOrdersKey, JSON.stringify(allOrderIds));
        }

        console.log(`[NEW ORDER] ${uniqueId}: ${parsed.product_info}`);
      } else {
        console.log(`[PARSE FAIL] Could not parse: ${messageText}`);
      }
    } 
    // Check if it's a completion response
    else if (isCompletionMessage(messageText)) {
      const productCodes = extractProductCodes(messageText);
      
      // Find pending orders
      const pendingOrders: KvPromoOrder[] = [];
      for (const id of allOrderIds) {
        const data = await kv.get(id, 'json');
        if (data && data.status === 'pending') {
          pendingOrders.push(data);
        }
      }

      const matched: KvPromoOrder[] = [];
      for (const code of productCodes) {
        for (const order of pendingOrders) {
          if (order.product_info.includes(code) || order.product_info.toUpperCase().includes(code.toUpperCase())) {
            if (!matched.find(o => o.unique_id === order.unique_id)) {
              matched.push(order);
            }
          }
        }
      }

      if (matched.length > 0) {
        for (const order of matched) {
          const newStatus: 'completed' | 'review' = matched.length === 1 ? 'completed' : 'review';
          
          const updatedOrder: KvPromoOrder = {
            ...order,
            status: newStatus,
            response_message_id: messageId,
            response_message_text: messageText,
            response_at: now,
            matched_by: matched.length === 1 ? 'content' : 'ambiguous',
            match_confidence: matched.length === 1 ? 0.8 : 0.3,
            matching_reason: matched.length === 1 ? 'Matched by product code' : 'Multiple matches found'
          };

          await kv.put(order.unique_id, JSON.stringify(updatedOrder));
          console.log(`[UPDATE] ${order.unique_id} -> ${newStatus}`);
        }
      } else {
        console.log(`[MATCH FAIL] No matching orders for: ${messageText}`);
      }
    }
  }

  return c.json({ success: true });
});

function extractProductCodes(text: string): string[] {
  const pattern = /([A-Za-z]+\d+[A-Za-z0-9]*)/g;
  const matches = text.match(pattern);
  if (!matches) return [];
  const commonWords = ['แล้ว', 'จ้า', 'ครับ', 'ค่ะ', 'key', 'ตาม', 'ได้เลย', 'เจ้าของ', 'แก้ไข', 'รร', 'all'];
  return matches.filter(m => m.length >= 3 && !commonWords.some(w => w.toLowerCase() === m.toLowerCase()));
}

// API: Get Stats
app.get('/api/stats', async (c) => {
  const kv = c.env.PROMO_DB;
  if (!kv) return c.json({ error: 'DB not found' }, 500);

  let total = 0, pending = 0, completed = 0, review = 0;
  const allOrderIds: string[] = await kv.get('all_orders', 'json') || [];

  for (const id of allOrderIds) {
    const order: KvPromoOrder = await kv.get(id, 'json');
    if (order && (!order.expires_at || Date.now() <= order.expires_at)) {
      total++;
      if (order.status === 'pending') pending++;
      else if (order.status === 'completed') completed++;
      else if (order.status === 'review') review++;
    }
  }

  return c.json({ total, pending, completed, review });
});

// API: Get Orders
app.get('/api/orders', async (c) => {
  const kv = c.env.PROMO_DB;
  if (!kv) return c.json({ error: 'DB not found' }, 500);

  const statusFilter = c.req.query('status') || 'all';
  const allOrderIds: string[] = await kv.get('all_orders', 'json') || [];
  const orders: KvPromoOrder[] = [];

  for (const id of allOrderIds) {
    const order: KvPromoOrder = await kv.get(id, 'json');
    if (order && (!order.expires_at || Date.now() <= order.expires_at)) {
      if (statusFilter === 'all' || order.status === statusFilter) {
        orders.push(order);
      }
    }
  }

  orders.sort((a, b) => b.created_at - a.created_at);
  return c.json(orders);
});

// Cleanup endpoint (for cron)
app.get('/cleanup', async (c) => {
  const kv = c.env.PROMO_DB;
  if (!kv) return c.text('DB not found', 500);

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const allOrderIds: string[] = await kv.get('all_orders', 'json') || [];
  let deletedCount = 0;
  const validIds: string[] = [];

  for (const id of allOrderIds) {
    const order: KvPromoOrder = await kv.get(id, 'json');
    if (order && order.created_at < sevenDaysAgo) {
      await kv.delete(id);
      deletedCount++;
    } else {
      validIds.push(id);
    }
  }

  await kv.put('all_orders', JSON.stringify(validIds));
  return c.text(`Cleaned up ${deletedCount} old records`);
});

export default app;
