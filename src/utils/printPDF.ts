import { invoke } from '@tauri-apps/api/core';

export async function printPdf(base64: string) {
  try {
    await invoke("print_pdf_base64", { base64Pdf: base64 });
    console.log("PDF sent to printer (default printer)");
  } catch (err) {
    console.error("Print failed:", err);
  }
}
