import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Colors } from "../../constants/Colors";
import {
  widthPercentageToDP as wp,
} from "react-native-responsive-screen";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useState } from "react";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../components/ThemeContext";

const parseDisplayDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.trim().split(" | ");
  if (parts.length === 2) {
    const dateParts = parts[0].split("/");
    const timeParts = parts[1].split(":");
    if (dateParts.length === 3 && timeParts.length === 2) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const year = parseInt(dateParts[2], 10);
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);
      return new Date(year, month, day, hour, minute);
    }
  }
  return null;
};

const parseEndDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day, 23, 59, 59);
  }
  return null;
};

const getTrainingStatus = (item) => {
  const now = new Date();

  // Not logged in over a month
  const lastLogin = parseDisplayDate(item?.createdAt);
  if (lastLogin) {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (lastLogin < thirtyDaysAgo) {
      return { label: strings.statusNotRelevant, color: "#000000" };
    }
  }

  const trainingProgram = item?.trainingProgram;
  const hasTrainings =
    item?.trainings && Object.keys(item.trainings).length > 0;

  // Training program ending in 2 weeks or less
  if (trainingProgram?.endDate) {
    const endDate = parseEndDate(trainingProgram.endDate);
    if (endDate) {
      const twoWeeksFromNow = new Date(now);
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      if (endDate >= now && endDate <= twoWeeksFromNow) {
        return { label: strings.statusEndingSoon, color: "#F97316" };
      }
    }
  }

  // Active training program with trainings
  if (trainingProgram && hasTrainings) {
    return { label: strings.statusActive, color: Colors.COMPLETED };
  }

  // No trainings at all
  return { label: strings.statusNoTraining, color: Colors.DELETED };
};

export default function StudentCard({ item, router, index }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = getTrainingStatus(item);
  const { primaryColor } = useTheme();

  const toggleDropdown = () => {
    setIsExpanded(!isExpanded);
  };

  const handleNavigateToTraining = () => {
    router.push({
      pathname: "/Students/StudentTrainingComponents/StudentTraining",
      params: item,
    });
  };

  const handleNavigateToProgress = () => {
    router.push({
      pathname: "/Students/StudentTrainingComponents/StudentGraphs",
      params: {
        ...item,
        id: item.id,
        studentName: item?.boarding?.fullName?.trim() || item?.name || "",
        isAdmin: "true",
      },
    });
  };
  const handleNavigateToTrainingList = () => {
    router.push({
      pathname: "/Students/StudentTrainingComponents/StudentTrainingsList",
      params: { item: JSON.stringify(item), isAdmin: "true" },
    });
  };

  const handleNavigateToSchedule = () => {
    router.push({
      pathname: "/Students/StudentTrainingComponents/StudentTrainingsSchedule",
      params: item,
    });
  };

  const handleNavigateToUserDetails = () => {
    router.push({
      pathname: "/Students/StudentBoardingDetails",
      params: {
        ...item,
        fullName: item?.boarding?.fullName || item?.name,
      },
    });
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(400)
        .delay(200 + index * 200)
        .springify()
        .damping(50)}
    >
      <TouchableOpacity
        onPress={toggleDropdown}
        style={[styles.container, isExpanded && styles.containerExpanded]}
        key={index}
      >
        <Image source={{ uri: item?.imgUrl }} style={styles.img} />
        <View style={styles.userInfo}>
          <View style={styles.nameDateCont}>
            <Text style={[styles.user, styles.userName]} numberOfLines={1}>
              {item?.boarding?.fullName?.trim() || item?.name}
            </Text>
            <Text style={styles.user}>
              {"("}
              {item?.createdAt}
              {")"}
            </Text>
          </View>
          <Text style={styles.user}>{item?.email}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
        </View>
        <AntDesign
          name={isExpanded ? "up" : "down"}
          size={20}
          color={primaryColor}
          style={styles.icon}
        />
      </TouchableOpacity>

      {isExpanded && (
        <Animated.View
          entering={FadeInUp.duration(300).springify().damping(50)}
          style={styles.dropdown}
        >
          <TouchableOpacity
            style={[styles.dropdownButton, styles.dropdownButtonFirst]}
            onPress={handleNavigateToUserDetails}
          >
            <Text style={styles.dropdownButtonText}>{strings.userDetails}</Text>
            <AntDesign name="user" size={22} color={primaryColor} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={handleNavigateToTraining}
          >
            <Text style={styles.dropdownButtonText}>{strings.training}</Text>
            <MaterialIcons name="assignment" size={22} color={primaryColor} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={handleNavigateToProgress}
          >
            <Text style={styles.dropdownButtonText}>{strings.progress}</Text>
            <MaterialIcons name="analytics" size={22} color={primaryColor} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={handleNavigateToTrainingList}
          >
            <Text style={styles.dropdownButtonText}>
              {strings.trainingShow}
            </Text>
            <MaterialIcons
              name="fitness-center"
              size={22}
              color={primaryColor}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dropdownButton, styles.dropdownButtonLast]}
            onPress={handleNavigateToSchedule}
          >
            <Text style={styles.dropdownButtonText}>{strings.schedule}</Text>
            <MaterialIcons
              name="calendar-month"
              size={22}
              color={primaryColor}
            />
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const strings = {
  training: "בניית תכנית אימונים",
  progress: "צפייה בהתקדמות",
  trainingShow: "צפייה באימונים",
  schedule: "יומן אימונים",
  userDetails: "פרטי מתאמן",
  statusActive: "מנוי פעיל",
  statusEndingSoon: "המנוי עומד להסתיים בקרוב",
  statusNoTraining: "מנוי ללא תכנית אימונים",
  statusNotRelevant: "מנוי לא פעיל",
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 15,
    padding: 10,
    gap: 8,
    backgroundColor: "#fff",
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  containerExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  img: {
    width: wp(12),
    height: wp(12),
    borderRadius: 50,
  },
  userInfo: {
    flex: 1,
  },
  user: {
    fontSize: 15,
    textAlign: "right",
  },
  userName: {
    fontWeight: "600",
  },
  statusBadge: {
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 2,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  nameDateCont: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 2,
    flexWrap: "wrap",
  },
  icon: {
    right: 5,
  },
  dropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.light.border,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 15,
    padding: 15,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSecondary,
  },
  dropdownButtonFirst: {
    borderTopWidth: 0,
  },
  dropdownButtonLast: {
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  dropdownButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#404040",
  },
});
