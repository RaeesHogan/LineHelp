// src/utils/parser.ts

import { PromoOrder } from '../types';

/**
 * ตรวจสอบว่าข้อความเป็น "การแจ้งเปิดโปร" หรือไม่
 * รูปแบบ: [ลำดับ].[สินค้า] [เจ้าของ] @[พนักงาน]
 * ตัวอย่าง: 4.TP270 P-BMC1/P-LD1/ฟรีLV-A นุ้ย @Cake
 */
export function isPromoOrderMessage(text: string): boolean {
  // Pattern คร่าวๆ: เริ่มด้วยตัวเลข ตามด้วยจุด แล้วมีข้อความ และมี @ ด้านท้าย
  // ไม่ใช้ Regex ที่เข้มงวดเกินไปเพื่อรองรับความหลากหลาย
  const pattern = /^\d+\..*@\w+/;
  return pattern.test(text.trim());
}

/**
 * แยกข้อมูลจากข้อความเปิดโปร
 * ส่งกลับ object ข้อมูล หรือ null ถ้า parse ไม่ได้
 */
export function parsePromoOrder(text: string): Partial<PromoOrder> | null {
  const trimmed = text.trim();
  
  // Regex พยายามจับ:
  // 1. ลำดับ (ตัวเลขก่อนจุดแรก)
  // 2. ข้อมูลสินค้า (ตั้งแต่หลังจุดแรก จนถึงก่อนชื่อเจ้าของ ซึ่งยากที่จะแยกชัดเจน)
  // 3. เจ้าของ (คำสุดท้ายก่อน @Staff)
  // 4. พนักงาน (@...)
  
  // วิธีที่ปลอดภัยกว่า: Split ด้วยช่องว่างและวิเคราะห์
  // สมมติว่ารูปแบบคือ: "เลข.สินค้า[อาจมีช่องว่าง] เจ้าของ @พนักงาน"
  
  const match = trimmed.match(/^(\d+)\.\s*(.+?)\s+([^\s@]+)\s+(@\w+)$/);
  
  if (!match) {
    // ลอง pattern ยืดหยุ่นมากขึ้น กรณีสินค้ามีหลายคำ
    // จับแค่เริ่มด้วยเลข. และจบด้วย @staff
    const looseMatch = trimmed.match(/^(\d+)\.\s*(.+)\s+(@\w+)$/);
    if (looseMatch) {
      const [, orderNum, rest, staff] = looseMatch;
      // พยายามแยกเจ้าของออเดอร์ (สมมติว่าเป็นคำสุดท้ายก่อน @staff)
      const parts = rest.trim().split(/\s+/);
      if (parts.length >= 2) {
        const owner = parts.pop()!; // คำสุดท้ายคือเจ้าของ
        const product = parts.join(' '); // ส่วนที่เหลือคือสินค้า
        return {
          order_number: orderNum,
          product_info: product,
          owner_name: owner,
          assigned_staff: staff.replace('@', ''),
        };
      }
    }
    return null;
  }

  const [, orderNumber, productInfo, ownerName, assignedStaff] = match;

  return {
    order_number: orderNumber,
    product_info: productInfo,
    owner_name: ownerName,
    assigned_staff: assignedStaff.replace('@', ''), // ตัด @ ออก
  };
}

/**
 * สร้าง Unique ID สำหรับรายการเปิดโปร
 * ใช้ hash จาก product_info + owner_name + order_number เพื่อป้องกันการซ้ำ
 * เนื่องจาก order_number ซ้ำได้ แต่ combination น่าจะไม่ซ้ำในเวลาใกล้เคียงกัน
 */
export function generateUniqueOrderKey(order: Partial<PromoOrder>, messageId: string): string {
  // ใช้ message_id ของต้นฉบับเป็น unique หลัก เพราะ LINE guarantee ว่าไม่ซ้ำ
  // หรือจะสร้าง hash จากเนื้อหาก็ได้
  // ในที่นี้ใช้: `order:${messageId}` ไปก่อนเพื่อความง่ายและแน่นอน
  return `order:${messageId}`;
}

/**
 * ตรวจสอบว่าข้อความเป็น "การตอบกลับ/แจ้งเปิดแล้ว" หรือไม่
 * มีคีย์เวิร์ดเช่น "เปิดแล้ว", "คีย์แล้ว", "เสร็จแล้ว"
 */
export function isCompletionMessage(text: string): boolean {
  const keywords = ['เปิดแล้ว', 'คีย์แล้ว', 'เสร็จแล้ว', 'เรียบร้อย', 'done', 'completed'];
  const lowerText = text.toLowerCase();
  return keywords.some(k => lowerText.includes(k.toLowerCase()));
}

/**
 * แยกเอารหัสสินค้าออกจากข้อความตอบกลับ
 * พยายามหา pattern ที่เป็นรหัสสินค้า เช่น TP270, UC2, VDPa4
 */
export function extractProductCodesFromResponse(text: string): string[] {
  const codes: string[] = [];
  
  // Pattern: ตัวอักษรตามด้วยตัวเลข (เช่น TP270, UC2, BN4)
  // อาจจะมี prefix เป็นเลขลำดับหรือไม่ก็ได้
  const pattern = /([A-Za-z]+\d+[A-Za-z0-9]*)/g;
  const matches = text.match(pattern);
  
  if (matches) {
    // กรองเอาเฉพาะที่ดูเป็นรหัสสินค้าจริงๆ (อาจจะกรองคำทั่วไปออก)
    const commonWords = ['แล้ว', 'จ้า', 'ครับ', 'ค่ะ', 'key', 'ตาม', 'ได้เลย', 'เจ้าของ', 'แก้ไข', 'รร', 'all'];
    matches.forEach(m => {
      if (!commonWords.some(w => m.toLowerCase().includes(w.toLowerCase())) && m.length >= 3) {
        codes.push(m);
      }
    });
  }
  
  return codes;
}
