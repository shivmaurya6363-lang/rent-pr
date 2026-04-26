/**
 * Generate and download a rental agreement PDF using browser print
 */
export function downloadAgreementPdf(params: {
  orderNumber: string;
  customerName: string;
  productName: string;
  monthlyRent: number;
  securityDeposit: number;
  duration: number;
  createdAt: string;
  termsContent: string;
}) {
  const { orderNumber, customerName, productName, monthlyRent, securityDeposit, duration, createdAt, termsContent } = params;

  const formattedDate = new Date(createdAt).toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric"
  });

  const termsHtml = termsContent
    .split("\n")
    .map(line => {
      if (line.startsWith("# ")) return `<h2 style="font-size:18px;margin:16px 0 8px;">${line.slice(2)}</h2>`;
      if (line.startsWith("## ")) return `<h3 style="font-size:15px;margin:12px 0 6px;">${line.slice(3)}</h3>`;
      if (line.trim() === "") return "<br/>";
      return `<p style="font-size:13px;line-height:1.6;margin:4px 0;color:#333;">${line}</p>`;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Rental Agreement - ${orderNumber}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; color: #222; }
        .header { text-align: center; border-bottom: 2px solid #1a73e8; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1a73e8; font-size: 24px; margin: 0; }
        .header p { color: #666; font-size: 13px; margin: 4px 0 0; }
        .details { background: #f5f7fa; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
        .details table { width: 100%; border-collapse: collapse; }
        .details td { padding: 6px 0; font-size: 14px; }
        .details td:first-child { color: #666; width: 180px; }
        .details td:last-child { font-weight: 600; }
        .terms { margin: 24px 0; }
        .signature { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; }
        .signature-line { border-bottom: 1px solid #333; width: 250px; margin-top: 40px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Rental Agreement</h1>
        <p>Agreement ID: ${orderNumber}</p>
      </div>
      
      <div class="details">
        <table>
          <tr><td>Customer Name</td><td>${customerName}</td></tr>
          <tr><td>Product</td><td>${productName}</td></tr>
          <tr><td>Monthly Rent</td><td>₹${monthlyRent.toLocaleString()}</td></tr>
          <tr><td>Security Deposit</td><td>₹${securityDeposit.toLocaleString()}</td></tr>
          <tr><td>Rental Duration</td><td>${duration} months</td></tr>
          <tr><td>Agreement Date</td><td>${formattedDate}</td></tr>
        </table>
      </div>

      <div class="terms">
        ${termsHtml}
      </div>

      <div class="signature">
        <p style="font-size:13px;color:#666;">By completing payment, the customer has electronically agreed to the above terms and conditions on ${formattedDate}.</p>
        <div class="signature-line"></div>
        <p style="font-size:12px;color:#999;margin-top:8px;">Customer: ${customerName}</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}
