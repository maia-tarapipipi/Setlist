import {
  $,
  dateKeyFromHistory,
  escapeHtml,
  formatDateKey,
  isFutureDate,
  localDateKey,
} from "./utils.js";

export function createRenderer(getState) {
  function completedHistoryExercises(entry) {
    return (entry.exercises || [])
      .map((exercise) => ({
        ...exercise,
        sets: (exercise.sets || []).filter((set) => set.done),
      }))
      .filter((exercise) => exercise.sets.length);
  }

  function renderAll() {
    const state = getState();
    renderWorkout();
    renderLibrary();
    renderHistory();
    $("templateTitle").textContent =
      state.templateName || "No favourite workout saved";
    $("templateDescription").textContent = state.templateDescription || "";
  }
  function renderWorkout() {
    const state = getState();
    const root = $("exerciseList");
    root.innerHTML = "";
    if (!state.workout.length) {
      root.innerHTML =
        '<div class="panel empty">No exercises yet. Add a movement to get started.</div>';
    }
    state.workout.forEach((ex, ei) => {
      const done = ex.setsData.filter((s) => s.done).length;
      const card = document.createElement("section");
      card.className = "exercise";
      card.draggable = true;
      card.dataset.dragIndex = ei;
      card.innerHTML = `<div class="ex-head"><button class="drag-handle ghost" data-action="drag" aria-label="Drag to reorder">⠿</button><div class="ex-title"><h3>${escapeHtml(ex.name)}</h3><div class="ex-sub">${escapeHtml(ex.category)} · ${done}/${ex.setsData.length} sets${ex.perSide ? " · each side" : ""}</div></div><button class="icon-btn" data-action="more" data-i="${ei}" title="Exercise settings">···</button></div>
    <div class="set-head"><span>Set</span><span class="set-column">Weight (kg)</span><span class="set-column">${ex.unit === "sec" ? "Seconds" : "Reps"}</span><span class="set-column">✓</span></div>
    <div class="sets">${ex.setsData.map((s, si) => `<div class="set-row ${s.done ? "done" : ""}"><span class="setnum">${si + 1}</span><input type="number" min="0" step="${ex.unit === "sec" ? 5 : 0.5}" value="${s.weight}" aria-label="Set ${si + 1} weight" data-field="weight" data-i="${ei}" data-s="${si}"><input type="number" min="1" step="1" value="${s.reps}" aria-label="Set ${si + 1} ${ex.unit === "sec" ? "seconds" : "reps"}" data-field="reps" data-i="${ei}" data-s="${si}"><input class="donebox" type="checkbox" aria-label="Set ${si + 1} complete" data-field="done" data-i="${ei}" data-s="${si}" ${s.done ? "checked" : ""}></div>`).join("")}</div>`;
      root.appendChild(card);
    });
    const all = state.workout.reduce((n, e) => n + e.setsData.length, 0);
    $("exerciseCount").textContent = state.workout.length;
    $("setCount").textContent = all;
    $("sessionDate").textContent = formatDateKey(state.workoutDate);
    $("finishBtn").textContent = isFutureDate(state.workoutDate)
      ? "Save plan"
      : "Finish session";
    $("workoutDatePicker").value = state.workoutDate;
  }
  function renderLibrary() {
    const state = getState();
    let query = $("searchExercise").value.toLowerCase(),
      filter = $("libraryFilter").value;
    let list = state.library.filter(
      (e) =>
        (e.name.toLowerCase().includes(query) ||
          e.category.toLowerCase().includes(query)) &&
        (filter === "all" || e.category === filter),
    );
    $("libraryList").innerHTML =
      list
        .map(
          (e) =>
            `<div class="library-item" data-library-exercise="${escapeHtml(e.id)}"><div class="info"><b>${escapeHtml(e.name)}</b><span class="tiny">${escapeHtml(e.category)} · ${e.sets} × ${e.reps}${e.unit === "sec" ? " sec" : " reps"}</span></div><button class="small primary" data-lib-action="add" data-id="${escapeHtml(e.id)}">Add</button></div>`,
        )
        .join("") || '<div class="empty">No exercises match that search.</div>';
  }
  function renderHistory() {
    const state = getState();
    let sets = state.history.reduce(
        (total, entry) =>
          total +
          completedHistoryExercises(entry).reduce(
            (exerciseTotal, exercise) => exerciseTotal + exercise.sets.length,
            0,
          ),
        0,
      ),
      exes = state.history.reduce(
        (total, entry) => total + completedHistoryExercises(entry).length,
        0,
      );
    $("historySessions").textContent = state.history.length;
    $("historySets").textContent = sets;
    $("historyExercises").textContent = exes;
    const historyHtml = [...state.history]
      .map((h, index) => ({ h, index }))
      .reverse()
      .map(({ h, index }) => {
        const exercises = completedHistoryExercises(h);
        const completedSets = exercises.reduce(
          (total, exercise) => total + exercise.sets.length,
          0,
        );
        return `<button class="history-card history-card-button" data-history-entry="${index}"><span class="history-summary"><span><b>${escapeHtml(h.date || formatDateKey(dateKeyFromHistory(h)))}</b><span class="tiny">${exercises.length} exercises · ${completedSets} sets completed</span></span><span class="history-card-action">View</span></span></button>`;
      })
      .join("");
    const plannedHtml = Object.entries(state.plannedWorkouts || {})
      .filter(([date]) => date >= localDateKey())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([date, plan]) =>
          `<article class="history-card"><div class="history-summary"><div><b>${escapeHtml(formatDateKey(date))}<span class="planned-label">Planned</span></b><div class="tiny">${(plan.exercises || []).length} exercises</div></div><div class="history-actions"><button class="small" data-load-plan="${escapeHtml(date)}">Open</button><button class="small danger" data-delete-plan="${escapeHtml(date)}">Delete</button></div></div></article>`,
      )
      .join("");
    $("historyList").innerHTML =
      (plannedHtml ? `<h3>Upcoming plans</h3>${plannedHtml}` : "") +
      (historyHtml ||
        (plannedHtml
          ? ""
          : '<div class="empty">Finish a workout or select a future date to plan one.</div>'));
  }

  return { renderAll, renderWorkout, renderLibrary, renderHistory };
}
