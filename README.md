# Beloved Family Hub

เว็บแอปส่วนตัวสำหรับจัดการค่าใช้จ่าย เงินออมของลูก ค่าใช้จ่ายยิมนาสติกของโมนา และคลังสูตรอาหารประจำบ้าน

## โครงสร้าง

- `index.html` — หน้าหลักและฟอร์ม/แดชบอร์ดทั้งหมด
- `style.css` — รูปแบบ responsive และองค์ประกอบ UI
- `app.js` — navigation, การขอรหัสผ่าน, popup และ utility กลาง
- `family-expenses.js` — บันทึกและแสดง Family Expenses
- `kids-savings.js` — ฝาก/ถอนและแดชบอร์ดของ Namo/Mona
- `mona-expenses.js` — ค่าใช้จ่าย Mona Gym และตัวกรองช่วงเวลา
- `family-menu/` — คลังสูตรอาหาร 9 สูตรพร้อมเครื่องคำนวณสัดส่วน

## การเปิดใช้งาน

โปรเจกต์เป็น static frontend และควรเปิดผ่าน static web server เช่น VS Code Live Server หรือบริการ static hosting ไม่จำเป็นต้อง build หรือติดตั้ง package

ระบบต้องเชื่อมต่ออินเทอร์เน็ตเพื่อใช้ Google Apps Script, Google Sheets, Chart.js, SweetAlert2, Font Awesome, Google Fonts

## แหล่งข้อมูลภายนอก

ข้อมูลการเงินไม่ได้เก็บใน repository แต่บันทึกผ่าน Google Apps Script และ Google Sheets URL/Deployment ID ที่ใช้งานอยู่กำหนดไว้ในไฟล์ JavaScript ของแต่ละระบบ

## ความปลอดภัย

รหัสผ่านใน `app.js` เป็น client-side gate เพื่อป้องกันการเปิดหน้าหรือ Sheet โดยไม่ตั้งใจเท่านั้น ผู้ที่เข้าถึง source code สามารถเห็นรหัสผ่านและ endpoint ได้ หากต้องการความปลอดภัยจริงควรย้ายการยืนยันตัวตนและสิทธิ์เข้าถึงไปไว้ใน backend/Google Apps Script

ข้อมูลจาก Sheet ที่แสดงผ่าน HTML ต้องผ่าน `escapeHtml()` ก่อนเสมอเพื่อลดความเสี่ยง stored XSS

## ตรวจสอบก่อนเผยแพร่

1. เปิดทุกเมนูทั้ง desktop และ mobile
2. ทดสอบรหัสเปิด Google Sheet
3. ทดสอบบันทึกรายการในระบบทั้งสาม
4. กด Refresh และตรวจเวลาอัปเดตล่าสุด
5. ทดสอบช่วงวันที่ Mona Gym ทั้งแบบวันเดียวและหลายวัน
6. ตรวจ console ของเบราว์เซอร์ว่าไม่มี error
7. ตรวจว่า Google Apps Script deployments และสิทธิ์ของ Sheets ยังใช้งานได้

## Hardening และการทดสอบ

- วันที่เริ่มต้นใช้ปฏิทินท้องถิ่น ป้องกันวันที่คลาดช่วงหลังเที่ยงคืนในไทย
- การอ่าน API มี timeout และแสดงสถานะผิดพลาดบนหน้าเว็บ
- ช่องจำนวนเงินตรวจค่ามากกว่า 0 ทั้งใน HTML และ JavaScript
- การ์ดหลักและการ์ดบัญชีรองรับคีย์บอร์ด
- Family Expenses Dashboard อ่านยอดรวม หมวดหมู่ และประวัติทั้งหมดจาก Google Sheet โดยตรง
- SweetAlert2 และ Chart.js ล็อกเวอร์ชันแบบเจาะจง
- Tailwind Play ของ Family Menu เก็บเป็นไฟล์ local พร้อมบันทึกขนาดและ SHA-256

## จุดสำคัญที่พบ

- รหัส `Admin1234` ที่อยู่ใน frontend ช่วยกันการเปิดโดยไม่ตั้งใจ แต่ไม่ใช่ระบบยืนยันตัวตนจริง ต้องจำกัดสิทธิ์ของ Google Sheet และ Apps Script แยกต่างหาก
- source ของ Google Apps Script ที่ deploy อยู่ไม่ได้อยู่ใน repository นี้ จึงยังต้องนำสัญญา API ใน `apps-script/README.md` ไปปรับและ deploy ที่ฝั่ง Google
- Kids Savings ยังมี GET fallback เพื่อรองรับ backend เดิม เมื่อ deploy `doPost(e)` แล้วควรปิด `KS_ALLOW_LEGACY_GET_FALLBACK`
- Mona Gym ยังใช้ `no-cors`; frontend จึงตรวจยืนยันด้วยการอ่านข้อมูลกลับ หาก backend ส่ง JSON/CORS ได้ควรย้ายไปใช้ response ที่ตรวจสอบได้โดยตรง
- ชุดทดสอบครอบคลุม validation, วันที่, timeout, โครงสร้าง HTML และ dependency แต่การบันทึกจริงกับ Google ต้อง smoke test หลัง deploy ทุกครั้ง

รันทดสอบด้วย Node.js 20 ขึ้นไป:

```bash
npm test
npm run check
```

การเปลี่ยน Apps Script ที่ยังต้อง deploy แยกอธิบายไว้ใน `apps-script/README.md` โดย frontend ยังคง compatibility fallback เพื่อไม่ให้ระบบปัจจุบันหยุดบันทึก
