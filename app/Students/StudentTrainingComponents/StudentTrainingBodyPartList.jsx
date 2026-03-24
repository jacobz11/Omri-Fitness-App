import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { useTheme } from "../../../components/ThemeContext";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { useState, useEffect } from "react";
import StudentTrainingBodyPartCard from "./StudentTrainingBodyPartCard";
import StudentTrainingCard from "./StudentTrainingCard";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function StudentTrainingBodyPartList({
  bodyParts = [],
  onCardPress,
  initialTrainingName = "",
  onTrainingNameChange,
  initialTrainingSets = 1,
  onTrainingSetsChange,
  existingExercises = [],
  userId,
  trainingKey,
  onToggleInTraining,
}) {
  const [trainingName, setTrainingName] = useState(initialTrainingName);
  const [trainingSets, setTrainingSets] = useState(initialTrainingSets);
  const [showExisting, setShowExisting] = useState(true);
  const { primaryColor } = useTheme();

  // Update training name when prop changes
  useEffect(() => {
    setTrainingName(initialTrainingName);
  }, [initialTrainingName]);

  // Update training sets when prop changes
  useEffect(() => {
    setTrainingSets(initialTrainingSets);
  }, [initialTrainingSets]);

  const handleTrainingNameChange = (newName) => {
    setTrainingName(newName);
    // Notify parent component of the change
    if (onTrainingNameChange) {
      onTrainingNameChange(newName);
    }
  };

  const handleTrainingSetsChange = (value) => {
    // Only allow numeric input
    const numericValue = value.replace(/[^0-9]/g, "");

    // Allow empty string for deletion, otherwise parse the number
    if (numericValue === "") {
      setTrainingSets("");
      // Notify parent with 1 as default when empty
      if (onTrainingSetsChange) {
        onTrainingSetsChange(1);
      }
    } else {
      const setsNumber = parseInt(numericValue);
      setTrainingSets(setsNumber);
      if (onTrainingSetsChange) {
        onTrainingSetsChange(setsNumber);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Body Part Cards List — inputs and existing exercises are in the header so everything scrolls together */}
      <FlatList
        data={bodyParts}
        ListHeaderComponent={
          <>
            {/* Training Name Input */}
            <View style={styles.headerContainer}>
              <Text style={styles.headerLabel}>{strings.trainingName}</Text>
              <TextInput
                style={styles.input}
                placeholder={strings.enterTrainingName}
                placeholderTextColor={Colors.GRAY}
                value={trainingName}
                onChangeText={handleTrainingNameChange}
              />
            </View>

            {/* Training Sets Input */}
            <View style={styles.headerContainer}>
              <Text style={styles.headerLabel}>{strings.trainingSets}</Text>
              <TextInput
                style={styles.setsInput}
                placeholder="1"
                placeholderTextColor={Colors.GRAY}
                value={String(trainingSets)}
                onChangeText={handleTrainingSetsChange}
                keyboardType="numeric"
              />
            </View>

            {/* Already chosen exercises rendered as cards */}
            {existingExercises.length > 0 && (
              <>
                <TouchableOpacity
                  style={[
                    styles.existingToggleHeader,
                    { backgroundColor: primaryColor },
                  ]}
                  onPress={() => setShowExisting((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={
                      showExisting ? "keyboard-arrow-up" : "keyboard-arrow-down"
                    }
                    size={22}
                    color="#fff"
                  />
                  <Text style={styles.existingToggleText}>
                    {strings.exercisesInTraining} ({existingExercises.length})
                  </Text>
                </TouchableOpacity>

                {showExisting &&
                  existingExercises.map((ex, idx) => {
                    const isInSet = ex.setId !== null && ex.setId !== undefined;
                    const isFirstInSet =
                      isInSet &&
                      existingExercises.find((e) => e.setId === ex.setId)
                        ?.id === ex.id;
                    const exercisesInSet = isInSet
                      ? existingExercises.filter((e) => e.setId === ex.setId)
                      : [];
                    const isLastInSet =
                      isInSet &&
                      exercisesInSet[exercisesInSet.length - 1]?.id === ex.id;

                    return (
                      <View key={ex.id || idx}>
                        {isFirstInSet && (
                          <View
                            style={[
                              styles.setHeader,
                              { backgroundColor: primaryColor },
                            ]}
                          >
                            <Text style={styles.setHeaderText}>
                              {ex.setType}
                              {ex.setReps && (
                                <Text style={styles.setRepsText}>
                                  {" "}
                                  - {ex.setReps} {strings.setsLabel}
                                </Text>
                              )}
                            </Text>
                          </View>
                        )}
                        <View
                          style={[
                            isInSet && {
                              ...styles.setExerciseWrapper,
                              borderColor: primaryColor,
                            },
                            isFirstInSet && styles.setExerciseFirst,
                            isLastInSet && styles.setExerciseLast,
                          ]}
                        >
                          <StudentTrainingCard
                            item={ex}
                            drag={() => {}}
                            isActive={false}
                            getIndex={() => idx}
                            selectionMode={false}
                            isSelected={false}
                            isInSet={isInSet}
                            onPress={() => {}}
                            userId={userId}
                            trainingKey={trainingKey}
                            onDataUpdate={() => {}}
                            isCreatingMode={true}
                            isInTraining={true}
                            onToggleInTraining={() =>
                              onToggleInTraining && onToggleInTraining(ex)
                            }
                          />
                        </View>
                      </View>
                    );
                  })}
              </>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <StudentTrainingBodyPartCard
            item={item}
            index={index}
            onCardPress={() => onCardPress && onCardPress(item, trainingName)}
          />
        )}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const strings = {
  trainingName: "שם האימון",
  enterTrainingName: "הכנס שם לאימון...",
  trainingSets: "מספר סטים של אימון",
  exercisesInTraining: "תרגילים באימון הנוכחי",
  setsLabel: "סטים",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingBottom: hp(0.5),
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: wp(2),
  },
  headerLabel: {
    fontSize: wp(4),
    fontWeight: "600",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: wp(2),
    fontSize: wp(4),
    backgroundColor: "#fff",
  },
  setsInput: {
    width: wp(20),
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: wp(2),
    fontSize: wp(4),
    backgroundColor: "#fff",
    textAlign: "center",
  },
  listContainer: {
    paddingTop: hp(1),
    paddingBottom: hp(2),
  },
  existingToggleHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    paddingVertical: hp(0.9),
    paddingHorizontal: wp(3),
    marginBottom: hp(1),
  },
  existingToggleText: {
    fontSize: wp(3.8),
    fontWeight: "700",
    color: "#fff",
    flex: 1,
    textAlign: "right",
  },
  setHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    marginTop: 8,
  },
  setHeaderText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  setRepsText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
    opacity: 0.9,
  },
  setExerciseWrapper: {
    marginLeft: 5,
    marginRight: 5,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    backgroundColor: "#f0f9ff",
    paddingTop: 4,
    minHeight: 60,
  },
  setExerciseFirst: {
    marginTop: 0,
  },
  setExerciseLast: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomWidth: 3,
    marginBottom: 8,
    paddingBottom: 4,
  },
});
