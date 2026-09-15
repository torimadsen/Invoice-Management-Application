import { useEffect } from "react";
import {
  BaseDirectory,
  exists,
  readDir,
  readTextFile,
  stat,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
const crypto = globalThis.crypto;
const { subtle } = globalThis.crypto;

const encryptionPassword = "EXAMPLE-ENCRYPTION-PASSWORD";

// unfinished
async function createAesKey(
  password: string,
  saltBytes: Uint8Array<ArrayBuffer>,
) {
  const ec = new TextEncoder();

  const key = await subtle.importKey(
    "raw",
    ec.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  console.log(key);

  const derivedKey = await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 600000,
      hash: "SHA-256",
    },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  return derivedKey;
}

async function aesEncrypt(plaintext: string) {
  const ec = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await createAesKey(encryptionPassword, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    ec.encode(plaintext),
  );

  return {
    salt,
    iv,
    ciphertext,
  };
}

async function aesDecrypt(
  ciphertext: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
  iv: Uint8Array<ArrayBuffer>,
) {
  const dec = new TextDecoder();
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    ciphertext,
  );

  return dec.decode(plaintext);
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export async function decryptBackup(file: File) {
  const dataFileExists = await exists(`E:/rokningar-backup/${file.name}`);
  if (!dataFileExists) {
    console.log("File not found!");
    return;
  }

  const backupFile = await readTextFile(`E:/rokningar-backup/${file.name}`);
  const backupFileJson = JSON.parse(backupFile);

  console.log(backupFileJson);
  // decrypt ciphertext
  const key = await createAesKey(
    encryptionPassword,
    base64ToBytes(backupFileJson.salt),
  );
  console.log(key);
  const decryptedBackupFile = await aesDecrypt(
    base64ToBytes(backupFileJson.ciphertext),
    key,
    base64ToBytes(backupFileJson.iv),
  );

  return decryptedBackupFile;
}

let backupRunning = false;
const createBackup = async () => {
  if (backupRunning) {
    console.log("Backup already running");
    return true;
  }
  backupRunning = true;

  try {
    // create empty data.json file in AppData/Rokningar, if it doesn't exist
    const pathExists = await exists("E:/rokningar-backup/");
    if (!pathExists) {
      console.log("Could not find E:/rokningar-backup/");
      return false;
    }

    // read data here because it is used later to save
    const dataString = await readTextFile("data.json", {
      baseDir: BaseDirectory.AppData,
    });

    const entries = await readDir("E:/rokningar-backup/");
    console.log(entries);

    if (entries.length > 0) {
      // get newest file in backup directory
      let newestFileName = "";
      let newestFileTime = 0;
      for (const file of entries) {
        const metadata = await stat(`E:/rokningar-backup/${file.name}`);
        let fileTime = metadata.birthtime?.getTime();
        if (fileTime && fileTime > newestFileTime) {
          newestFileTime = fileTime;
          newestFileName = file.name;
        }
      }
      console.log(newestFileName);

      // compare lastest backup with current data
      const latestBackupDataFile = await readTextFile(
        `E:/rokningar-backup/${newestFileName}`,
      );
      const latestBackupDataFileJson = JSON.parse(latestBackupDataFile);

      console.log(latestBackupDataFileJson);
      // decrypt ciphertext
      const key = await createAesKey(
        encryptionPassword,
        base64ToBytes(latestBackupDataFileJson.salt),
      );
      console.log(key);
      const decryptedLatestFile = await aesDecrypt(
        base64ToBytes(latestBackupDataFileJson.ciphertext),
        key,
        base64ToBytes(latestBackupDataFileJson.iv),
      );

      if (decryptedLatestFile === dataString) {
        console.log("Nothing has changed since last backup!");
        return false;
      }
    }

    var createdDate = new Date();
    var dd = String(createdDate.getDate()).padStart(2, "0");
    var mm = String(createdDate.getMonth() + 1).padStart(2, "0"); //January is 0!
    var yyyy = createdDate.getFullYear();
    var tt = createdDate.getTime();

    const encryptedContents = await aesEncrypt(dataString);
    console.log(encryptedContents);
    const backupFileContents = {
      salt: bytesToBase64(encryptedContents.salt),
      iv: bytesToBase64(encryptedContents.iv),
      ciphertext: bytesToBase64(new Uint8Array(encryptedContents.ciphertext)),
    };
    await writeTextFile(
      `E:/rokningar-backup/rokningar-backup-${dd + "-" + mm + "-" + yyyy + "-" + tt}.json`,
      JSON.stringify(backupFileContents, null, 2),
    );

    return false;
  } finally {
    backupRunning = false;
  }
};

function Backup() {
  const MINUTE_MS = 60000 * 10; // 10 minutes

  useEffect(() => {
    // Close window code from AI overview
    let unlisten: () => void;

    async function setupCloseListener() {
      // Get the current window instance
      const currentWindow = getCurrentWindow(); // Tauri v2 syntax

      // Intercept the close request
      unlisten = await currentWindow.onCloseRequested(async (event) => {
        // 1. Prevent the window from closing instantly
        event.preventDefault();

        let duplicateBackup;
        try {
          // 2. Run your custom cleanup function here
          console.log("Running app close cleanup logic...");
          duplicateBackup = await createBackup();
        } catch (error) {
          console.error("Cleanup failed:", error);
        } finally {
          if (duplicateBackup) {
            return;
          }
          // 3. Unregister listener to avoid infinite intercept loops
          if (unlisten) unlisten();

          // 4. Manually close the window/app
          await currentWindow.close();
        }
      });
    }
    setupCloseListener();
    const interval = setInterval(() => {
      createBackup();
    }, MINUTE_MS);

    return () => {
      clearInterval(interval);
      if (unlisten) unlisten();
    }; // This represents the unmount function, in which you need to clear your interval to prevent memory leaks.
  }, []);
  return <></>;
}

export default Backup;
