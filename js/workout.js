import { clone } from "./utils.js";

export function findLibraryExercise(library, id) {
  return library.find((exercise) => exercise.id === id);
}

export function createSetData(exercise, index, lastValues = {}) {
  const previousSet = lastValues[exercise.id]?.[index];
  return {
    weight: previousSet?.weight ?? exercise.weight,
    reps: previousSet?.reps ?? exercise.reps,
    done: false,
  };
}

export function createWorkoutExercise(exercise, lastValues = {}) {
  return {
    ...clone(exercise),
    setsData: Array.from({ length: exercise.sets }, (_, index) =>
      createSetData(exercise, index, lastValues),
    ),
  };
}

export function makeWorkout(library, ids, lastValues = {}) {
  return ids
    .map((id) => {
      const exercise = findLibraryExercise(library, id);
      return exercise ? createWorkoutExercise(exercise, lastValues) : null;
    })
    .filter(Boolean);
}

export function snapshotWorkout(workout) {
  return clone(workout);
}
