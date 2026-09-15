import logo from "../assets/logo.png";
import jsPDF from "jspdf";
import { LineItem, Customer } from "../types/invoice.ts";

function generatePDF(list: LineItem[], customer: Customer, total: number, invoiceId: number, invoiceCreatedDate: string, invoiceDueDate: string, save: boolean) {
  console.log("save");
  const pdf = new jsPDF("p", "mm", "a4");
  pdf.setFont("helvetica");

  // --- Header ---
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("Faktura - "+ invoiceId, 10, 20);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text("Fakturanummar #: " + invoiceId, 10, 25);
  pdf.text("Skjaladagur: " + invoiceCreatedDate, 10, 30);
  pdf.text("Fellur tann: " + invoiceDueDate, 10, 35);
  pdf.text("Gjaldstreytir: Netto 14 dagar", 10, 40);

  pdf.addImage(logo, "PNG", 140.2, 13, 59.8, 16.9);

  // --- Customer info ---
  

  if (customer.fyritøka == "") {
    pdf.setFont("helvetica", "bold");
    pdf.text(customer.navn, 10, 50);
    pdf.setFont("helvetica", "normal");
    pdf.text(customer.addressa, 10, 55);
    pdf.text(customer.postnummar + " " + customer.bygd, 10, 60);
    pdf.text(customer.teldupostur, 10, 65);
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.text(customer.fyritøka, 10, 50);
    pdf.setFont("helvetica", "normal");
    pdf.text(customer.addressa, 10, 55);
    pdf.text(customer.postnummar + " " + customer.bygd, 10, 60);
    pdf.text(customer.teldupostur, 10, 65);
    pdf.text("Umbiðið: " + customer.navn, 10, 70);
  }

  // --- Store info ---
  pdf.setFont("helvetica", "bold");
  pdf.text("Company Name", 200, 50, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.text("Address", 200, 55, { align: "right" });
  pdf.text("999 City", 200, 60, { align: "right" });
  pdf.text("example@example.com", 200, 65, { align: "right" });
  pdf.text("tlf. +298 12 34 56", 200, 70, { align: "right" });

  // --- Table header ---
  const startY = 80;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");

  let isDiscount = false;
  let startX = 125
  list.forEach((line) => {
    if (line.avsláttur !== "") {
      isDiscount = true;
    }
  })
  if (isDiscount) {
    pdf.text("Avsláttur", 150, startY);
    startX = 100
  }

  pdf.text("Tekstur", 10, startY);
  pdf.text("Nøgd", startX, startY);
  pdf.text("Prísur", startX+25, startY);
  pdf.text("Upphædd", 175, startY);
  

  pdf.line(10, startY + 2, 200, startY + 2);

  pdf.setFont("helvetica", "normal");
  let rowY = startY + 7;

  // --- Table rows ---
  list.forEach((line) => {
    pdf.text(line.tekstur || "", 10, rowY);
    pdf.text(String(line.nøgd), startX, rowY);
    pdf.text(Number(line.prísur).toFixed(2).replace(".", ","), startX+25, rowY);
    if (line.avsláttur !== "") {
      pdf.text((line.avsláttur) + "%", 150, rowY);
    }
    pdf.text(Number(line.upphædd).toFixed(2).replace(".", ","), 175, rowY);
    rowY += 5;

    // Add page if rowY is too low
    if (rowY > 248) {
      pdf.addPage();
      rowY = 20;
    }
  });

  const pageHeight = pdf.internal.pageSize.getHeight(); // total page height
  const bottomMargin = 20; // 20mm from bottom
  const footerY = pageHeight - bottomMargin;

  // --- Total ---
  pdf.setFont("helvetica", "bold");
  pdf.text(`Tilsamans: ${total.toFixed(2).replace(".", ",")} kr`, 151, rowY + 5);
   pdf.setFont("helvetica", "normal");
  pdf.text(`Harav MVG: ${(total*0.2).toFixed(2).replace(".", ",")} kr`, 151, rowY + 10);

  // --- Move to last page ---
  const lastPage = pdf.getNumberOfPages();
  pdf.setPage(lastPage);

  const footerText = `Vinarliga flytið peningin á konto 1234 - 123 456 78 í xxxxx Banka.
Vinarliga tilskilið fakturanummar, tá goldið verður í peningastovni.`;

  // Wrap text to page width
  const lines = pdf.splitTextToSize(footerText, 190); // ~page width
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");

  // Draw text so the **last line is above bottom margin**
  const lineHeight = 5; // spacing between lines
  const startY2 = footerY - lines.length * lineHeight;
  pdf.text(lines, 105, startY2, { align: "center" });
  if (save) {
    pdf.save(`Faktura ${invoiceId}.pdf`);
  }
  const pdfBase64 = pdf.output('datauristring');
  const base64Data = pdfBase64.split(',')[1];

  return base64Data
}

export default generatePDF;
