import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from "react-native";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Image } from "expo-image";
import { useTheme } from "./ThemeContext";

export default function ExerciseCard({ item, router, bodyPartId }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const { primaryColor } = useTheme();

  const thumbnailUrl = item?.youtubeThumbnail;

  return (
    <View>
      <View style={styles.btn}>
        <View style={styles.container}>
          {!imageLoaded && thumbnailUrl && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          )}
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={[styles.img, !imageLoaded && styles.hidden]}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoadStart={() => setImageLoaded(false)}
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <Image
              source={require("../assets/images/logo.png")}
              style={styles.img}
              contentFit="contain"
            />
          )}
          {(imageLoaded || !thumbnailUrl) && (
            <>
              <LinearGradient
                colors={["rgba(0,0,0,0)", "rgba(0,0,0,1)"]}
                style={styles.sizeLine}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
              <Text style={styles.txt} ellipsizeMode="tail" numberOfLines={1}>
                {item?.name}
              </Text>
            </>
          )}
          {/* Clickable overlay on top */}
          <TouchableOpacity
            style={styles.clickableOverlay}
            onPress={() =>
              router.push({
                pathname: "/ExerciseDetails",
                params: {
                  ...item,
                  bodyPartId: bodyPartId,
                  exerciseName: item.name,
                },
              })
            }
            activeOpacity={0.7}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginBottom: 13,
  },
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: wp(44),
    backgroundColor: "#fff",
    borderRadius: 20,
  },
  loaderContainer: {
    position: "absolute",
    width: wp(44),
    height: wp(50),
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    zIndex: 1,
  },
  hidden: {
    opacity: 0,
  },
  img: {
    width: wp(44),
    height: wp(50),
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    overflow: "hidden",
  },
  sizeLine: {
    width: "100%",
    height: hp(7),
    position: "absolute",
    bottom: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
  },
  txt: {
    position: "absolute",
    fontSize: hp(1.75),
    fontWeight: "600",
    bottom: 3,
    paddingHorizontal: 12,
    color: "#fff",
  },
  clickableOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
});
