import { PrismaClient } from "@prisma/client";
import { SeedMediaAsset } from "../types";

export async function importMediaAssets(prisma: PrismaClient, assets: SeedMediaAsset[]) {
  const mediaByKey = new Map<string, string>();
  for (const asset of assets) {
    const created = await prisma.mediaAsset.create({
      data: {
        assetType: asset.assetType,
        url: asset.url,
        mimeType: asset.mimeType ?? null,
        altText: asset.altText ?? null,
        width: asset.width ?? null,
        height: asset.height ?? null
      }
    });
    mediaByKey.set(asset.key, created.id);
  }
  return mediaByKey;
}
