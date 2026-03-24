import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
} from "react-native";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useState } from "react";
import { Image } from "expo-image";
import { useTheme } from "./ThemeContext";
import { useAuthContext } from "./AuthContext";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Toast from "react-native-toast-message";

export default function BodyPartCard({ item, index, router }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const { primaryColor } = useTheme();
  const { isAdmin } = useAuthContext();

  const handlePress = () => {
    if (!isAdmin) return;
    router.push({
      pathname: "/Exercises",
      params: {
        id: item.id,
        bodyPart: item.bodyPart,
      },
    });
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(400)
        .delay(index * 200)
        .springify()
        .damping(50)}
    >
      <TouchableOpacity
        onPress={handlePress}
        index={index}
        style={[styles.size, styles.btn]}
      >
        {!imageLoaded && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        )}
        <Image
          source={{ uri: item?.imgUrl }}
          contentFit="cover"
          style={[styles.size, styles.img, !imageLoaded && styles.hidden]}
          onLoadEnd={() => setImageLoaded(true)}
        />
        {imageLoaded && (
          <>
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.9)"]}
              style={styles.sizeLine}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
            <Text style={styles.txt}>{item?.bodyPart}</Text>
          </>
        )}
        {!isAdmin && (
          <TouchableOpacity
            style={styles.lockOverlay}
            activeOpacity={0.8}
            onPress={() =>
              Toast.show({
                type: "error",
                text1: strings.accessDenied,
                visibilityTime: 2000,
                topOffset: 60,
              })
            }
          >
            <MaterialIcons name="lock" size={55} color="#333" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const strings = {
  accessDenied: "הגישה נדחתה",
};

const styles = StyleSheet.create({
  size: {
    width: wp(46),
    height: wp(52),
  },
  sizeLine: {
    width: wp(46),
    height: hp(15),
    position: "absolute",
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  btn: {
    display: "flex",
    justifyContent: "flex-end",
    margin: 5,
  },
  loaderContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 35,
  },
  hidden: {
    opacity: 0,
  },
  img: {
    borderRadius: 35,
    position: "absolute",
  },
  txt: {
    fontSize: hp(2.5),
    textAlign: "center",
    fontWeight: "700",
    letterSpacing: 1,
    color: "#fff",
    marginBottom: 4,
  },
  lockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
});
