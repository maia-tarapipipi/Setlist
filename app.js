/* Setlist workout tracker entry point. */
import {
  DEFAULT_EXERCISES,
  DEFAULT_TEMPLATE_DESCRIPTION,
  DEFAULT_TEMPLATE_IDS,
  DEFAULT_TEMPLATE_NAME,
  EXERCISE_CATEGORIES,
  STORAGE_KEY,
} from "./js/config.js";
import {
  $,
  clone,
  dateFromKey,
  dateKeyFromHistory,
  escapeHtml,
  formatDateKey,
  isFutureDate,
  localDateKey,
} from "./js/utils.js";
import {
  createWorkoutExercise,
  findLibraryExercise,
  makeWorkout,
  snapshotWorkout,
} from "./js/workout.js";
import { createTimerController } from "./js/timer.js";
import { createRenderer } from "./js/render.js";
// Persistent application state. New fields have defaults for older saved versions.
function createInitialState() {
  return {
    library: DEFAULT_EXERCISES.map((exercise) => ({ ...exercise })),
    workout: [],
    history: [],
    templateIds: [...DEFAULT_TEMPLATE_IDS],
    templates: [],
    lastValues: {},
    notes: "",
    templateName: DEFAULT_TEMPLATE_NAME,
    templateDescription: DEFAULT_TEMPLATE_DESCRIPTION,
    workoutDate: localDateKey(),
    drafts: {},
    plannedWorkouts: {},
  };
}

let state = createInitialState();
const renderer = createRenderer(() => state);
const { renderAll, renderHistory, renderLibrary, renderWorkout } = renderer;
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Setlist data could not be saved.", error);
    toast("Could not save on this browser. Export a backup.");
  }
}
function saveCurrentDraft() {
  state.drafts = state.drafts || {};
  state.drafts[state.workoutDate] = {
    workout: snapshotWorkout(state.workout),
    notes: $("sessionNotes").value || "",
  };
  state.notes = $("sessionNotes").value || "";
  save();
}
function loadDateWorkout(key) {
  state.workoutDate = key;
  const draft = state.drafts?.[key];
  const plan = state.plannedWorkouts?.[key];
  if (draft) {
    state.workout = clone(draft.workout || []);
    state.notes = draft.notes || "";
  } else if (plan) {
    state.workout = (plan.exercises || []).map((e) => ({
      ...clone(e),
      setsData: clone(e.sets || e.setsData || []),
    }));
    state.notes = plan.notes || "";
  } else {
    state.workout = makeWorkout(
      state.library,
      state.templateIds,
      state.lastValues,
    );
    state.notes = "";
  }
  $("workoutDatePicker").value = key;
  $("sessionNotes").value = state.notes;
  renderAll();
  save();
}
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.library && saved.workout) {
      state = { ...state, ...saved };
    }
  } catch (error) {
    console.warn("Setlist data could not be loaded.", error);
    toast("Saved data could not be loaded.");
  }
  state.drafts = state.drafts || {};
  state.plannedWorkouts = state.plannedWorkouts || {};
  state.lastValues = state.lastValues || {};
  state.history = state.history || [];
  state.templateIds = state.templateIds || [...DEFAULT_TEMPLATE_IDS];
  state.workoutDate = state.workoutDate || localDateKey();
  if (!state.workout.length)
    state.workout = makeWorkout(
      state.library,
      state.templateIds,
      state.lastValues,
    );
  $("workoutDatePicker").value = state.workoutDate;
  $("sessionNotes").value = state.notes || "";
  renderAll();
}
function toast(msg) {
  let el = $("toast");
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.style.display = "none"), 2200);
}
function renderTimer({ remaining, total, active }) {
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  $("timerRead").textContent = `${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
  $("timerProgress").style.width = `${
    total ? Math.max(0, Math.min(100, (1 - remaining / total) * 100)) : 0
  }%`;
  $("timerToggle").textContent = active ? "Pause" : "Start";
}

const timerController = createTimerController({
  onUpdate: renderTimer,
  onComplete: () => {
    if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
    toast("Timer complete");
  },
});
// Rendering functions keep the UI derived from `state`.
function openModal(title, body) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = body;
  $("modalBack").classList.add("open");
}
function closeModal() {
  $("modalBack").classList.remove("open");
}
function addExercise(id) {
  const exercise = findLibraryExercise(id);
  if (!exercise) return;
  state.workout.push(createWorkoutExercise(exercise, state.lastValues));
  saveCurrentDraft();
  renderAll();
  toast(`${exercise.name} added`);
  switchPage("workout");
}
function switchPage(page) {
  document
    .querySelectorAll(".tab")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  $(page + "Page").classList.add("active");
  document.querySelector(".tabs").style.display =
    page === "templateEditor" || page === "historyEditor" ? "none" : "grid";
  if (page === "library") renderLibrary();
  if (page === "history") renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function saveTemplate() {
  if (!state.workout.length) {
    toast("Add an exercise first");
    return;
  }
  const name = prompt(
    "Name your favourite workout",
    state.templateName || "My workout plan",
  );
  if (name === null) return;
  if (!name.trim()) {
    toast("Enter a name for this workout");
    return;
  }
  state.templateName = name.trim();
  state.templateDescription = "";
  state.templateIds = state.workout.map((ex) => ex.id);
  saveCurrentDraft();
  renderAll();
  toast("Favourite workout saved");
}
// Session actions and history editing.
function finishSession() {
  if (!state.workout.length) {
    toast("Add an exercise first");
    return;
  }
  const exercises = state.workout.map((ex) => ({
    id: ex.id,
    name: ex.name,
    sets: ex.setsData.map((set) => ({ ...set })),
    category: ex.category,
    unit: ex.unit,
  }));
  const totalSets = exercises.reduce((total, ex) => total + ex.sets.length, 0);
  const completedSets = exercises.reduce(
    (total, ex) => total + ex.sets.filter((set) => set.done).length,
    0,
  );
  const dateKey = state.workoutDate;
  if (isFutureDate(dateKey)) {
    if (!confirm(`Save this workout plan for ${formatDateKey(dateKey)}?`))
      return;
    state.plannedWorkouts = state.plannedWorkouts || {};
    state.plannedWorkouts[dateKey] = {
      dateKey,
      exercises,
      notes: $("sessionNotes").value || "",
    };
    state.drafts[dateKey] = {
      workout: snapshotWorkout(state.workout),
      notes: $("sessionNotes").value || "",
    };
    save();
    renderAll();
    switchPage("history");
    toast("Workout plan saved");
    return;
  }
  if (
    !confirm(
      `Save this session? ${completedSets} of ${totalSets} sets completed.`,
    )
  )
    return;
  exercises.forEach(
    (ex) =>
      (state.lastValues[ex.id] = ex.sets.map((set) => ({
        weight: set.weight,
        reps: set.reps,
      }))),
  );
  state.history.push({
    date: formatDateKey(dateKey),
    dateKey,
    iso: dateFromKey(dateKey).toISOString(),
    exercises,
    completedSets,
    notes: $("sessionNotes").value || "",
  });
  delete state.plannedWorkouts?.[dateKey];
  delete state.drafts?.[dateKey];
  state.notes = "";
  $("sessionNotes").value = "";
  state.workout = state.workout.map((ex) => ({
    ...ex,
    setsData: ex.setsData.map((set) => ({ ...set, done: false })),
  }));
  save();
  renderAll();
  switchPage("history");
  toast("Workout saved to history");
}
function formatHistoryExercises(exercises) {
  return exercises
    .map(
      (exercise) =>
        `<section class="history-exercise"><div class="history-exercise-name">${escapeHtml(exercise.name)}</div>${(exercise.sets || []).map((set, setIndex) => `<div class="history-set-line">Set ${setIndex + 1}: ${escapeHtml(set.weight)} kg × ${escapeHtml(set.reps)}${exercise.unit === "sec" ? " sec" : " reps"}</div>`).join("")}</section>`,
    )
    .join("");
}

function openHistoryDetails(index) {
  const entry = state.history[index];
  if (!entry) return;
  const exercises = entry.exercises || [];
  const completedSets = entry.completedSets ?? 0;
  openModal(
    entry.date || formatDateKey(dateKeyFromHistory(entry)),
    `<div class="history-modal-summary"><span class="tiny">${exercises.length} exercises · ${completedSets} sets completed</span><div class="menu-wrap"><button class="small" id="historyMenuBtn" aria-label="Workout actions">···</button><div class="menu-pop" id="historyMenu" hidden><button id="editHistoryBtn">Edit workout</button><button id="deleteHistoryBtn" class="danger">Delete workout</button></div></div></div><div class="history-sets">${formatHistoryExercises(exercises)}</div>${entry.notes ? `<p class="tiny">Notes: ${escapeHtml(entry.notes)}</p>` : ""}`,
  );
  $("historyMenuBtn").onclick = () => {
    $("historyMenu").hidden = !$("historyMenu").hidden;
  };
  $("editHistoryBtn").onclick = () => {
    closeModal();
    openHistoryEditor(index);
  };
  $("deleteHistoryBtn").onclick = () => {
    if (!confirm("Delete this workout history entry?")) return;
    state.history.splice(index, 1);
    save();
    renderHistory();
    closeModal();
    toast("History entry deleted");
  };
}

function openHistoryEditor(index) {
  const entry = state.history[index];
  if (!entry) return;
  const exercises = entry.exercises || [];
  $("historyEditorBody").innerHTML =
    `<div class="panel"><div class="field"><label>Workout date</label><input id="historyEditDate" type="date" value="${escapeHtml(dateKeyFromHistory(entry))}"></div><div class="field"><label>Session notes</label><textarea id="historyEditNotes" rows="2">${escapeHtml(entry.notes || "")}</textarea></div></div>${exercises.map((ex, ei) => `<section class="panel"><div class="field"><label>Exercise name</label><input id="historyExName${ei}" value="${escapeHtml(ex.name)}"></div>${(ex.sets || []).map((set, si) => `<div class="field-grid history-edit-set"><div class="field"><label>Set ${si + 1} weight (kg)</label><input id="historyWeight${ei}_${si}" type="number" min="0" step="0.5" value="${escapeHtml(set.weight)}"></div><div class="field"><label>${ex.unit === "sec" ? "Seconds" : "Reps"}</label><input id="historyReps${ei}_${si}" type="number" min="0" step="1" value="${escapeHtml(set.reps)}"></div></div><label><input class="history-complete-checkbox" id="historyDone${ei}_${si}" type="checkbox" ${set.done ? "checked" : ""}> Set completed</label>`).join("")}</section>`).join("")}<button id="saveHistoryEdit" class="primary wide">Save changes</button>`;
  $("saveHistoryEdit").onclick = () => {
    const dateKey = $("historyEditDate").value || dateKeyFromHistory(entry);
    entry.dateKey = dateKey;
    entry.date = formatDateKey(dateKey);
    entry.iso = dateFromKey(dateKey).toISOString();
    entry.notes = $("historyEditNotes").value;
    entry.exercises.forEach((ex, ei) => {
      ex.name = $(`historyExName${ei}`).value.trim() || ex.name;
      ex.sets.forEach((set, si) => {
        set.weight = Math.max(
          0,
          Number($(`historyWeight${ei}_${si}`).value) || 0,
        );
        set.reps = Math.max(0, Number($(`historyReps${ei}_${si}`).value) || 0);
        set.done = $(`historyDone${ei}_${si}`).checked;
      });
    });
    entry.completedSets = entry.exercises.reduce(
      (total, ex) => total + ex.sets.filter((set) => set.done).length,
      0,
    );
    save();
    renderHistory();
    switchPage("history");
    toast("History entry updated");
  };
  switchPage("historyEditor");
}

function openLibraryExerciseEditor(id) {
  const exercise = findLibraryExercise(state.library, id);
  if (!exercise) return;
  openModal(
    exercise.name,
    `<div class="field"><label>Exercise name</label><input id="libraryEditName" value="${escapeHtml(exercise.name)}"></div><div class="field"><label>Category</label><select id="libraryEditCategory">${EXERCISE_CATEGORIES.map((category) => `<option ${exercise.category === category ? "selected" : ""}>${category}</option>`).join("")}</select></div><div class="field-grid"><div class="field"><label>Default sets</label><input id="libraryEditSets" type="number" min="1" max="15" value="${exercise.sets}"></div><div class="field"><label>Default reps</label><input id="libraryEditReps" type="number" min="1" value="${exercise.reps}"></div></div><div class="btnrow"><button id="saveLibraryExercise" class="primary">Save changes</button><button id="addLibraryExercise">Add to workout</button><button id="deleteLibraryExercise" class="danger">Delete exercise</button></div>`,
  );
  $("saveLibraryExercise").onclick = () => {
    exercise.name = $("libraryEditName").value.trim() || exercise.name;
    exercise.category = $("libraryEditCategory").value;
    exercise.sets = Math.max(
      1,
      Math.min(15, Number($("libraryEditSets").value) || 1),
    );
    exercise.reps = Math.max(1, Number($("libraryEditReps").value) || 1);
    save();
    renderAll();
    closeModal();
    toast("Exercise updated");
  };
  $("addLibraryExercise").onclick = () => {
    closeModal();
    addExercise(exercise.id);
  };
  $("deleteLibraryExercise").onclick = () => {
    if (!confirm(`Delete ${exercise.name} from your exercise catalogue?`)) {
      return;
    }
    state.library = state.library.filter((item) => item.id !== exercise.id);
    state.templateIds = state.templateIds.filter(
      (item) => item !== exercise.id,
    );
    state.workout = state.workout.filter((item) => item.id !== exercise.id);
    delete state.lastValues[exercise.id];
    save();
    renderAll();
    closeModal();
    toast("Exercise deleted");
  };
}

function newCustom() {
  openModal(
    "Create exercise",
    `<div class="field"><label>Exercise name</label><input id="customName" placeholder="e.g. Cable kickback"></div><div class="field"><label>Category</label><select id="customCategory">${EXERCISE_CATEGORIES.map((category) => `<option>${category}</option>`).join("")}</select></div><div class="field-grid"><div class="field"><label>Default sets</label><input id="customSets" type="number" min="1" max="10" value="3"></div><div class="field"><label>Default reps</label><input id="customReps" type="number" min="1" value="10"></div></div><button class="primary wide" id="createCustom">Create exercise</button>`,
  );
  $("createCustom").onclick = () => {
    let name = $("customName").value.trim();
    if (!name) {
      toast("Enter an exercise name");
      return;
    }
    let id = "custom-" + Date.now();
    state.library.push({
      id,
      name,
      category: $("customCategory").value,
      sets: Math.max(1, +$("customSets").value || 3),
      reps: Math.max(1, +$("customReps").value || 10),
      weight: 0,
      rest: 90,
      fav: false,
      custom: true,
    });
    saveCurrentDraft();
    renderAll();
    closeModal();
    toast("Exercise created");
    addExercise(id);
  };
}
$("exerciseList").addEventListener("input", (e) => {
  let t = e.target;
  if (!t.dataset.field) return;
  let ex = state.workout[+t.dataset.i],
    s = ex?.setsData[+t.dataset.s];
  if (!s) return;
  if (t.dataset.field === "done") {
    s.done = t.checked;
    t.closest(".set-row").classList.toggle("done", t.checked);
    saveCurrentDraft();
    renderWorkout();
    return;
  }
  s[t.dataset.field] = Math.max(0, +t.value || 0);
  state.lastValues[ex.id] = ex.setsData.map((x) => ({
    weight: x.weight,
    reps: x.reps,
  }));
  saveCurrentDraft();
});
$("exerciseList").addEventListener("click", (e) => {
  let b = e.target.closest("button[data-action]");
  if (!b) return;
  let i = +b.dataset.i,
    ex = state.workout[i];
  if (!ex && b.dataset.action !== "drag") return;
  if (b.dataset.action === "more") {
    openModal(
      ex.name,
      `<div class="field"><label>Exercise name</label><input id="editName" value="${escapeHtml(ex.name)}"></div>      <div class="field"><label>Category</label><select id="editCategory">${EXERCISE_CATEGORIES.map((category) => `<option ${ex.category === category ? "selected" : ""}>${category}</option>`).join("")}</select></div><div class="field-grid"><div class="field"><label>Sets</label><input id="editSets" type="number" min="1" max="15" value="${ex.setsData.length}"></div><div class="field"><label>Default reps</label><input id="editReps" type="number" min="1" value="${ex.reps}"></div></div><div class="btnrow"><button class="primary" id="applyEdit">Save settings</button><button class="danger" id="deleteExercise">Delete</button></div>`,
    );
    $("applyEdit").onclick = () => {
      ex.name = $("editName").value.trim() || ex.name;
      ex.category = $("editCategory").value;
      let n = Math.max(1, Math.min(15, +$("editSets").value || 1));
      while (ex.setsData.length < n)
        ex.setsData.push({
          weight: ex.setsData.at(-1)?.weight || 0,
          reps: +$("editReps").value || 10,
          done: false,
        });
      while (ex.setsData.length > n) ex.setsData.pop();
      ex.reps = +$("editReps").value || 10;
      let lib = state.library.find((x) => x.id === ex.id);
      if (lib)
        Object.assign(lib, {
          name: ex.name,
          category: ex.category,
          sets: n,
          reps: ex.reps,
        });
      saveCurrentDraft();
      renderAll();
      closeModal();
    };
    $("deleteExercise").onclick = () => {
      if (confirm(`Delete ${ex.name} from this workout?`)) {
        state.workout.splice(i, 1);
        saveCurrentDraft();
        renderAll();
        closeModal();
      }
    };
  }
});
$("libraryList").addEventListener("click", (e) => {
  const item = e.target.closest("[data-library-exercise]");
  if (!item) return;
  const addButton = e.target.closest("button[data-lib-action='add']");
  if (addButton) {
    addExercise(addButton.dataset.id);
    return;
  }
  openLibraryExerciseEditor(item.dataset.libraryExercise);
});
$("exerciseList").addEventListener("change", (e) => {
  if (e.target.dataset.field === "done") save();
});
document
  .querySelectorAll(".tab")
  .forEach((b) => (b.onclick = () => switchPage(b.dataset.page)));
$("addExerciseBtn").onclick = () => {
  switchPage("library");
  $("searchExercise").focus();
};
$("newExerciseBtn").onclick = newCustom;
$("searchExercise").oninput = renderLibrary;
$("libraryFilter").onchange = renderLibrary;
$("modalClose").onclick = closeModal;
$("modalBack").onclick = (e) => {
  if (e.target === $("modalBack")) closeModal();
};
$("timerToggle").onclick = timerController.toggle;
$("timerReset").onclick = () => timerController.set(90);
$("timerMinus").onclick = timerController.decrease;
$("timerPlus").onclick = timerController.increase;
$("finishBtn").onclick = finishSession;
$("saveTemplateBtn").onclick = saveTemplate;
function loadBaseTemplate() {
  state.workout = makeWorkout(
    state.library,
    state.templateIds,
    state.lastValues,
  );
  saveCurrentDraft();
  renderAll();
  switchPage("workout");
  toast("Favourite workout loaded");
}
$("sessionNotes").oninput = saveCurrentDraft;
$("workoutDatePicker").onchange = () => {
  const next = $("workoutDatePicker").value;
  if (!next) return;
  saveCurrentDraft();
  loadDateWorkout(next);
};
$("todayBtn").onclick = () => {
  saveCurrentDraft();
  loadDateWorkout(localDateKey());
};
$("cancelHistoryEdit").onclick = () => switchPage("history");
$("historyList").addEventListener("click", (e) => {
  const historyEntry = e.target.closest("[data-history-entry]");
  if (historyEntry) {
    openHistoryDetails(Number(historyEntry.dataset.historyEntry));
    return;
  }
  const loadPlan = e.target.closest("button[data-load-plan]");
  if (loadPlan) {
    saveCurrentDraft();
    loadDateWorkout(loadPlan.dataset.loadPlan);
    switchPage("workout");
    return;
  }
  const deletePlan = e.target.closest("button[data-delete-plan]");
  if (deletePlan) {
    const date = deletePlan.dataset.deletePlan;
    if (confirm(`Delete the planned workout for ${formatDateKey(date)}?`)) {
      delete state.plannedWorkouts[date];
      delete state.drafts[date];
      save();
      renderHistory();
      toast("Planned workout deleted");
    }
  }
});
$("clearHistory").onclick = () => {
  if (
    confirm(
      "Delete all workout history from this device? This cannot be undone unless you exported a backup.",
    )
  ) {
    state.history = [];
    save();
    renderHistory();
    toast("History cleared");
  }
};
$("exportBtn").onclick = () => {
  let blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download =
    "setlist-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup exported");
};
// Favourite template menu and editing
$("templateMenuBtn").onclick = () => {
  $("templateMenu").hidden = !$("templateMenu").hidden;
};
document.addEventListener("click", (e) => {
  if (e.target.closest(".menu-wrap")) return;
  $("templateMenu").hidden = true;
  const historyMenu = $("historyMenu");
  if (historyMenu) historyMenu.hidden = true;
});
$("editTemplateBtn").onclick = () => openTemplateEditor();
let editorSelectedIds = [];
let templateDragFrom = null;
let templatePointerDragFrom = null;
let templatePointerDragging = false;

function openTemplateEditor() {
  $("templateMenu").hidden = true;
  editorSelectedIds = [...(state.templateIds || [])];
  $("editorTemplateName").value = state.templateName || "";
  $("editorTemplateDescription").value = state.templateDescription || "";
  renderTemplateEditor();
  switchPage("templateEditor");
}

function renderTemplateEditor() {
  const exercises = editorSelectedIds
    .map((id) => findLibraryExercise(state.library, id))
    .filter(Boolean);
  $("templateEditorList").innerHTML =
    exercises
      .map(
        (exercise, index) =>
          `<div class="editor-exercise" draggable="true" data-template-index="${index}"><button class="drag-handle ghost" data-template-drag aria-label="Drag ${escapeHtml(exercise.name)} to reorder">⠿</button><div class="editor-name"><b>${escapeHtml(exercise.name)}</b><div class="tiny">${escapeHtml(exercise.category)}</div></div><button class="small danger remove-template-exercise" data-template-remove="${escapeHtml(exercise.id)}">Remove</button></div>`,
      )
      .join("") ||
    '<div class="empty">This favourite workout has no exercises yet.</div>';
}

function moveTemplateExercise(from, to) {
  if (from === to || from < 0 || to < 0) return;
  const [exerciseId] = editorSelectedIds.splice(from, 1);
  editorSelectedIds.splice(to, 0, exerciseId);
  renderTemplateEditor();
}

$("templateEditorList").addEventListener("click", (e) => {
  const button = e.target.closest("button[data-template-remove]");
  if (!button) return;
  editorSelectedIds = editorSelectedIds.filter(
    (id) => id !== button.dataset.templateRemove,
  );
  renderTemplateEditor();
});

$("templateEditorList").addEventListener("dragstart", (e) => {
  const handle = e.target.closest("[data-template-drag]");
  const exercise = e.target.closest(".editor-exercise");
  if (!handle || !exercise) {
    e.preventDefault();
    return;
  }
  templateDragFrom = Number(exercise.dataset.templateIndex);
  exercise.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(templateDragFrom));
});

$("templateEditorList").addEventListener("dragover", (e) => {
  const exercise = e.target.closest(".editor-exercise");
  if (!exercise) return;
  e.preventDefault();
  document
    .querySelectorAll(".editor-exercise.drop-target")
    .forEach((item) => item.classList.remove("drop-target"));
  exercise.classList.add("drop-target");
});

$("templateEditorList").addEventListener("drop", (e) => {
  const exercise = e.target.closest(".editor-exercise");
  if (!exercise || templateDragFrom === null) return;
  e.preventDefault();
  moveTemplateExercise(
    templateDragFrom,
    Number(exercise.dataset.templateIndex),
  );
  templateDragFrom = null;
});

$("templateEditorList").addEventListener("dragend", () => {
  templateDragFrom = null;
  document
    .querySelectorAll(".editor-exercise.dragging,.editor-exercise.drop-target")
    .forEach((item) => item.classList.remove("dragging", "drop-target"));
});

$("templateEditorList").addEventListener("pointerdown", (e) => {
  const handle = e.target.closest("[data-template-drag]");
  const exercise = handle?.closest(".editor-exercise");
  if (!exercise) return;
  templatePointerDragFrom = Number(exercise.dataset.templateIndex);
  templatePointerDragging = false;
  handle.setPointerCapture(e.pointerId);
});

$("templateEditorList").addEventListener("pointermove", (e) => {
  if (templatePointerDragFrom === null) return;
  const exercise = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest(".editor-exercise");
  if (!exercise) return;
  templatePointerDragging = true;
  document
    .querySelectorAll(".editor-exercise.drop-target")
    .forEach((item) => item.classList.remove("drop-target"));
  exercise.classList.add("drop-target");
});

$("templateEditorList").addEventListener("pointerup", (e) => {
  if (templatePointerDragFrom === null) return;
  const from = templatePointerDragFrom;
  templatePointerDragFrom = null;
  const exercise = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest(".editor-exercise");
  document
    .querySelectorAll(".editor-exercise.drop-target")
    .forEach((item) => item.classList.remove("drop-target"));
  if (templatePointerDragging && exercise) {
    moveTemplateExercise(from, Number(exercise.dataset.templateIndex));
  }
});

$("templateEditorList").addEventListener("pointercancel", () => {
  templatePointerDragFrom = null;
  document
    .querySelectorAll(".editor-exercise.drop-target")
    .forEach((item) => item.classList.remove("drop-target"));
});

$("saveTemplateEdits").onclick = () => {
  const name = $("editorTemplateName").value.trim();
  if (!name) {
    toast("Enter a workout name");
    return;
  }
  state.templateName = name;
  state.templateDescription = $("editorTemplateDescription").value.trim();
  state.templateIds = [...editorSelectedIds];
  save();
  renderAll();
  switchPage("workout");
  toast("Workout plan updated");
};
$("cancelTemplateEdit").onclick = () => switchPage("workout");
$("deleteTemplateBtn").onclick = () => {
  $("templateMenu").hidden = true;
  if (
    confirm(
      "Delete this favourite workout? Your current workout and history will remain.",
    )
  ) {
    state.templateName = "";
    state.templateDescription = "";
    state.templateIds = [];
    save();
    renderAll();
    toast("Favourite workout deleted");
  }
};
$("resetTemplateBtn").onclick = () => {
  $("templateMenu").hidden = true;
  if (confirm("Reload the current workout from your saved favourite workout?"))
    loadBaseTemplate();
};
// Drag-and-drop exercise ordering (drag the handle or card to reorder)
let dragFrom = null;
$("exerciseList").addEventListener("dragstart", (e) => {
  const card = e.target.closest(".exercise");
  if (!card) return;
  dragFrom = +card.dataset.dragIndex;
  card.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  try {
    e.dataTransfer.setData("text/plain", String(dragFrom));
  } catch (_) {}
});
$("exerciseList").addEventListener("dragover", (e) => {
  const card = e.target.closest(".exercise");
  if (!card) return;
  e.preventDefault();
  document
    .querySelectorAll(".exercise.drop-target")
    .forEach((x) => x.classList.remove("drop-target"));
  card.classList.add("drop-target");
});
$("exerciseList").addEventListener("drop", (e) => {
  const card = e.target.closest(".exercise");
  if (!card || dragFrom === null) return;
  e.preventDefault();
  const to = +card.dataset.dragIndex;
  const moved = state.workout.splice(dragFrom, 1)[0];
  state.workout.splice(to, 0, moved);
  dragFrom = null;
  saveCurrentDraft();
  renderWorkout();
});
$("exerciseList").addEventListener("dragend", () => {
  dragFrom = null;
  document
    .querySelectorAll(".exercise.dragging,.exercise.drop-target")
    .forEach((x) => x.classList.remove("dragging", "drop-target"));
});
let pointerDragFrom = null,
  pointerDragging = false;
$("exerciseList").addEventListener("pointerdown", (e) => {
  const handle = e.target.closest(".drag-handle");
  if (!handle) return;
  const card = handle.closest(".exercise");
  if (!card) return;
  pointerDragFrom = +card.dataset.dragIndex;
  pointerDragging = false;
  try {
    handle.setPointerCapture(e.pointerId);
  } catch (_) {}
});
$("exerciseList").addEventListener("pointermove", (e) => {
  if (pointerDragFrom === null) return;
  const card = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest(".exercise");
  if (!card) return;
  pointerDragging = true;
  document
    .querySelectorAll(".exercise.drop-target")
    .forEach((x) => x.classList.remove("drop-target"));
  card.classList.add("drop-target");
});
$("exerciseList").addEventListener("pointerup", (e) => {
  if (pointerDragFrom === null) return;
  const from = pointerDragFrom;
  pointerDragFrom = null;
  if (!pointerDragging) return;
  const card = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest(".exercise");
  document
    .querySelectorAll(".exercise.drop-target")
    .forEach((x) => x.classList.remove("drop-target"));
  if (!card) return;
  const to = +card.dataset.dragIndex;
  if (from === to) return;
  const moved = state.workout.splice(from, 1)[0];
  state.workout.splice(to, 0, moved);
  saveCurrentDraft();
  renderWorkout();
});
$("exerciseList").addEventListener("pointercancel", () => {
  pointerDragFrom = null;
  document
    .querySelectorAll(".exercise.drop-target")
    .forEach((x) => x.classList.remove("drop-target"));
});
load();
if (
  "serviceWorker" in navigator &&
  (location.protocol === "https:" || location.hostname === "localhost")
) {
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register("./sw.js")
      .catch((error) => console.warn("Setlist service worker failed.", error)),
  );
}
