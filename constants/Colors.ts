/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    border: "#E0E0E0",
    borderSecondary: "#f0f0f0",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
  },
  PRIMARY: "#0cc0df", //"#fb6f92" //"#5371ff", //#f43f5e
  PRIMARY_FEMALE: "#ff7096",
  COMPLETED: "#40916c",
  SECONDARY: "#008000", //#40916c
  DELETED: "#F44336",
  placeholder: "#464646",
  GRAY: "#808080",
};
