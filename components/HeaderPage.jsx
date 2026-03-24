import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { Colors } from "../constants/Colors";
import { useRouter } from "expo-router";
import { heightPercentageToDP as hp } from "react-native-responsive-screen";
import { useTheme } from "./ThemeContext";

export default function HeaderPage({ title }) {
  const router = useRouter();
  const handleBackButton = () => {
    router.back();
  };
  const { primaryColor } = useTheme();
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={handleBackButton}
        style={[styles.btnBack, { backgroundColor: primaryColor }]}
      >
        <AntDesign name="caret-left" size={24} color="black" />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 10,
  },
  btnBack: {
    left: 10,
    position: "absolute",
    backgroundColor: Colors.PRIMARY,
    width: hp(4.8),
    height: hp(4.8),
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 99,
  },
  title: {
    fontSize: 25,
    fontWeight: "600",
  },
});
