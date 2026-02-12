// // // import RNFS from "react-native-fs";
// // // import { encryptText, decryptText } from "./encryption";

// // // const VAULT_PATH = `${RNFS.DocumentDirectoryPath}/.vault`;

// // // export const initVault = async () => {
// // //   const exists = await RNFS.exists(VAULT_PATH);
// // //   if (!exists) {
// // //     await RNFS.mkdir(VAULT_PATH);
// // //   }
// // // };

// // // export const hideFile = async (filePath) => {
// // //   try {
// // //     await initVault();
// // //     const fileName = filePath.split("/").pop();
// // //     const encryptedName = encryptText(fileName).replace(/\//g, "_");

// // //     const newPath = `${VAULT_PATH}/${encryptedName}.dat`;
// // //     await RNFS.moveFile(filePath, newPath);

// // //     return {
// // //       success: true,
// // //       hiddenPath: newPath,
// // //     };
// // //   } catch (e) {
// // //     console.log("Hide error:", e);
// // //     return { success: false };
// // //   }
// // // };

// // // export const restoreFile = async (hiddenPath, originalDir) => {
// // //   try {
// // //     const encryptedName = hiddenPath.split("/").pop().replace(".dat", "");
// // //     const originalName = decryptText(encryptedName.replace(/_/g, "/"));

// // //     const restorePath = `${originalDir}/${originalName}`;
// // //     await RNFS.moveFile(hiddenPath, restorePath);

// // //     return {
// // //       success: true,
// // //       restorePath,
// // //     };
// // //   } catch (e) {
// // //     console.log("Restore error:", e);
// // //     return { success: false };
// // //   }
// // // };

// // // export const listHiddenFiles = async () => {
// // //   try {
// // //     const files = await RNFS.readDir(VAULT_PATH);
// // //     return files;
// // //   } catch {
// // //     return [];
// // //   }
// // // };

// // import RNFS from "react-native-fs";
// // import { encryptText, decryptText } from "./encryption";

// // const VAULT_PATH = `${RNFS.DocumentDirectoryPath}/.vault`;

// // export const initVault = async () => {
// //   const exists = await RNFS.exists(VAULT_PATH);
// //   if (!exists) await RNFS.mkdir(VAULT_PATH);
// // };

// // export const hideFile = async (uri) => {
// //   try {
// //     await initVault();

// //     // Generate encrypted file name
// //     const originalName = Date.now().toString();
// //     const encryptedName = encryptText(originalName).replace(/\//g, "_");

// //     const destPath = `${VAULT_PATH}/${encryptedName}.dat`;

// //     // Copy instead of move (important for Android 10+)
// //     await RNFS.copyFile(uri, destPath);

// //     return { success: true, hiddenPath: destPath };
// //   } catch (e) {
// //     console.log("Hide file error:", e);
// //     return { success: false };
// //   }
// // };

// // export const restoreFile = async (hiddenPath, restoreDir) => {
// //   try {
// //     const exists = await RNFS.exists(hiddenPath);
// //     if (!exists) return { success: false };

// //     const restorePath = `${restoreDir}/${Date.now()}.jpg`;
// //     await RNFS.copyFile(hiddenPath, restorePath);
// //     await RNFS.unlink(hiddenPath);

// //     return { success: true, restorePath };
// //   } catch (e) {
// //     console.log("Restore error:", e);
// //     return { success: false };
// //   }
// // };

// // export const listHiddenFiles = async () => {
// //   try {
// //     await initVault();
// //     return await RNFS.readDir(VAULT_PATH);
// //   } catch {
// //     return [];
// //   }
// // };

// import RNFS from "react-native-fs";

// const VAULT_PATH = `${RNFS.DocumentDirectoryPath}/.vault`;

// export const initVault = async () => {
//   const exists = await RNFS.exists(VAULT_PATH);
//   if (!exists) {
//     await RNFS.mkdir(VAULT_PATH);
//   }
// };

// export const hideFile = async (uri) => {
//   try {
//     await initVault();

//     const fileName = `${Date.now()}.jpg`;
//     const destPath = `${VAULT_PATH}/${fileName}`;

//     // This is the important fix:
//     // RNFS.copyFile does NOT work with content://
//     // We must read file and write it manually
//     const base64Data = await RNFS.readFile(uri, "base64");
//     await RNFS.writeFile(destPath, base64Data, "base64");

//     return { success: true, hiddenPath: destPath };
//   } catch (e) {
//     console.log("Hide file error:", e);
//     return { success: false };
//   }
// };

// export const restoreFile = async (hiddenPath, restoreDir) => {
//   try {
//     const restorePath = `${restoreDir}/${Date.now()}.jpg`;

//     const base64Data = await RNFS.readFile(hiddenPath, "base64");
//     await RNFS.writeFile(restorePath, base64Data, "base64");

//     await RNFS.unlink(hiddenPath);

//     return { success: true, restorePath };
//   } catch (e) {
//     console.log("Restore file error:", e);
//     return { success: false };
//   }
// };

// export const listHiddenFiles = async () => {
//   try {
//     await initVault();
//     return await RNFS.readDir(VAULT_PATH);
//   } catch {
//     return [];
//   }
// };

import RNFS from "react-native-fs";
import { PermissionsAndroid, Platform } from "react-native";

const VAULT_PATH = `${RNFS.DocumentDirectoryPath}/.vault`;

export const initVault = async () => {
  const exists = await RNFS.exists(VAULT_PATH);
  if (!exists) await RNFS.mkdir(VAULT_PATH);
};

export const hideFile = async (uri) => {
  try {
    await initVault();

    const destPath = `${VAULT_PATH}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}.dat`;

    // Read content uri and write inside vault
    const base64Data = await RNFS.readFile(uri, "base64");
    await RNFS.writeFile(destPath, base64Data, "base64");

    // Delete original file → this removes from gallery
    try {
      await RNFS.unlink(uri);
    } catch (e) {
      console.log("Delete original failed (Android scoped storage):", e);
    }

    return { success: true, hiddenPath: destPath };
  } catch (e) {
    console.log("Hide error:", e);
    return { success: false };
  }
};

export const restoreFile = async (hiddenPath, restoreDir) => {
  try {
    const restorePath = `${restoreDir}/${Date.now()}.jpg`;

    const base64Data = await RNFS.readFile(hiddenPath, "base64");
    await RNFS.writeFile(restorePath, base64Data, "base64");

    await RNFS.unlink(hiddenPath);

    return { success: true, restorePath };
  } catch (e) {
    console.log("Restore error:", e);
    return { success: false };
  }
};

export const listHiddenFiles = async () => {
  try {
    await initVault();
    return await RNFS.readDir(VAULT_PATH);
  } catch {
    return [];
  }
};
