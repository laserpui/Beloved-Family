# Family Bank Manager — Google Sheets / Apps Script

## เวอร์ชันปัจจุบัน

- `index.html` ฝัง URL Apps Script ที่ผู้ใช้ระบุไว้ในตัวแปร `WEB_APP_URL` แล้ว ไม่ต้องกรอก URL
- อ่าน/เพิ่ม/แก้ไข/ปักหมุด/ลบบัญชี และนำเข้าไฟล์สำรองผ่าน API
- ไม่ใช้ API key ตามคำยืนยันของผู้ใช้ ผู้ที่เข้าถึง Web app ได้ตามสิทธิ์ Deploy สามารถอ่าน แก้ไข และลบข้อมูลผ่าน API ได้
- ข้อมูลเดิมใน Local Storage ยังอยู่แยกจากข้อมูลใน Google Sheets ไม่มีการย้ายหรือลบข้อมูลเดิมอัตโนมัติ

## อัปเดต Apps Script ที่ Deploy แล้ว

1. เปิด Google Sheet > ส่วนขยาย > Apps Script
2. แทนโค้ดเดิมด้วย `Code.gs` ล่าสุด แล้วบันทึก
3. หากยังไม่เคยตั้งค่า ให้รัน `setupFamilyBank()` และอนุญาตสิทธิ์ หากเคยรันแล้วไม่จำเป็นต้องรันซ้ำ การรันซ้ำไม่ล้างข้อมูล
4. เปิด **Deploy > Manage deployments > เลือก deployment เดิม > Edit (รูปดินสอ) > Version: New version > Deploy** เพื่อใช้ URL เดิมที่ฝังไว้
5. สำหรับหน้าเว็บภายนอกที่เรียกด้วย fetch ให้ Execute as: **Me** และเลือกสิทธิ์ Web app ให้เรียกได้ เช่น **Anyone** (หากบัญชี/นโยบายองค์กรอนุญาต) ไม่ต้องเปิดแชร์ Google Sheet สาธารณะ
6. เปิดหรือรีเฟรช `index.html` ระบบจะโหลดข้อมูลจาก Sheet อัตโนมัติ

หากยังขึ้นว่า Apps Script ตรวจ API key แสดงว่า deployment ยังใช้โค้ดเวอร์ชันเก่า ให้ Deploy New version ใน deployment เดิม ไม่ต้องส่ง API key

## การใช้งานและข้อมูลเดิม

- ป้ายด้านบนบอกว่ากำลังใช้ Google Sheets หรือข้อมูลบนอุปกรณ์
- ไปที่ **ตั้งค่า > การเชื่อมต่อ Google Sheets** เพื่อโหลดข้อมูลล่าสุดหรือเลือกโหมดบนอุปกรณ์
- หากต้องการนำข้อมูลบนอุปกรณ์ขึ้น Sheet ให้กด **นำข้อมูลเดิมบนอุปกรณ์ขึ้น Sheet** และยืนยัน ระบบเพิ่มเฉพาะบัญชีที่ไม่ซ้ำ ข้อมูลต้นฉบับบนอุปกรณ์ยังอยู่
- การแสดงเลขบัญชีแบบปิดบางส่วนและรูปแบบคัดลอกเป็นการตั้งค่าของเบราว์เซอร์
- การส่งออกสำรองใช้ข้อมูลชุดที่กำลังแสดงอยู่ หากต้องการสำรองข้อมูลเดิม ให้เลือกโหมดบนอุปกรณ์ก่อนส่งออก
- หากเชื่อมต่อหรือเขียนไม่สำเร็จ ระบบไม่เปลี่ยนไปบันทึกบนอุปกรณ์อัตโนมัติ ต้องเลือกโหมดเอง
- หลัง POST ล้มเหลว/หมดเวลา การบันทึกและลบจะถูกพักไว้จนโหลดข้อมูลล่าสุด เพื่อป้องกันการลองซ้ำโดยไม่ทราบว่ารายการเดิมสำเร็จแล้วหรือไม่

## การลบบัญชี

กด **ลบ** บนการ์ดบัญชี ระบบแสดงธนาคาร ชื่อบัญชี และเลขบัญชี (ปิดบางส่วนตามการตั้งค่า) ให้ตรวจสอบ แล้วกด **ยืนยันการลบ** หรือ **ยกเลิก**

- โหมด Google Sheets ลบแถวของ ID ที่เลือกเท่านั้น พร้อมตรวจ `expectedUpdatedAt` หากมีคนแก้ไขก่อนจะหยุดด้วย CONFLICT ต้องโหลดล่าสุดและตรวจสอบใหม่
- โหมดบนอุปกรณ์ลบจาก Local Storage เท่านั้น ไม่ลบข้อมูลใน Sheet
- ไม่มีการลบข้อมูลเดิมเพียงเพราะเปิดไฟล์เวอร์ชันใหม่
- การลบสำเร็จไม่สามารถ Undo ในแอปได้ หากต้องการเก็บรายการไว้ให้แก้ไขสถานะเป็น “ปิดใช้งาน” แทน
- ต้อง Deploy `Code.gs` ล่าสุดก่อนจึงจะลบผ่าน Google Sheets ได้

## โครงสร้างข้อมูล

ชีต `FamilyBank_Accounts` ใช้หัวตารางเดิม:

`id, nickname, bank, number, owner, type, category, branch, note, status, favorite, createdAt, updatedAt`

เลขบัญชีเป็นข้อความ รักษาเลข 0 ด้านหน้า รับ 6–20 หลัก ทุกช่องเขียนเป็น literal text ด้วย RichTextValue จึงไม่ตีความข้อความเป็นสูตร ไม่มีการเพิ่มคอลัมน์ใหม่เพื่อรองรับการลบ

## สัญญา API

GET `/exec` คืนสถานะบริการเท่านั้น POST ส่ง JSON ใน body ด้วย Content-Type: text/plain;charset=utf-8 และ redirect: follow ไม่มี apiKey หรือ custom Authorization header ไม่ใช้ mode: no-cors เพราะอ่านผลไม่ได้

```js
async function request(action, payload = {}) {
  const response = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, action }),
    redirect: 'follow'
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
```

- `list` → `{ version: 1, accounts: [...] }`
- `saveAccount` + `account` → `{ account, created }` สำหรับแก้ไขต้องส่ง `expectedUpdatedAt` จากข้อมูลล่าสุด ใช้ id เดิม
- `setFavorite` + `id`, `favorite`, `expectedUpdatedAt` → `{ account, created: false }`
- `deleteAccount` + `id`, `expectedUpdatedAt` → `{ id, deleted: true }`
- `importAccounts` + `backup: { version: 1, accounts: [...] }` → `{ imported, skipped }` เพิ่มอย่างเดียว ไม่เขียนทับบัญชีเดิม

```js
await request('deleteAccount', {
  id: selectedAccount.id,
  expectedUpdatedAt: selectedAccount.updatedAt
});
```

ผลสำเร็จ `{ ok: true, data: ... }` ผลผิดพลาด `{ ok: false, error: { code, message } }` ตัวเชื่อมต่อต้องตรวจ ok แม้ HTTP จะเป็น 200

API ใช้ script lock ป้องกันการเขียนพร้อมกัน แต่ไม่ได้ล็อกการแก้ไขด้วยมือใน Sheet จำกัด 10,000 แถวและ body 2,000,000 ตัวอักษร ไฟล์สำรองขนาดใหญ่ควรแบ่งชุดย่อย

## ทดสอบ

```text
node Backup/test-code-gs.cjs
node Backup/test-connection.cjs
```

ใช้ชีตจำลองในหน่วยความจำ ไม่เรียก Google Sheet จริง ยังต้องทดสอบกับ deployment เวอร์ชันล่าสุดหลังผู้ใช้อัปเดต Code.gs

เอกสาร Google: [Web apps](https://developers.google.com/apps-script/guides/web), [Sheet.deleteRow](https://developers.google.com/apps-script/reference/spreadsheet/sheet#deleterowrowposition), [Lock Service](https://developers.google.com/apps-script/reference/lock)

## หน้า Admin

ปุ่มแก้ไขและลบแสดงเฉพาะหน้า Admin ใช้รหัส `Admin1234` ทุกครั้งที่กลับเข้าหลังออกจากหน้า ไม่จดจำสิทธิ์หลังรีเฟรช หน้า Dashboard และบัญชีทั้งหมดไม่สร้างปุ่มทั้งสองในรายการบัญชี การเพิ่มบัญชีและปักหมุดยังทำได้เหมือนเดิม

รหัสนี้เป็นการควบคุมหน้าจอฝั่งเบราว์เซอร์เท่านั้น ไม่ใช่การตรวจสิทธิ์ของ Apps Script API ซึ่งยังไม่ใช้ API key ตามการตั้งค่าที่ผู้ใช้ยืนยันไว้

## เมนูปัจจุบัน

รวม Dashboard และบัญชีทั้งหมดเป็นหน้า “บัญชีธนาคาร” มีตัวเลขสรุป ค้นหา กรองหมวดหมู่ และคัดลอกข้อมูล เหลือเมนูบัญชีธนาคารกับ Admin การล็อก Admin จะกลับมาหน้าบัญชีธนาคาร ไม่เปลี่ยน API หรือข้อมูลเดิม

## ผลตรวจล่าสุด 2026-11-23

ตรวจรับ–ส่งกับ deployment จริงแล้ว เพิ่ม อ่าน แก้ไข ปักหมุด และลบบัญชีจำลองได้ บัญชีจริง 8 รายการไม่เปลี่ยนแปลง เก็บผลวัดและรายงานที่ Backup/audit-report.txt

เวอร์ชัน Code.gs `2026-11-23.audit1` ลดการอ่านช่วง Sheet จาก 2 เป็น 1 ครั้งสำหรับ list และจาก 3 เป็น 1 ครั้งสำหรับ setFavorite พร้อมส่ง meta.serverMs และ meta.build ในผลสำเร็จ ต้อง Deploy New version ใน deployment เดิมเพื่อให้การปรับ backend มีผล ส่วน index.html เพิ่มปุ่มรีเฟรชและสถานะรอ ไม่ได้เก็บข้อมูลบัญชีบน Sheet ลงแคชอัตโนมัติ
