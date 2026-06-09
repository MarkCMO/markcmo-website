// In-app purchase wrapper (Section 13B). One non-consumable unlock.
// NOTE: react-native-iap is version-sensitive and only runs in a real build (EAS dev
// build or store build), not Expo Go. The free tier works without any of this; if a
// call shape differs in your installed version, adjust here only.
import { Platform } from "react-native";
import * as IAP from "react-native-iap";

export const UNLOCK_SKU = "petchores.unlock.full";

export async function initIAP(): Promise<void> {
  try { await IAP.initConnection(); } catch {}
}

export async function endIAP(): Promise<void> {
  try { await IAP.endConnection(); } catch {}
}

export async function fetchUnlockPrice(): Promise<string> {
  try {
    const products = await IAP.getProducts({ skus: [UNLOCK_SKU] });
    return products[0]?.localizedPrice ?? "$4.99";
  } catch {
    return "$4.99";
  }
}

export async function buyUnlock(): Promise<void> {
  if (Platform.OS === "ios") {
    await IAP.requestPurchase({ sku: UNLOCK_SKU });
  } else {
    await IAP.requestPurchase({ skus: [UNLOCK_SKU] });
  }
}

export async function hasUnlock(): Promise<boolean> {
  try {
    const purchases = await IAP.getAvailablePurchases();
    return purchases.some((p) => p.productId === UNLOCK_SKU);
  } catch {
    return false;
  }
}

export function addPurchaseListeners(onUnlocked: () => void): () => void {
  const update = IAP.purchaseUpdatedListener(async (purchase) => {
    if (purchase.productId === UNLOCK_SKU) {
      try { await IAP.finishTransaction({ purchase, isConsumable: false }); } catch {}
      onUnlocked();
    }
  });
  const error = IAP.purchaseErrorListener(() => {});
  return () => { update.remove(); error.remove(); };
}
