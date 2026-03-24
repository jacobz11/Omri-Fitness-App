import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "../../constants/Colors";
import { widthPercentageToDP as wp } from "react-native-responsive-screen";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuthContext } from "../AuthContext";
import { useTheme } from "../ThemeContext";

export default function MenuList({ router }) {
  const { isAdmin, isDemoMode, demoViewAsAdmin, toggleDemoView } =
    useAuthContext();
  const { primaryColor } = useTheme();

  const menuAdmin = [
    {
      id: 1,
      name: strings.studentsList,
      nameLogo: "users",
      color: primaryColor,
      path: "/Students/StudentsList",
    },
    {
      id: 2,
      name: strings.trainingsArchive,
      nameLogo: "archive",
      color: primaryColor,
      path: "/TrainingsArchive/ArchiveList",
    },
    {
      id: 3,
      name: strings.createTraining,
      nameLogo: "plus-circle",
      color: primaryColor,
      path: "/Students/StudentTrainingComponents/StudentTraining",
    },
  ];
  const menuUser = [
    {
      id: 1,
      name: strings.studentTraining,
      nameLogo: "fitness-center",
      color: primaryColor,
      path: "/Students/StudentTrainingComponents/StudentTrainingsList",
    },
    {
      id: 2,
      name: strings.studentSchedule,
      nameLogo: "calendar-month",
      color: primaryColor,
      path: "/Students/StudentTrainingComponents/StudentTrainingsSchedule",
    },
    {
      id: 3,
      name: strings.graph,
      nameLogo: "bar-chart",
      color: primaryColor,
      path: "/Students/StudentTrainingComponents/StudentGraphs",
    },
  ];

  const onMenuClick = (item) => {
    router.push(item.path);
  };

  return (
    <View>
      {isDemoMode && (
        <View style={styles.demoToggleContainer}>
          <Text style={styles.demoToggleLabel}>{strings.demoViewLabel}</Text>
          <View style={styles.toggleButtons}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                demoViewAsAdmin && styles.toggleButtonActive,
              ]}
              onPress={() => !demoViewAsAdmin && toggleDemoView()}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  demoViewAsAdmin && styles.toggleButtonTextActive,
                ]}
              >
                {strings.adminView}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                !demoViewAsAdmin && styles.toggleButtonActive,
              ]}
              onPress={() => demoViewAsAdmin && toggleDemoView()}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  !demoViewAsAdmin && styles.toggleButtonTextActive,
                ]}
              >
                {strings.userView}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {isAdmin ? (
        <View style={styles.flatCont}>
          <FlatList
            data={menuAdmin}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeInDown.duration(400)
                  .delay(index * 200)
                  .springify()
                  .damping(50)}
              >
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => onMenuClick(item)}
                >
                  <Text style={styles.menuTxt}>{item.name}</Text>
                  <FontAwesome
                    name={item.nameLogo}
                    size={20}
                    color={item.color}
                  />
                </TouchableOpacity>
              </Animated.View>
            )}
          />
        </View>
      ) : (
        <View style={styles.flatCont}>
          <FlatList
            data={menuUser}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeInDown.duration(400)
                  .delay(500 + index * 200)
                  .springify()
                  .damping(50)}
              >
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => onMenuClick(item)}
                >
                  <Text style={styles.menuTxt}>{item.name}</Text>
                  <MaterialIcons
                    name={item.nameLogo}
                    size={20}
                    color={item.color}
                  />
                </TouchableOpacity>
              </Animated.View>
            )}
          />
        </View>
      )}
    </View>
  );
}

const strings = {
  studentsList: "המתאמנים שלי",
  trainingsArchive: "ארכיון אימונים",
  createTraining: "יצירת אימונים",
  studentTraining: "האימונים שלי",
  studentSchedule: "יומן אימונים",
  graph: "ההתקדמות שלי",
  demoViewLabel: "Demo View:",
  adminView: "Admin",
  userView: "User",
};

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    margin: 8,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: Colors.light.border,
    minWidth: wp(40),
    maxWidth: wp(80),
  },
  flatCont: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  menuTxt: {
    fontSize: 19,
    lineHeight: 20,
    fontWeight: "600",
  },
  demoToggleContainer: {
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: "#f0f9ff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  demoToggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0369a1",
    marginBottom: 10,
  },
  toggleButtons: {
    flexDirection: "row",
    gap: 10,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  toggleButtonActive: {
    backgroundColor: Colors.PRIMARY,
    borderColor: Colors.PRIMARY,
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  toggleButtonTextActive: {
    color: "#fff",
  },
});
