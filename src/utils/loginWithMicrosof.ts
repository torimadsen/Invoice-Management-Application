import { invoke } from '@tauri-apps/api/core';

import {
  BaseDirectory,
  writeTextFile,
  readTextFile,
} from "@tauri-apps/plugin-fs";

export async function loginWithMicrosoft(base64Data: string, email: string, invoiceId: number) {
  try {
      console.log(base64Data)
      await invoke('try_send_mail', { pdfBase64: base64Data, emailAddress: email, invoiceId: invoiceId.toString() });

      // set status as unpaid
      const dataString = await readTextFile("data.json", {
        baseDir: BaseDirectory.AppData,
      });
      const DATA = JSON.parse(dataString);
      DATA.rokningar[invoiceId].status = "unpaid";
      await writeTextFile("data.json", JSON.stringify(DATA, null, 2), {
        baseDir: BaseDirectory.AppData,
      });
    } catch (e) {
      console.error(e);
    }
}