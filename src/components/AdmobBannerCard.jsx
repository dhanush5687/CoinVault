import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { ADMOB_BANNER_ID } from "@env";

export default function AdmobBannerCard({
  style,
  asCard = true,
  size = BannerAdSize.ADAPTIVE_BANNER,
}) {
  const [adLoaded, setAdLoaded] = useState(false);

  // Strictly use Real Live AdMob Banner Unit ID
  const bannerUnitId = ADMOB_BANNER_ID || "ca-app-pub-2490251867268823/5116361111";

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
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  adCard: {
    backgroundColor: "#161b26",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginVertical: 10,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 5,
  },
  adHeader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 6,
    paddingHorizontal: 6,
  },
  adBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    color: "#9ca3af",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  bannerContainer: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
