// src/utils/matcher.ts

import { KvPromoOrder } from '../types';

/**
 * Matching Engine: พยายามจับคู่ข้อความตอบกลับกับรายการเปิดโปรเดิม
 * 
 * ลำดับความสำคัญ:
 * 1. ถ้าเป็น Reply ของข้อความเปิดโปรเดิม (confidence สูงสุด)
 * 2. จับคู่จากข้อมูลสินค้า (Product Code)
 * 3. หากพบหลายรายการที่ตรงกัน -> สถานะ "ต้องตรวจสอบ"
 */

export interface MatchResult {
  matchedOrders: KvPromoOrder[];
  confidence: number; // 0.0 - 1.0
  method: 'reply' | 'content' | 'ambiguous' | 'none';
  reason: string;
}

/**
 * ค้นหาและจับคู่ข้อความตอบกลับกับรายการเปิดโปร
 * @param responseText ข้อความตอบกลับ
 * @param replyToMessageId ID ของข้อความที่ถูก reply (ถ้ามี)
 * @param allPendingOrders รายการเปิดโปรทั้งหมดที่ยังไม่เสร็จ (status = pending)
 */
export function matchResponseToOrders(
  responseText: string,
  replyToMessageId: string | undefined,
  allPendingOrders: KvPromoOrder[]
): MatchResult {
  
  // 1. ตรวจสอบกรณี Reply โดยตรง
  if (replyToMessageId) {
    const originalOrder = allPendingOrders.find(o => o.original_message_id === replyToMessageId);
    if (originalOrder) {
      return {
        matchedOrders: [originalOrder],
        confidence: 1.0,
        method: 'reply',
        reason: `เป็นการ Reply โดยตรงกับข้อความเปิดโปร ID: ${replyToMessageId}`
      };
    }
    // ถ้า Reply แต่ไม่เจอ order ที่ตรง (อาจจะเป็น reply ข้อความอื่น)
    // ยังไม่ fall through ไป content ทันที เพราะอาจเป็น reply ที่ไม่เกี่ยวข้อง
    // แต่ในที่นี้จะลองเช็ค content ต่อเผื่อมีการ mention สินค้าในข้อความ reply
  }

  // 2. จับคู่จากเนื้อหา (Product Code / Product Info)
  // แยกเอารหัสสินค้าออกจากข้อความตอบกลับ
  // สมมติว่ามีฟังก์ชัน extractProductCodesFromResponse ใน parser
  // เพื่อลด dependency cycle จะทำ logic ง่ายๆ ตรงนี้
  
  const productCodes = extractProductCodesSimple(responseText);
  
  if (productCodes.length === 0) {
    // ไม่มีรหัสสินค้าให้จับคู่
    return {
      matchedOrders: [],
      confidence: 0,
      method: 'none',
      reason: 'ไม่พบรหัสสินค้าในข้อความตอบกลับ และไม่ใช่ Reply ที่ตรงกับรายการเปิดโปร'
    };
  }

  const matched: KvPromoOrder[] = [];
  const reasons: string[] = [];

  // วนลูปหา order ที่ product_info มีรหัสสินค้าตรงกับที่แยกได้
  for (const code of productCodes) {
    const foundOrders = allPendingOrders.filter(order => 
      order.product_info.includes(code) || 
      order.product_info.toUpperCase().includes(code.toUpperCase())
    );
    
    if (foundOrders.length > 0) {
      matched.push(...foundOrders);
      reasons.push(`พบรหัส '${code}' ใน ${foundOrders.length} รายการ`);
    }
  }

  // กำจัดรายการซ้ำ (กรณีหนึ่งข้อความมีหลายรหัสที่ชี้ไป order เดียวกัน - น้อยมาก)
  const uniqueMatched = Array.from(new Set(matched.map(o => o.unique_id)))
    .map(id => matched.find(o => o.unique_id === id)!);

  if (uniqueMatched.length === 0) {
    return {
      matchedOrders: [],
      confidence: 0,
      method: 'none',
      reason: `พบรหัสสินค้า (${productCodes.join(', ')}) แต่ไม่ตรงกับรายการเปิดโปรใดๆ`
    };
  }

  if (uniqueMatched.length === 1) {
    return {
      matchedOrders: uniqueMatched,
      confidence: 0.8, // ไม่สูงเท่า reply
      method: 'content',
      reason: `จับคู่จากรหัสสินค้า: ${reasons.join('; ')}`
    };
  } else {
    // พบหลายรายการ -> Ambiguous
    return {
      matchedOrders: uniqueMatched,
      confidence: 0.3, // ต่ำ เพราะไม่แน่ใจว่าหมายถึงรายการไหน หรือหมายถึงทุก項?
      method: 'ambiguous',
      reason: `พบการจับคู่หลายรายการ (${uniqueMatched.length}): ${reasons.join('; ')}. ต้องตรวจสอบด้วยตนเอง`
    };
  }
}

/**
 * ฟังก์ชันแยกเอารหัสสินค้าแบบง่าย (Copy มาจาก parser เพื่อลด dependency)
 * Pattern: ตัวอักษรตามด้วยตัวเลข
 */
function extractProductCodesSimple(text: string): string[] {
  const pattern = /([A-Za-z]+\d+[A-Za-z0-9]*)/g;
  const matches = text.match(pattern);
  
  if (!matches) return [];

  const commonWords = ['แล้ว', 'จ้า', 'ครับ', 'ค่ะ', 'key', 'ตาม', 'ได้เลย', 'เจ้าของ', 'แก้ไข', 'รร', 'all', 'TP', 'UC', 'VDP'];
  
  return matches.filter(m => {
    const lowerM = m.toLowerCase();
    // กรองคำสั้นเกินไป หรือเป็นคำทั่วไป
    if (m.length < 3) return false;
    if (commonWords.some(w => w.toLowerCase() === lowerM)) return false;
    return true;
  });
}
