import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  FlatList,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { Colors } from "../../constants/Colors";
import { FontAwesome } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

const socialData = [
  {
    id: 1,
    name: "WhatsApp",
    icon: require("../../assets/images/whatsapp.png"),
    url: "https://wa.me/+972556833855",
  },
  {
    id: 2,
    name: "Instagram",
    icon: require("../../assets/images/instagram.png"),
    url: "https://instagram.com/omriyoseff",
  },
  {
    id: 3,
    name: "Facebook",
    icon: require("../../assets/images/facebook.png"),
    url: "https://www.facebook.com/wmryywsp",
  },
  {
    id: 4,
    name: "TikTok",
    icon: require("../../assets/images/tik-tok.png"),
    url: "https://tiktok.com/@omriyosef0",
  },
];

const aboutData = [
  {
    id: 1,
    text: "מאמן כושר מקצועי עם 3 שנות ניסיון בתחום האימונים האישיים והקבוצתיים.",
  },
  {
    id: 2,
    text: "מתמחה בבניית תוכניות אימון מותאמות אישית ומלווה את המתאמנים בכל שלב לקראת השגת המטרות.",
  },
  {
    id: 3,
    text: "עם גישה מקצועית ומחויבות מלאה, התוצאות מובטחות!",
  },
];

export default function Info() {
  const openLink = (url) => {
    Linking.openURL(url);
  };

  const renderAboutItem = ({ item, index }) => (
    <Animated.View
      entering={FadeInDown.delay((index + 3) * 100)
        .duration(400)
        .springify()}
      style={styles.aboutItem}
    >
      <Text style={styles.aboutText}>{item.text}</Text>
      <FontAwesome name="check" size={20} color="#4CAF50" />
    </Animated.View>
  );

  const renderSocialButton = ({ item, index }) => (
    <Animated.View
      entering={FadeInDown.delay((index + 6) * 100)
        .duration(400)
        .springify()}
      style={{ flex: 1 }}
    >
      <TouchableOpacity
        style={styles.socialButton}
        onPress={() => openLink(item.url)}
      >
        <Image source={item.icon} style={styles.socialIcon} />
        <Text style={styles.buttonText}>{item.name}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <ScrollView
      style={styles.mainContainer}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <Animated.Text
          entering={FadeInDown.delay(0).duration(400).springify()}
          style={styles.title}
        >
          אודות המאמן
        </Animated.Text>

        <Animated.View
          entering={FadeInDown.delay(100).duration(400).springify()}
          style={styles.logoContainer}
        >
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
          />
        </Animated.View>

        <View style={styles.infoSection}>
          <Animated.Text
            entering={FadeInDown.delay(200).duration(400).springify()}
            style={styles.trainerName}
          >
            עומרי יוסף
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(250).duration(400).springify()}
            style={styles.age}
          >
            גיל: 22
          </Animated.Text>

          <FlatList
            data={aboutData}
            renderItem={renderAboutItem}
            keyExtractor={(item) => item.id.toString()}
            style={styles.aboutSection}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.contactSection}>
          <Animated.Text
            entering={FadeInDown.delay(600).duration(400).springify()}
            style={styles.contactTitle}
          >
            צור/י קשר
          </Animated.Text>

          <FlatList
            data={socialData}
            renderItem={renderSocialButton}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            columnWrapperStyle={styles.buttonRow}
            scrollEnabled={false}
          />
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(2),
  },
  container: {
    flex: 1,
    padding: wp(5),
  },
  title: {
    fontSize: hp(3.5),
    fontWeight: "bold",
    marginBottom: hp(3),
    textAlign: "center",
    color: "#1a1a1a",
  },
  logoContainer: {
    alignSelf: "center",
    width: hp(15),
    height: hp(15),
    borderRadius: hp(15) / 2,
    overflow: "hidden",
    marginBottom: hp(3),
  },
  logo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  infoSection: {
    alignItems: "center",
    marginBottom: hp(4),
  },
  trainerName: {
    fontSize: hp(3),
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: hp(1),
  },
  age: {
    fontSize: hp(2),
    color: "#666",
    marginBottom: hp(2),
  },
  aboutSection: {
    width: "100%",
    paddingHorizontal: wp(3),
  },
  aboutItem: {
    flexDirection: "row",
    marginBottom: hp(1.5),
    gap: 10,
  },
  aboutText: {
    flex: 1,
    fontSize: hp(1.9),
    color: "#404040",
    textAlign: "right",
    lineHeight: hp(2.8),
  },
  contactSection: {
    marginTop: hp(2),
  },
  contactTitle: {
    fontSize: hp(2.5),
    fontWeight: "700",
    textAlign: "center",
    marginBottom: hp(2),
    color: "#1a1a1a",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: hp(2),
    gap: wp(3),
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: "#fff",
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(4),
    borderRadius: 15,
    gap: 10,
  },
  socialIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },
  buttonText: {
    fontSize: hp(1.8),
    fontWeight: "600",
  },
});
