import express from "express";
import puppeteer from "puppeteer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3005;
app.use(express.json());
app.use(cors()); // Enable CORS
app.use(express.static('/var/www/pdf/pdf-frontend/dist'));

// AWS S3 Configuration
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});
function numberToWords(num) {
  const belowTwenty = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertToWords(n) {
    if (n < 20) return belowTwenty[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + belowTwenty[n % 10] : "");
    if (n < 1000) return belowTwenty[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convertToWords(n % 100) : "");
    if (n < 1000000) return convertToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convertToWords(n % 1000) : "");
    if (n < 1000000000) return convertToWords(Math.floor(n / 1000000)) + " Million" + (n % 1000000 !== 0 ? " " + convertToWords(n % 1000000) : "");
    return convertToWords(Math.floor(n / 1000000000)) + " Billion" + (n % 1000000000 !== 0 ? " " + convertToWords(n % 1000000000) : "");
  }

  return num === 0 ? "Zero" : convertToWords(num);
}

// Generate and Upload PDF API (No Local Storage)
app.post("/generate-pdf", async (req, res) => {
  const { companyName, date, items } = req.body;
  const totalPrice = items.reduce((total, item) => {
    // Calculate item total
    let itemTotal = item.quantity * item.price;

    // Calculate sub-items total
    let subItemsTotal = item.subItems.reduce((subTotal, subItem) => {
      return subTotal + subItem.quantity * subItem.price;
    }, 0);

    return total + itemTotal + subItemsTotal;
  }, 0);
  const totalInword = numberToWords(totalPrice);
  const VATAmount = totalPrice * .15;
  const finalAmount = totalPrice + VATAmount;
  const finalAmountInword = numberToWords(finalAmount)
  try {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Quotation</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        // margin: 20px;
        // padding: 20px;
        background: #f9f9f9;
      }
      .quotation-container {
        background: #fff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        max-width: 820px;
        min-width: 810px;
        margin: auto;
        /* border: 2px solid #0055a4; */
        padding: 39px;
      }
      h2,
      h3 {
        text-align: center;
        color: #0055a4;
      }
      .quotation-header {
        display: flex;
        align-items: center;
        border-bottom: 2px solid #562777b0;
      }
      .quotation_head {
        padding: 7px;
        border-radius: 10px;
        border: 1px solid #562777;
      }
      .quotation_head h6 {
        font-size: 14px;
        line-height: normal;
        margin: 0;
        color: #0055a4;
        font-weight: 800;
      }
      .quotation_head h6.ar{

      }
      .quotation-header img {
        max-height: 70px;
      }
      .quotation-header h5 {
        font-size: 17px;
        line-height: normal;
        margin: 0;
        color: #562777;
        font-weight: 700;
      }
      .blue_font {
        color: #1055a5;
      }
      .quotation-header h5.arabic {
        font-size: 26px;
      }
      .pt-10 {
        padding-top: 20px;
      }
      .italic {
        font-style: italic;
      }
      .compny_name {
        border-bottom: 1px dashed #1055a5;
        width: 80%;
      }
      .cmpny_span {
        color: black border;
        padding-left: 20px;
        font-weight: bold;
      }
      .logo_flex {
        display: flex;
        align-items: center;
        margin-left: auto;
      }
      .quotation-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      .quotation-table th,
      .quotation-table td {
        border: 1px solid #ddd;
        padding: 10px;
        text-align: left;
      }
      .quotation-table th {
        background: transparent;
        color: #1055a5;
      }
      .total {
        text-align: center;
      }
      .footer {
        margin-top: 20px;
      }

      .quotation-table {
        border-collapse: collapse;
        width: 100%;
        border: 2px solid #1055a5; /* Outline border */
      }

      .quotation-table thead,
      .quotation-table tfoot {
        border: 2px solid #1055a5; /* Header and footer border */
      }

      .quotation-table th,
      .quotation-table tfoot td {
        border-bottom: 2px solid #1055a5; /* Bottom border for headers and footers */
        padding: 8px;
        text-align: center;
        border-right: 2px solid #1055a5;
      }

      .quotation-table tbody td {
        padding: 8px;
        text-align: left;
      }
      .quotation-table tbody td {
        border-right: 2px solid #1055a5;
        border-bottom: 2px dotted #1056a57a;
      }
      .bg-blue {
        background-color: #1055a5;
        color: white;
        border-bottom: 2px solid white !important;
      }
      .bg-blue.bg-blue-last {
        border-bottom: 2px solid #1055a5 !important;
      }

      .seal_flex {
        display: flex;
        justify-content: space-between;
      }
      .p-15 {
        padding: 15px !important;
      }
      .seal_flex .content {
        width: 70%;
      }
      .seal_flex .content p {
        font-size: 13px;
        color: #1055a5;
      }
      .seal_flex .seal p {
        font-size: 13px;
        color: #1055a5;
      }
      .seal_flex .content ul {
        padding-left: 14px;
        font-size: 13px;
        color: #1055a5;
      }
      .seal {
        width: 30%;
      }
      .total span {
        border-bottom: 1px dotted #1055a5;
      }
      .seal_box {
        border: 2px solid #1055a5;
        text-align: center;
        border-radius: 10px;
        padding: 7px 20px;
      }
      .seal_box img {
        width: 140px;
      }
      .bottom_div {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
        border-top: 1px solid #562777;
        padding-top: 10px;
      }
      .bottom_div div {
        width: 50%;
      }
      .bottom_div div p {
        font-size: 12px;
        color: black;
        margin-top: 0;
        margin-bottom: 0;
      }
    </style>
  </head>
  <body>
    <div class="quotation-container">
      <div class="quotation-header">
        <div class="quotation_head">
          <h6 class="ar">عرض سعر</h6>
          <h6>QUOTATION</h6>
        </div>
        <div class="logo_flex">
          <img src="https://krishnadas-test-1.s3.ap-south-1.amazonaws.com/logo.png" alt="Company Logo" />

          <div>
            <h5 class="arabic">مؤسسة التوريد والتموين الدولية للتجارة</h5>
            <h5>INTERNATIONAL SUPPLY CORPORATION</h5>
          </div>
        </div>
      </div>
      <p class="blue_font italic">
        <strong>No. </strong>
        <span style="color: red; font-style: normal">0583</span>
      </p>

      <p class="blue_font pt-10" style="margin-bottom: 0">
        Date: <span style="color: black">13/02/2025</span>
      </p>
      <div style="display: flex; align-items: center">
        <p class="blue_font">Company Name:</p>
        <p class="compny_name">
          <span class="cmpny_span">${companyName}</span>
        </p>
      </div>

      <table class="quotation-table">
        <thead>
          <tr>
            <th>
              رقم <br />
              No.
            </th>
            <th style="text-align: center">Description الــــوصــــف</th>
            <th>Img</th>
            <th>الکمیة <br />Quantity</th>
            <th>السعر الوحدة<br />Unit Price</th>
            <th>قیمة الإجمالي<br />Total Price</th>
          </tr>
        </thead>
        <tbody>
        ${items.map((item, index) => {
      return `
            <tr>
              <td>${index + 1}</td>
              <td>${item.name}</td>
              <td></td>
              <td>${item.price}</td>
              <td>${item.quantity}</td>
              <td>${item.price * item.quantity}</td>
            </tr>
            ${item.subItems.map((e, i) => {
        return `
                <tr>
                  <td></td>
                  <td>${e.name}</td>
                  <td></td>
                  <td>${e.price}</td>
                  <td>${e.quantity}</td>
                  <td>${e.price * e.quantity}</td>
                </tr>
              `;
      }).join('')}
          `;
    }).join('')}
        

        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="total">
              <span
                >${totalInword} Saudi Riyals, before VAT ${totalPrice}</span
              >
            </td>
            <td colspan="2" class="bg-blue">المجموع</td>
            <td>${totalPrice}</td>
          </tr>
          <tr>
            <td colspan="3" class="total"><span> +15% VAT on total amount</span></td>
            <td colspan="2" class="bg-blue">ضريبة قيمة مضافة</td>
            <td>${VATAmount}</td>
          </tr>
          <tr>
            <td colspan="3" class="total"><span>${finalAmountInword} SR, (15% VAT Inclusive)</span></td>
            <td colspan="2" class="bg-blue bg-blue-last">جمالي</td>
            <td>${finalAmount}</td>
          </tr>
        </tfoot>
      </table>
      <div class="footer">
        <div class="seal_flex">
          <div class="content">
            <p>Terms & Conditions :</p>
            <ul>
              <li>Payment method 50% advance & rest after completion</li>
              <li>Delivery : 1 week, also depends on the order requirements</li>
            </ul>
            <p style="margin-bottom: 0px; padding-top: 10px">
              We look forward to hear from you soon,
            </p>
            <p style="margin-top: 0px">Thanks & Regards</p>
          </div>
          <div class="seal">
            <p class="" style="margin-top: 0px; text-align: left">
              Stamb & Signature
            </p>
            <div class="seal_box">
              <img src="https://krishnadas-test-1.s3.ap-south-1.amazonaws.com/seal.png" alt="Company Seal" />
            </div>
          </div>
        </div>

        <div class="bottom_div">
          <div>
            <p>
              Kingdom of Saudi Arabia - Riyadh - P.O.Box 8199 - Post Code: 13252
            </p>
            <p>
              Tel.: +966 11 2098112 - Mobile: +966 553559551 - C.R.: 1010588769
            </p>
          </div>
          <div>
            <p>
              المـمـلـكـة الـعـربـيـة الـسـعـوديـة - الـــريـــاض - ص.ب ٨١٩٩ -
              الـــرمـــز الــبــريــدي ١٣٢٥٢
            </p>
            <p>هاتف: ٢٠٩٨١١٢ ١١ +٩٦٦ - جوال: ٥٥٣٥٥٩٥٥١ +٩٦٦ - سجل تجاري: ١</p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

    // Launch Puppeteer and create PDF
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "load" });
    const pdfBuffer = await page.pdf({ format: "A4" });
    await browser.close();

    // Upload to S3
    const fileName = `generated-${Date.now()}.pdf`;
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    };
    await s3.send(new PutObjectCommand(uploadParams));

    // Generate S3 URL
    const s3Url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    res.json({ success: true, pdfUrl: s3Url });
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get("*", (req, res) => {
  res.sendFile('/var/www/pdf/pdf-frontend/dist/index.html');
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
