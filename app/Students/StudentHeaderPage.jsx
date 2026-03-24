import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import AntDesign from "@expo/vector-icons/AntDesign";
import { Image as ExpoImage } from "expo-image";
import { Colors } from "../../constants/Colors";
import { heightPercentageToDP as hp } from "react-native-responsive-screen";
import { useTheme } from "../../components/ThemeContext";

export default function StudentHeaderPage({ title, imgUrl }) {
  const router = useRouter();
  const [avatarLoading, setAvatarLoading] = useState(false);
  const { primaryColor } = useTheme();

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.btnBack, { backgroundColor: primaryColor }]}
      >
        <AntDesign name="caret-left" size={24} color="black" />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.btnStudentAvatar}>
        {imgUrl ? (
          <>
            <ExpoImage
              source={{ uri: imgUrl }}
              style={styles.studentAvatarImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoadStart={() => setAvatarLoading(true)}
              onLoadEnd={() => setAvatarLoading(false)}
            />
            {avatarLoading && (
              <ActivityIndicator
                size="small"
                color={primaryColor}
                style={styles.avatarLoadingIndicator}
              />
            )}
          </>
        ) : (
          <AntDesign name="user" size={22} color="#fff" />
        )}
      </View>
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
  title: {
    fontSize: 25,
    fontWeight: "600",
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
  btnStudentAvatar: {
    right: 10,
    position: "absolute",
    width: hp(4.8),
    height: hp(4.8),
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 99,
    overflow: "hidden",
  },
  studentAvatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarLoadingIndicator: {
    position: "absolute",
  },
});
