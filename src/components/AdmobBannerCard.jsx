import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
import { ADMOB_BANNER_ID } from "@env";

export default function AdmobBannerCard({
  style,
  asCard = true,
  size = BannerAdSize.ADAPTIVE_BANNER,
}) {
  const [useFallback, setUseFallback] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);

  // If live unit fails (403/no-fill), fallback to Google Test Banner ID
  const bannerUnitId =
    useFallback || !ADMOB_BANNER_ID || __DEV__
      ? TestIds.BANNER
      : (ADMOB_BANNER_ID || "ca-app-pub-2490251867268823/5116361111");

  return (
    <View style={asCard ? [styles.adCard, style] : [styles.bannerWrap, style]}>
      {asCard && (
        <View style={styles.adHeader}>
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>Ad • Sponsored</Text>
          </View>
        </View>
      )}

      <View style={styles.bannerContainer}>
        <BannerAd
          unitId={bannerUnitId}
          size={size}
          requestOptions={{
            requestNonPersonalizedAdsOnly: false,
          }}
          onAdLoaded={() => {
            setAdLoaded(true);
          }}
          onAdFailedToLoad={(error) => {
            console.log("❌ AdMob: Banner Load Error:", error.message);
            if (!useFallback && bannerUnitId !== TestIds.BANNER) {
              console.log("🔄 AdMob: Switching Banner to Google Test Unit...");
              setUseFallback(true);
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  adCard: {
    backgroundColor: "#111827",
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
  },
  bannerWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  adHeader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  adBadge: {
    backgroundColor: "#facc1522",
    borderColor: "#facc15",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adBadgeText: {
    color: "#facc15",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  bannerContainer: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 8,
    width: "100%",
  },
});

