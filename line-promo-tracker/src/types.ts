// src/types.ts

export interface LineEvent {
  destination: string;
  events: LineMessageEvent[];
}

export interface LineMessageEvent {
  type: 'message' | 'follow' | 'unfollow' | 'join' | 'leave' | 'member_join' | 'member_leave';
  replyToken?: string;
  timestamp: number;
  source: {
    type: 'user' | 'group' | 'room';
    groupId?: string;
    userId?: string;
  };
  message?: {
    id: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
    text?: string;
    quoteToken?: string;
  };
}

export interface PromoOrder {
  unique_id: string; // UUID หรือ Hash จากเนื้อหา
  order_number: string; // เลขลำดับเช่น 1, 4, 8
  product_info: string; // ข้อมูลสินค้าทั้งก้อน
  owner_name: string; // เจ้าของออเดอร์
  assigned_staff: string; // พนักงานที่ถูก tag (@...)
  
  original_message_id: string;
  original_message_text: string;
  created_at: number; // Timestamp
  
  status: 'pending' | 'completed' | 'review'; // 🟡, 🟢, ⚠️
  response_message_id?: string;
  response_message_text?: string;
  response_at?: number;
  matched_by?: 'reply' | 'content' | 'manual';
  match_confidence?: number; // 0.0 - 1.0
  matching_reason?: string;
}

export interface RawMessage {
  message_id: string;
  group_id: string;
  user_id: string;
  display_name: string; // อาจต้อง fetch จาก API แยกหากจำเป็น หรือเก็บเท่าที่ webhook มี
  message_text: string;
  timestamp: number;
  reply_to_message_id?: string; // ถ้าเป็น reply
  is_promo_order: boolean;
}

// โครงสร้างข้อมูลที่จะเก็บใน KV
export interface KvPromoOrder extends PromoOrder {
  // เพิ่ม field สำหรับการจัดการ
  expires_at: number; // สำหรับลบข้อมูลอัตโนมัติ (TTL logic)
}
