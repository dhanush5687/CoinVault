import { BackHandler } from "react-native";

export const fakeBack = (navigation) => {
  if (navigation && navigation.canGoBack()) {
    navigation.goBack();
  } else {
    // fallback (Android)
    BackHandler.exitApp();
  }
};
