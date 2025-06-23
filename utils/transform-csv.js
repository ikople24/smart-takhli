const fs = require('fs');
const csv = require('csv-parser');

const results = [];

fs.createReadStream('input.csv', { encoding: 'utf8' })
  .pipe(csv())
  .on('data', (row) => {
    // const [lat, lng] = row["ที่อยู่/location_lat_log"]
    //   ? row["ที่อยู่/location_lat_log"].split(',').map(Number)
    //   : [null, null];
    // const ob_status_raw = row["ความพร้อมอุปกรณ์"] || "";
    // const ob_status = ob_status_raw.includes("✅") ? true : ob_status_raw.includes("⛔") ? false : "";

    const safe = (value) => value?.trim() ? value : "-";

    function removeEmptyFields(obj) {
      return Object.entries(obj).reduce((acc, [key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          acc[key] = val;
        }
        return acc;
      }, {});
    }

    const entry = {
      // old_index: parseInt(row["ลำดับที่"]),
      // prefix: safe(row["บุคคล/คำนำหน้า"]),
      // name: safe(row["บุคคล/ชื่อ-นามสกุล"]),
      // card_id: safe(row["บุคคล/เลข13หลัก"]),
      // birth_date: safe(row["บุคคล/วันเดือนปีเกิด"]),
      // address: removeEmptyFields({
      //   house_no: safe(row["ที่อยู่/บ้านเลขที่"]),
      //   road: safe(row["ที่อยู่/ถนน-ซอย"]),
      //   sub_district: safe(row["ที่อยู่/ชุมชน"])
      // }),
      // recorded_at: safe(row["เจ้าหน้าที่/วันที่บันทึก"]),
      // recorded_by: safe(row["เจ้าหน้าที่/ผู้เก็บข้อมูล"]),
      // location: (lat && lng) ? { lat, lng } : "-",
      // image: [row["ข้อมูลภาพ/บุคคล"], row["ข้อมูลภาพ/ที่อยู่อาศัย"], row["ข้อมูลภาพ/ความเป็นอยู่"]].filter(Boolean),
      // category: safe(row["ประเภทข้อมูล"]),
      // phone: safe(row["บุคคล/เบอร์โทร"]),
      // household_income: safe(row["รายได้ต่อครัวเรือน"]),
      // assistive_devices: safe(row["อุปรกรณ์ช่วยเหลือ"]),
      // remark: safe(row["หมายเหตุ"]),
      // ob_status: ob_status,
      id_use_object: safe(row["รหัสการยืม"]),
      index_id_tk: safe(row["รหัสอุปกรณ์"]),
      id_personal_use: safe(row["รหัสผู้ยืม"]),
      date_lend: safe(row["วันที่ยืม"]),
      date_return: safe(row["วันที่คืน"]),
    };

    results.push(removeEmptyFields(entry));
  })
  .on('end', () => {
    fs.writeFileSync('output.json', JSON.stringify(results, null, 2), 'utf8');
    console.log('✅ แปลงข้อมูลเรียบร้อยแล้ว → บันทึกในไฟล์ output.json');
  })