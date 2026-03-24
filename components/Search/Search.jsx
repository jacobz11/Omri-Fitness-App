import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import SearchCard from "./SearchCard";
import { useState, useEffect } from "react";
import { Ionicons, AntDesign } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { useAuthContext } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";

export default function Search({
  bodyPartsList,
  loading,
  refreshing,
  onRefresh,
  router,
  BodyPartCard,
  selectedExercises,
  setSelectedExercises,
  onSearchChange,
  onAddBodyPart,
  renderSearchItem,
  numColumns = 2,
  listContentContainerStyle,
  searchPlaceholder,
  searchMarginHorizontal = 8,
}) {
  const { isAdmin } = useAuthContext();
  const { primaryColor } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredExercises, setFilteredExercises] = useState([]);
  const iconOpacity = useSharedValue(1);
  const closeOpacity = useSharedValue(0);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredExercises([]);
      iconOpacity.value = withTiming(1, { duration: 200 });
      closeOpacity.value = withTiming(0, { duration: 200 });
      if (onSearchChange) onSearchChange(false);
      return;
    }

    iconOpacity.value = withTiming(0, { duration: 350 });
    closeOpacity.value = withTiming(1, { duration: 350 });

    const results = [];
    const lowerQuery = searchQuery.toLowerCase();
    bodyPartsList.forEach((bodyPart) => {
      if (bodyPart.exercises && Array.isArray(bodyPart.exercises)) {
        // Check if body part name matches the search query
        const bodyPartMatches =
          bodyPart.bodyPart &&
          bodyPart.bodyPart.toLowerCase().includes(lowerQuery);

        bodyPart.exercises.forEach((exercise, originalIndex) => {
          // Include exercise if either exercise name or body part name matches
          if (
            (exercise.name &&
              exercise.name.toLowerCase().includes(lowerQuery)) ||
            bodyPartMatches
          ) {
            results.push({
              ...exercise,
              bodyPartName: bodyPart.bodyPart,
              bodyPartId: bodyPart.id,
              originalIndex: originalIndex,
            });
          }
        });
      }
    });
    setFilteredExercises(results);
    if (onSearchChange) onSearchChange(true);
  }, [searchQuery, bodyPartsList, iconOpacity, closeOpacity]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchIconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    position: "absolute",
  }));

  const closeIconStyle = useAnimatedStyle(() => ({
    opacity: closeOpacity.value,
    position: "absolute",
  }));

  const isSearching = searchQuery.trim() !== "";

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.searchContainer,
          { marginHorizontal: searchMarginHorizontal },
        ]}
      >
        <View style={styles.iconContainer}>
          <Animated.View style={searchIconStyle}>
            <Ionicons name="search" size={24} color={primaryColor} />
          </Animated.View>
          <Animated.View style={closeIconStyle}>
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-outline" size={24} color={primaryColor} />
            </Pressable>
          </Animated.View>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder ?? strings.searchPlaceholder}
          placeholderTextColor={Colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      {isSearching ? (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => `${item.bodyPartId}-${item.originalIndex}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            listContentContainerStyle ?? styles.resultsListStudent
          }
          renderItem={({ item }) =>
            renderSearchItem ? (
              renderSearchItem(item, item.originalIndex)
            ) : (
              <SearchCard exercise={item} index={item.originalIndex} />
            )
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{strings.noExercisesFound}</Text>
            </View>
          }
        />
      ) : loading ? (
        <ActivityIndicator
          size={"large"}
          color={primaryColor}
          style={styles.load}
        />
      ) : bodyPartsList.length > 0 && BodyPartCard ? (
        <FlatList
          key={`bodyPartsList-${numColumns}columns`}
          data={bodyPartsList}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={listContentContainerStyle ?? styles.flat}
          {...(numColumns > 1 ? { columnWrapperStyle: styles.flat2 } : {})}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing || false}
                onRefresh={onRefresh}
                colors={[primaryColor]}
                tintColor={primaryColor}
              />
            ) : undefined
          }
          renderItem={({ item, index }) => (
            <BodyPartCard
              item={item}
              index={index}
              router={router}
              selectedExercises={selectedExercises}
              setSelectedExercises={setSelectedExercises}
            />
          )}
          ListFooterComponent={
            isAdmin && onAddBodyPart ? (
              <Animated.View
                entering={FadeInDown.duration(400)
                  .delay(bodyPartsList.length * 200)
                  .springify()
                  .damping(50)}
                style={styles.addButtonWrapper}
              >
                <TouchableOpacity
                  style={[
                    styles.addBodyPartButton,
                    { borderColor: primaryColor },
                  ]}
                  onPress={onAddBodyPart}
                >
                  <AntDesign name="plus" size={hp(5)} color={primaryColor} />
                  <Text
                    style={[styles.addBodyPartText, { color: primaryColor }]}
                  >
                    {strings.addBodyPart}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ) : null
          }
        />
      ) : (
        <View style={styles.emptyCont}>
          <Text style={styles.emptyTxt}>{strings.noExercises}</Text>
        </View>
      )}
    </View>
  );
}

const strings = {
  searchPlaceholder: "חפש תרגילים...",
  noExercisesFound: "לא נמצאו תרגילים",
  noExercises: "אין תכנית אימונים להצגה",
  addBodyPart: "הוסף איזור גוף",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  resultsListStudent: {
    paddingHorizontal: 0,
    paddingBottom: 60,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginVertical: 8,
    height: 56,
    borderWidth: 1,
    borderColor: Colors.light?.border || "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 26,
    height: 26,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    textAlign: "right",
    color: "#111827",
    paddingVertical: 6,
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
  },
  flat: {
    paddingBottom: 80,
    paddingTop: 10,
  },
  flat2: {
    justifyContent: "space-between",
  },
  load: {
    marginTop: 20,
  },
  emptyCont: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "30%",
  },
  emptyTxt: {
    fontSize: 25,
    fontWeight: "700",
    color: "#404040",
  },
  addButtonWrapper: {
    width: wp(46),
    margin: 5,
    marginTop: 0,
  },
  addBodyPartButton: {
    width: wp(46),
    height: wp(52),
    borderRadius: 35,
    borderWidth: 2,
    borderColor: Colors.PRIMARY,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  addBodyPartText: {
    marginTop: 8,
    fontSize: hp(2),
    color: Colors.PRIMARY,
    fontWeight: "600",
  },
});
