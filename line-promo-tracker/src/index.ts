import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifySignature } from './utils/line-signature';

const app = new Hono();

// Enable CORS for dashboard
app.use('/*', cors());

// Serve static files from public directory (สำหรับ local dev)
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LINE Promo Tracker Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { background: #00B900; color: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; }
    h1 { font-size: 1.5rem; margin-bottom: 10px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-number { font-size: 2rem; font-weight: bold; margin-bottom: 5px; }
    .stat-label { font-size: 0.9rem; color: #666; }
    .status-opened { color: #28a745; }
    .status-pending { color: #ffc107; }
    .status-check { color: #dc3545; }
    .filters { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .filter-group { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .filter-btn { padding: 8px 16px; border: 2px solid #ddd; background: white; border-radius: 20px; cursor: pointer; }
    .filter-btn.active { background: #00B900; color: white; border-color: #00B900; }
    .search-input { width: 100%; padding: 10px 15px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; }
    .order-list { background: white; border-radius: 8px; overflow: hidden; }
    .order-item { padding: 15px; border-bottom: 1px solid #eee; }
    .order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px; }
    .order-meta { display: flex; gap: 15px; font-size: 0.85rem; color: #888; margin-top: 10px; flex-wrap: wrap; }
    .status-badge { padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; }
    .status-opened { background: #d4edda; color: #155724; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-check { background: #f8d7da; color: #721c24; }
    .empty-state { text-align: center; padding: 40px; color: #888; }
    @media (max-width: 768px) { .stats { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <div class="container">
    <header><h1>📊 LINE Promo Tracker Dashboard</h1><p>ติดตามสถานะการเปิดโปรแบบเรียลไทม์</p></header>
    <div class="stats">
      <div class="stat-card"><div class="stat-number" id="total-count">0</div><div class="stat-label">รายการทั้งหมด</div></div>
      <div class="stat-card"><div class="stat-number status-opened" id="opened-count">0</div><div class="stat-label">🟢 เปิดแล้ว</div></div>
      <div class="stat-card"><div class="stat-number status-pending" id="pending-count">0</div><div class="stat-label">🟡 ยังไม่เปิด</div></div>
      <div class="stat-card"><div class="stat-number status-check" id="check-count">0</div><div class="stat-label">⚠️ ต้องตรวจสอบ</div></div>
    </div>
    <div class="filters">
      <div class="filter-group">
        <button class="filter-btn active" data-filter="all">ทั้งหมด</button>
        <button class="filter-btn" data-filter="opened">เปิดแล้ว</button>
        <button class="filter-btn" data-filter="pending">ยังไม่เปิด</button>
        <button class="filter-btn" data-filter="check">ต้องตรวจสอบ</button>
      </div>
      <input type="text" class="search-input" placeholder="🔍 ค้นหาด้วย รหัสสินค้า, ลำดับออเดอร์, เจ้าของ, พนักงาน..." id="search-input" />
    </div>
    <div class="order-list" id="order-list"><div class="empty-state"><p>ยังไม่มีข้อมูลรายการเปิดโปร</p></div></div>
  </div>
  <script>
    let currentFilter = 'all', searchQuery = '', orders = [];
    async function fetchOrders() {
      try {
        const response = await fetch('/api/orders');
        if (response.ok) { const data = await response.json(); orders = data.orders || []; updateStats(); renderOrders(); }
      } catch (error) { console.log('Fetching orders:', error); }
    }
    function updateStats() {
      document.getElementById('total-count').textContent = orders.length;
      document.getElementById('opened-count').textContent = orders.filter(o => o.status === 'opened').length;
      document.getElementById('pending-count').textContent = orders.filter(o => o.status === 'pending').length;
      document.getElementById('check-count').textContent = orders.filter(o => o.status === 'check').length;
    }
    function getFilteredOrders() {
      return orders.filter(order => {
        const matchesFilter = currentFilter === 'all' || order.status === currentFilter;
        if (!searchQuery) return matchesFilter;
        const query = searchQuery.toLowerCase();
        const matchesSearch = [order.productInfo, order.orderNumber, order.ownerName, order.assignedStaff, order.responseMessage].some(f => f?.toLowerCase().includes(query));
        return matchesFilter && matchesSearch;
      });
    }
    function renderOrders() {
      const filtered = getFilteredOrders();
      const container = document.getElementById('order-list');
      if (filtered.length === 0) { container.innerHTML = '<div class="empty-state"><p>ไม่พบรายการที่ตรงกับเงื่อนไข</p></div>'; return; }
      container.innerHTML = filtered.map(order => \`
        <div class="order-item">
          <div class="order-header">
            <div><div style="font-weight:bold">#\${order.orderNumber || 'N/A'} - \${order.productInfo || 'ไม่มีข้อมูล'}</div></div>
            <span class="status-badge status-\${order.status}">\${{opened:'🟢 เปิดแล้ว',pending:'🟡 ยังไม่เปิด',check:'⚠️ ต้องตรวจสอบ'}[order.status]||order.status}</span>
          </div>
          <div class="order-meta">
            <span>👤 \${order.ownerName||'-'}</span><span>👨‍💼 \${order.assignedStaff||'-'}</span><span>🕒 \${new Date(order.createdAt||Date.now()).toLocaleString('th-TH')}</span>
          </div>
        </div>\`).join('');
    }
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); currentFilter = btn.dataset.filter; renderOrders();
      });
    });
    document.getElementById('search-input').addEventListener('input', (e) => { searchQuery = e.target.value; renderOrders(); });
    fetchOrders(); setInterval(fetchOrders, 30000);
  </script>
</body>
</html>`);
});

// API endpoint for dashboard
app.get('/api/orders', async (c) => {
  // TODO: Fetch orders from KV in Phase 2
  return c.json({ orders: [] });
});

// LINE Webhook endpoint
app.post('/webhook', async (c) => {
  const signature = c.req.header('X-Line-Signature');
  if (!signature) {
    console.log('Missing signature');
    return c.text('Bad Request', 400);
  }

  const body = await c.req.text();
  
  // ใน production ต้อง verify signature
  // const isValid = await verifySignature(body, signature);
  // if (!isValid) {
  //   return c.text('Unauthorized', 401);
  // }

  let event;
  try {
    event = JSON.parse(body);
  } catch (err) {
    console.log('Invalid JSON');
    return c.text('Bad Request', 400);
  }

  console.log('Received webhook event:', JSON.stringify(event, null, 2));

  // ประมวลผล events จาก LINE
  if (event.events && Array.isArray(event.events)) {
    for (const evt of event.events) {
      await processEvent(evt);
    }
  }

  return c.text('OK');
});

async function processEvent(event: any) {
  console.log('Processing event type:', event.type);

  if (event.type === 'message') {
    const message = event.message;
    const source = event.source;
    
    console.log('Message received:', {
      messageId: message.id,
      userId: event.user?.userId || event.source?.userId,
      groupId: source?.groupId,
      text: message.text,
      timestamp: event.timestamp
    });

    // TODO: Phase 2 - Parse promo order messages
    // TODO: Phase 3 - Match response messages
    
    // บันทึก raw message (Phase 1)
    // await saveMessage(event);
  } else if (event.type === 'follow') {
    console.log('User followed:', event.source);
  } else if (event.type === 'unfollow') {
    console.log('User unfollowed:', event.source);
  } else if (event.type === 'join') {
    console.log('Bot joined:', event.source);
  } else if (event.type === 'leave') {
    console.log('Bot left:', event.source);
  }
}

export default app;
