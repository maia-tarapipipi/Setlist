/* Setlist workout tracker
 * Main sections: configuration/data, storage/date helpers, rendering, session actions,
 * history editing, favourite workout editor, and event bindings.
 * Keep KEY stable so existing device data remains available.
 */
// Configuration and default exercise catalogue.
const KEY = 'setlist-workout-v1';
const initialExercises = [
    { id: 'goblet-squat', name: 'Goblet squat', category: 'Lower body', sets: 3, reps: 10, weight: 0, rest: 120, fav: true },
    { id: 'rdl', name: 'Dumbbell Romanian deadlift', category: 'Lower body', sets: 3, reps: 10, weight: 0, rest: 120, fav: true },
    { id: 'db-bench', name: 'Dumbbell bench press', category: 'Upper body', sets: 3, reps: 10, weight: 0, rest: 120, fav: true },
    { id: 'assisted-pullup', name: 'Assisted pull-up', category: 'Upper body', sets: 3, reps: 8, weight: 0, rest: 120, fav: true, assist: true },
    { id: 'hip-thrust', name: 'Hip thrust', category: 'Lower body', sets: 3, reps: 10, weight: 0, rest: 120, fav: true },
    { id: 'cable-row', name: 'Seated cable row', category: 'Upper body', sets: 2, reps: 10, weight: 0, rest: 90, fav: true },
    { id: 'split-squat', name: 'Rear-foot-elevated split squat', category: 'Lower body', sets: 2, reps: 8, weight: 0, rest: 120, fav: true, perSide: true },
    { id: 'shoulder-press', name: 'Dumbbell shoulder press', category: 'Upper body', sets: 2, reps: 10, weight: 0, rest: 90, fav: true },
    { id: 'dead-bug', name: 'Dead bug', category: 'Core', sets: 2, reps: 10, weight: 0, rest: 60, fav: true, perSide: true },
    { id: 'lat-pulldown', name: 'Lat pulldown', category: 'Upper body', sets: 3, reps: 10, weight: 0, rest: 90, fav: false },
    { id: 'calf-raises', name: 'Calf raises', category: 'Lower body', sets: 2, reps: 15, weight: 0, rest: 60, fav: false },
    { id: 'hamstring-curl', name: 'Seated/lying hamstring curl', category: 'Lower body', sets: 2, reps: 12, weight: 0, rest: 60, fav: false },
    { id: 'lateral-raise', name: 'Lateral raises', category: 'Upper body', sets: 2, reps: 15, weight: 0, rest: 60, fav: false },
    { id: 'chest-supported-row', name: 'Chest-supported row', category: 'Upper body', sets: 3, reps: 10, weight: 0, rest: 90, fav: false },
    { id: 'farmer-carry', name: 'Farmer’s carry', category: 'Full body', sets: 3, reps: 30, weight: 0, rest: 90, fav: false, unit: 'sec' },
    { id: 'wood-chop', name: 'Cable wood chop', category: 'Core', sets: 2, reps: 10, weight: 0, rest: 60, fav: false, perSide: true },
    { id: 'face-pull', name: 'Face pull', category: 'Upper body', sets: 2, reps: 15, weight: 0, rest: 60, fav: false },
    { id: 'leg-press', name: 'Leg press', category: 'Lower body', sets: 3, reps: 10, weight: 0, rest: 120, fav: false },
    { id: 'incline-press', name: 'Incline dumbbell press', category: 'Upper body', sets: 3, reps: 10, weight: 0, rest: 90, fav: false },
    { id: 'back-extension', name: 'Back extension', category: 'Lower body', sets: 2, reps: 12, weight: 0, rest: 60, fav: false },
    { id: 'plank', name: 'Plank', category: 'Core', sets: 2, reps: 30, weight: 0, rest: 60, fav: false, unit: 'sec' },
    { id: 'custom', name: 'Custom exercise', category: 'Full body', sets: 3, reps: 10, weight: 0, rest: 90, fav: false, custom: true }
];
// Persistent application state. New fields have defaults for older saved versions.
let state = { library: initialExercises, workout: [], history: [], templateIds: ['goblet-squat', 'rdl', 'db-bench', 'assisted-pullup', 'hip-thrust', 'cable-row', 'split-squat', 'shoulder-press', 'dead-bug'], templates: [], lastValues: {}, notes: '', templateName: 'Full body · A', templateDescription: 'A balanced session built around squat, hinge, push, pull and core.', workoutDate: localDateKey(), drafts: {}, plannedWorkouts: {} };
let timer = { remaining: 90, total: 90, active: false, interval: null, endAt: 0 };
const $ = id => document.getElementById(id);
// Storage, date, and state helpers.
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    }
    catch (e) {
        toast('Could not save on this browser. Export a backup.');
    }
}
function localDateKey(date = new Date()) { const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function dateFromKey(key) { const [y, m, d] = String(key || localDateKey()).split('-').map(Number); return new Date(y, m - 1, d, 12); }
function formatDateKey(key) { return dateFromKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
function dateKeyFromHistory(entry) {
    if (entry.dateKey)
        return entry.dateKey;
    if (entry.iso) {
        const d = new Date(entry.iso);
        if (!Number.isNaN(d.getTime()))
            return localDateKey(d);
    }
    return localDateKey();
}
function isFutureDate(key) { return key > localDateKey(); }
function snapshotWorkout() { return clone(state.workout); }
function saveCurrentDraft() { state.drafts = state.drafts || {}; state.drafts[state.workoutDate] = { workout: snapshotWorkout(), notes: $('sessionNotes').value || '' }; state.notes = $('sessionNotes').value || ''; save(); }
function loadDateWorkout(key) {
    state.workoutDate = key;
    const draft = state.drafts?.[key];
    const plan = state.plannedWorkouts?.[key];
    if (draft) {
        state.workout = clone(draft.workout || []);
        state.notes = draft.notes || '';
    }
    else if (plan) {
        state.workout = (plan.exercises || []).map(e => ({ ...clone(e), setsData: clone(e.sets || e.setsData || []) }));
        state.notes = plan.notes || '';
    }
    else {
        state.workout = makeWorkout(state.templateIds);
        state.notes = '';
    }
    $('workoutDatePicker').value = key;
    $('sessionNotes').value = state.notes;
    renderAll();
    save();
}
function load() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY));
        if (saved && saved.library && saved.workout) {
            state = { ...state, ...saved };
        }
    }
    catch (e) { }
    state.drafts = state.drafts || {};
    state.plannedWorkouts = state.plannedWorkouts || {};
    state.workoutDate = state.workoutDate || localDateKey();
    if (!state.workout.length)
        state.workout = makeWorkout(state.templateIds);
    $('workoutDatePicker').value = state.workoutDate;
    $('sessionNotes').value = state.notes || '';
    renderAll();
}
function makeWorkout(ids) {
    return ids.map(id => {
        let ex = state.library.find(x => x.id === id);
        if (!ex)
            return null;
        let last = state.lastValues[id];
        return { ...clone(ex), setsData: Array.from({ length: ex.sets }, (_, i) => ({ weight: last?.[i]?.weight ?? ex.weight, reps: last?.[i]?.reps ?? ex.reps, done: false })) };
    }).filter(Boolean);
}
function toast(msg) { let el = $('toast'); el.textContent = msg; el.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => el.style.display = 'none', 2200); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmtDate(d = new Date()) { return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
// Rendering functions keep the UI derived from `state`.
function renderAll() { renderWorkout(); renderLibrary(); renderHistory(); $('templateTitle').textContent = state.templateName || 'No favourite workout saved'; $('templateDescription').textContent = state.templateDescription || ''; }
function renderWorkout() {
    const root = $('exerciseList');
    root.innerHTML = '';
    if (!state.workout.length) {
        root.innerHTML = '<div class="panel empty">No exercises yet. Add a movement to get started.</div>';
    }
    state.workout.forEach((ex, ei) => {
        const done = ex.setsData.filter(s => s.done).length;
        const card = document.createElement('section');
        card.className = 'exercise';
        card.draggable = true;
        card.dataset.dragIndex = ei;
        card.innerHTML = `<div class="ex-head"><button class="drag-handle ghost" data-action="drag" aria-label="Drag to reorder">⠿</button><div class="ex-title"><h3>${esc(ex.name)}</h3><div class="ex-sub">${esc(ex.category)} · ${done}/${ex.setsData.length} sets${ex.perSide ? ' · each side' : ''}</div></div><button class="icon-btn" data-action="more" data-i="${ei}" title="Exercise settings">···</button></div>
  <div class="set-head"><span>Set</span><span style="text-align:center">Weight (kg)</span><span style="text-align:center">${ex.unit === 'sec' ? 'Seconds' : 'Reps'}</span><span style="text-align:center">✓</span></div>
  <div class="sets">${ex.setsData.map((s, si) => `<div class="set-row ${s.done ? 'done' : ''}"><span class="setnum">${si + 1}</span><input type="number" min="0" step="${ex.unit === 'sec' ? 5 : 0.5}" value="${s.weight}" aria-label="Set ${si + 1} weight" data-field="weight" data-i="${ei}" data-s="${si}"><input type="number" min="1" step="1" value="${s.reps}" aria-label="Set ${si + 1} ${ex.unit === 'sec' ? 'seconds' : 'reps'}" data-field="reps" data-i="${ei}" data-s="${si}"><input class="donebox" type="checkbox" aria-label="Set ${si + 1} complete" data-field="done" data-i="${ei}" data-s="${si}" ${s.done ? 'checked' : ''}></div>`).join('')}</div>`;
        root.appendChild(card);
    });
    const all = state.workout.reduce((n, e) => n + e.setsData.length, 0);
    $('exerciseCount').textContent = state.workout.length;
    $('setCount').textContent = all;
    $('sessionDate').textContent = formatDateKey(state.workoutDate);
    $('finishBtn').textContent = isFutureDate(state.workoutDate) ? 'Save plan' : 'Finish session';
    $('workoutDatePicker').value = state.workoutDate;
}
function renderLibrary() {
    let query = $('searchExercise').value.toLowerCase(), filter = $('libraryFilter').value;
    let list = state.library.filter(e => (e.name.toLowerCase().includes(query) || e.category.toLowerCase().includes(query)) && (filter === 'all' || e.category === filter));
    $('libraryList').innerHTML = list.map(e => `<div class="library-item"><div class="info"><b>${esc(e.name)}</b><div class="tiny">${esc(e.category)} · ${e.sets} × ${e.reps}${e.unit === 'sec' ? ' sec' : ' reps'}</div></div><button class="small primary" data-lib-action="add" data-id="${esc(e.id)}">Add</button></div>`).join('') || '<div class="empty">No exercises match that search.</div>';
}
function renderHistory() {
    let sets = state.history.reduce((n, h) => n + h.exercises.reduce((m, e) => m + e.sets.length, 0), 0), exes = state.history.reduce((n, h) => n + h.exercises.length, 0);
    $('historySessions').textContent = state.history.length;
    $('historySets').textContent = sets;
    $('historyExercises').textContent = exes;
    const historyHtml = [...state.history].map((h, index) => ({ h, index })).reverse().map(({ h, index }) => `<article class="history-card"><div class="history-summary"><div><b>${esc(h.date || formatDateKey(dateKeyFromHistory(h)))}</b><div class="tiny">${(h.exercises || []).length} exercises · ${h.completedSets ?? 0} sets completed</div></div><div class="history-actions"><button class="small" data-history="${index}">Details</button><button class="small" data-edit-history="${index}">Edit</button><button class="small danger" data-delete-history="${index}">Delete</button></div></div><div class="history-detail" id="hist${index}"><div class="history-sets">${(h.exercises || []).map(ex => `<div class="history-exercise"><div class="history-exercise-name">${esc(ex.name)}</div>${(ex.sets || []).map((set, setIndex) => `<div class="history-set-line">Set ${setIndex + 1}: ${esc(set.weight)} kg × ${esc(set.reps)}${ex.unit === 'sec' ? ' sec' : ' reps'}</div>`).join('')}</div>`).join('')}</div>${h.notes ? `<p class="tiny">Notes: ${esc(h.notes)}</p>` : ''}</div></article>`).join('');
    const plannedHtml = Object.entries(state.plannedWorkouts || {}).filter(([date]) => date >= localDateKey()).sort(([a], [b]) => a.localeCompare(b)).map(([date, plan]) => `<article class="history-card"><div class="history-summary"><div><b>${esc(formatDateKey(date))}<span class="planned-label">Planned</span></b><div class="tiny">${(plan.exercises || []).length} exercises</div></div><div class="history-actions"><button class="small" data-load-plan="${esc(date)}">Open</button><button class="small danger" data-delete-plan="${esc(date)}">Delete</button></div></div></article>`).join('');
    $('historyList').innerHTML = (plannedHtml ? `<h3>Upcoming plans</h3>${plannedHtml}` : '') + (historyHtml || (plannedHtml ? '' : '<div class="empty">Finish a workout or select a future date to plan one.</div>'));
}
function openModal(title, body) { $('modalTitle').textContent = title; $('modalBody').innerHTML = body; $('modalBack').classList.add('open'); }
function closeModal() { $('modalBack').classList.remove('open'); }
function addExercise(id) {
    let ex = state.library.find(e => e.id === id);
    if (!ex)
        return;
    let last = state.lastValues[id];
    state.workout.push({ ...clone(ex), setsData: Array.from({ length: ex.sets }, (_, i) => ({ weight: last?.[i]?.weight ?? ex.weight, reps: last?.[i]?.reps ?? ex.reps, done: false })) });
    saveCurrentDraft();
    renderAll();
    toast(`${ex.name} added`);
    switchPage('workout');
}
function switchPage(page) {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    $(page + 'Page').classList.add('active');
    document.querySelector('.tabs').style.display = page === 'templateEditor' ? 'none' : 'grid';
    if (page === 'library')
        renderLibrary();
    if (page === 'history')
        renderHistory();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function timerDisplay() { let m = Math.floor(timer.remaining / 60), s = timer.remaining % 60; $('timerRead').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); $('timerProgress').style.width = (timer.total ? Math.max(0, Math.min(100, (1 - timer.remaining / timer.total) * 100)) : 0) + '%'; $('timerToggle').textContent = timer.active ? 'Pause' : 'Start'; }
function stopTimer() {
    timer.active = false;
    if (timer.interval)
        clearInterval(timer.interval);
    timer.interval = null;
    timerDisplay();
}
function startTimer(seconds) {
    stopTimer();
    timer.total = Math.max(0, seconds);
    timer.remaining = timer.total;
    if (!timer.remaining) {
        timerDisplay();
        return;
    }
    timer.active = true;
    timer.endAt = Date.now() + timer.remaining * 1000;
    timer.interval = setInterval(() => {
        timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
        if (timer.remaining <= 0) {
            stopTimer();
            if (navigator.vibrate)
                navigator.vibrate([180, 80, 180]);
            toast('Timer complete');
        }
        timerDisplay();
    }, 250);
    timerDisplay();
}
function setTimer(seconds) { stopTimer(); timer.total = Math.max(0, seconds); timer.remaining = timer.total; timerDisplay(); }
function saveTemplate() {
    if (!state.workout.length) {
        toast('Add an exercise first');
        return;
    }
    const name = prompt('Name your favourite workout', state.templateName || 'My workout plan');
    if (name === null)
        return;
    if (!name.trim()) {
        toast('Enter a name for this workout');
        return;
    }
    state.templateName = name.trim();
    state.templateDescription = '';
    state.templateIds = state.workout.map(ex => ex.id);
    saveCurrentDraft();
    renderAll();
    toast('Favourite workout saved');
}
// Session actions and history editing.
function finishSession() {
    if (!state.workout.length) {
        toast('Add an exercise first');
        return;
    }
    const exercises = state.workout.map(ex => ({ id: ex.id, name: ex.name, sets: ex.setsData.map(set => ({ ...set })), category: ex.category, unit: ex.unit }));
    const totalSets = exercises.reduce((total, ex) => total + ex.sets.length, 0);
    const completedSets = exercises.reduce((total, ex) => total + ex.sets.filter(set => set.done).length, 0);
    const dateKey = state.workoutDate;
    if (isFutureDate(dateKey)) {
        if (!confirm(`Save this workout plan for ${formatDateKey(dateKey)}?`))
            return;
        state.plannedWorkouts = state.plannedWorkouts || {};
        state.plannedWorkouts[dateKey] = { dateKey, exercises, notes: $('sessionNotes').value || '' };
        state.drafts[dateKey] = { workout: snapshotWorkout(), notes: $('sessionNotes').value || '' };
        save();
        renderAll();
        switchPage('history');
        toast('Workout plan saved');
        return;
    }
    if (!confirm(`Save this session? ${completedSets} of ${totalSets} sets completed.`))
        return;
    exercises.forEach(ex => state.lastValues[ex.id] = ex.sets.map(set => ({ weight: set.weight, reps: set.reps })));
    state.history.push({ date: formatDateKey(dateKey), dateKey, iso: dateFromKey(dateKey).toISOString(), exercises, completedSets, notes: $('sessionNotes').value || '' });
    delete state.plannedWorkouts?.[dateKey];
    delete state.drafts?.[dateKey];
    state.notes = '';
    $('sessionNotes').value = '';
    state.workout = state.workout.map(ex => ({ ...ex, setsData: ex.setsData.map(set => ({ ...set, done: false })) }));
    save();
    renderAll();
    switchPage('history');
    toast('Workout saved to history');
}
function editHistoryEntry(index) {
    const entry = state.history[index];
    if (!entry)
        return;
    const exercises = entry.exercises || [];
    const body = `<div class="field"><label>Workout date</label><input id="historyEditDate" type="date" value="${esc(dateKeyFromHistory(entry))}"></div><div class="field"><label>Session notes</label><textarea id="historyEditNotes" rows="2">${esc(entry.notes || '')}</textarea></div>${exercises.map((ex, ei) => `<section class="panel"><div class="field"><label>Exercise name</label><input id="historyExName${ei}" value="${esc(ex.name)}"></div>${(ex.sets || []).map((set, si) => `<div class="field-grid history-edit-set"><div class="field"><label>Set ${si + 1} weight (kg)</label><input id="historyWeight${ei}_${si}" type="number" min="0" step="0.5" value="${esc(set.weight)}"></div><div class="field"><label>${ex.unit === 'sec' ? 'Seconds' : 'Reps'}</label><input id="historyReps${ei}_${si}" type="number" min="0" step="1" value="${esc(set.reps)}"></div></div><label><input id="historyDone${ei}_${si}" type="checkbox" style="width:auto" ${set.done ? 'checked' : ''}> Set completed</label>`).join('')}</section>`).join('')}<div class="btnrow"><button id="saveHistoryEdit" class="primary">Save changes</button><button id="cancelHistoryEdit">Cancel</button></div>`;
    openModal('Edit history entry', body);
    $('cancelHistoryEdit').onclick = closeModal;
    $('saveHistoryEdit').onclick = () => { const dateKey = $('historyEditDate').value || dateKeyFromHistory(entry); entry.dateKey = dateKey; entry.date = formatDateKey(dateKey); entry.iso = dateFromKey(dateKey).toISOString(); entry.notes = $('historyEditNotes').value; entry.exercises.forEach((ex, ei) => { ex.name = $(`historyExName${ei}`).value.trim() || ex.name; ex.sets.forEach((set, si) => { set.weight = Math.max(0, Number($(`historyWeight${ei}_${si}`).value) || 0); set.reps = Math.max(0, Number($(`historyReps${ei}_${si}`).value) || 0); set.done = $(`historyDone${ei}_${si}`).checked; }); }); entry.completedSets = entry.exercises.reduce((total, ex) => total + ex.sets.filter(set => set.done).length, 0); save(); renderHistory(); closeModal(); toast('History entry updated'); };
}
function newCustom() {
    openModal('Create exercise', `<div class="field"><label>Exercise name</label><input id="customName" placeholder="e.g. Cable kickback"></div><div class="field"><label>Category</label><select id="customCategory"><option>Lower body</option><option>Upper body</option><option>Core</option><option>Full body</option></select></div><div class="field-grid"><div class="field"><label>Default sets</label><input id="customSets" type="number" min="1" max="10" value="3"></div><div class="field"><label>Default reps</label><input id="customReps" type="number" min="1" value="10"></div></div><button class="primary wide" id="createCustom">Create exercise</button>`);
    $('createCustom').onclick = () => {
        let name = $('customName').value.trim();
        if (!name) {
            toast('Enter an exercise name');
            return;
        }
        let id = 'custom-' + Date.now();
        state.library.push({ id, name, category: $('customCategory').value, sets: Math.max(1, +$('customSets').value || 3), reps: Math.max(1, +$('customReps').value || 10), weight: 0, rest: 90, fav: false, custom: true });
        saveCurrentDraft();
        renderAll();
        closeModal();
        toast('Exercise created');
        addExercise(id);
    };
}
$('exerciseList').addEventListener('input', e => {
    let t = e.target;
    if (!t.dataset.field)
        return;
    let ex = state.workout[+t.dataset.i], s = ex?.setsData[+t.dataset.s];
    if (!s)
        return;
    if (t.dataset.field === 'done') {
        s.done = t.checked;
        t.closest('.set-row').classList.toggle('done', t.checked);
        saveCurrentDraft();
        renderWorkout();
        return;
    }
    s[t.dataset.field] = Math.max(0, +t.value || 0);
    state.lastValues[ex.id] = ex.setsData.map(x => ({ weight: x.weight, reps: x.reps }));
    saveCurrentDraft();
});
$('exerciseList').addEventListener('click', e => {
    let b = e.target.closest('button[data-action]');
    if (!b)
        return;
    let i = +b.dataset.i, ex = state.workout[i];
    if (!ex && b.dataset.action !== 'drag')
        return;
    if (b.dataset.action === 'more') {
        openModal(ex.name, `<div class="field"><label>Exercise name</label><input id="editName" value="${esc(ex.name)}"></div><div class="field"><label>Category</label><select id="editCategory">${['Lower body', 'Upper body', 'Core', 'Full body'].map(c => `<option ${ex.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div><div class="field-grid"><div class="field"><label>Sets</label><input id="editSets" type="number" min="1" max="15" value="${ex.setsData.length}"></div><div class="field"><label>Default reps</label><input id="editReps" type="number" min="1" value="${ex.reps}"></div></div><div class="btnrow"><button class="primary" id="applyEdit">Save settings</button><button class="danger" id="deleteExercise">Delete</button></div>`);
        $('applyEdit').onclick = () => {
            ex.name = $('editName').value.trim() || ex.name;
            ex.category = $('editCategory').value;
            let n = Math.max(1, Math.min(15, +$('editSets').value || 1));
            while (ex.setsData.length < n)
                ex.setsData.push({ weight: ex.setsData.at(-1)?.weight || 0, reps: +$('editReps').value || 10, done: false });
            while (ex.setsData.length > n)
                ex.setsData.pop();
            ex.reps = +$('editReps').value || 10;
            let lib = state.library.find(x => x.id === ex.id);
            if (lib)
                Object.assign(lib, { name: ex.name, category: ex.category, sets: n, reps: ex.reps });
            saveCurrentDraft();
            renderAll();
            closeModal();
        };
        $('deleteExercise').onclick = () => {
            if (confirm(`Delete ${ex.name} from this workout?`)) {
                state.workout.splice(i, 1);
                saveCurrentDraft();
                renderAll();
                closeModal();
            }
        };
    }
});
$('libraryList').addEventListener('click', e => {
    let b = e.target.closest('button[data-lib-action]');
    if (!b)
        return;
    let ex = state.library.find(x => x.id === b.dataset.id);
    if (!ex)
        return;
    if (b.dataset.libAction === 'add')
        addExercise(ex.id);
});
$('exerciseList').addEventListener('change', e => {
    if (e.target.dataset.field === 'done')
        save();
});
document.querySelectorAll('.tab').forEach(b => b.onclick = () => switchPage(b.dataset.page));
$('addExerciseBtn').onclick = () => { switchPage('library'); $('searchExercise').focus(); };
$('newExerciseBtn').onclick = newCustom;
$('searchExercise').oninput = renderLibrary;
$('libraryFilter').onchange = renderLibrary;
$('modalClose').onclick = closeModal;
$('modalBack').onclick = e => {
    if (e.target === $('modalBack'))
        closeModal();
};
$('timerToggle').onclick = () => {
    if (timer.active) {
        timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
        stopTimer();
    }
    else
        startTimer(timer.remaining || 90);
};
$('timerReset').onclick = () => setTimer(90);
$('timerMinus').onclick = () => setTimer(Math.max(0, timer.remaining - 15));
$('timerPlus').onclick = () => setTimer(Math.min(900, timer.remaining + 15));
$('finishBtn').onclick = finishSession;
$('saveTemplateBtn').onclick = saveTemplate;
function loadBaseTemplate() { state.workout = makeWorkout(state.templateIds); saveCurrentDraft(); renderAll(); switchPage('workout'); toast('Favourite workout loaded'); }
$('sessionNotes').oninput = saveCurrentDraft;
$('workoutDatePicker').onchange = () => {
    const next = $('workoutDatePicker').value;
    if (!next)
        return;
    saveCurrentDraft();
    loadDateWorkout(next);
};
$('todayBtn').onclick = () => { saveCurrentDraft(); loadDateWorkout(localDateKey()); };
$('historyList').addEventListener('click', e => {
    const details = e.target.closest('button[data-history]');
    if (details) {
        $('hist' + details.dataset.history).classList.toggle('open');
        return;
    }
    const edit = e.target.closest('button[data-edit-history]');
    if (edit) {
        editHistoryEntry(Number(edit.dataset.editHistory));
        return;
    }
    const remove = e.target.closest('button[data-delete-history]');
    if (remove) {
        const index = Number(remove.dataset.deleteHistory);
        if (confirm('Delete this workout history entry?')) {
            state.history.splice(index, 1);
            save();
            renderHistory();
            toast('History entry deleted');
        }
        return;
    }
    const loadPlan = e.target.closest('button[data-load-plan]');
    if (loadPlan) {
        saveCurrentDraft();
        loadDateWorkout(loadPlan.dataset.loadPlan);
        switchPage('workout');
        return;
    }
    const deletePlan = e.target.closest('button[data-delete-plan]');
    if (deletePlan) {
        const date = deletePlan.dataset.deletePlan;
        if (confirm(`Delete the planned workout for ${formatDateKey(date)}?`)) {
            delete state.plannedWorkouts[date];
            delete state.drafts[date];
            save();
            renderHistory();
            toast('Planned workout deleted');
        }
    }
});
$('clearHistory').onclick = () => {
    if (confirm('Delete all workout history from this device? This cannot be undone unless you exported a backup.')) {
        state.history = [];
        save();
        renderHistory();
        toast('History cleared');
    }
};
$('exportBtn').onclick = () => { let blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'setlist-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); URL.revokeObjectURL(url); toast('Backup exported'); };
// Favourite template menu and editing
$('templateMenuBtn').onclick = () => { $('templateMenu').hidden = !$('templateMenu').hidden; };
document.addEventListener('click', e => {
    if (!e.target.closest('.menu-wrap'))
        $('templateMenu').hidden = true;
});
$('editTemplateBtn').onclick = () => openTemplateEditor();
function openTemplateEditor() { $('templateMenu').hidden = true; editorSelectedIds = [...(state.templateIds || [])]; $('editorTemplateName').value = state.templateName || ''; $('editorTemplateDescription').value = state.templateDescription || ''; $('editorSearch').value = ''; $('editorFilter').value = 'all'; renderTemplateEditor(); switchPage('templateEditor'); }
function renderTemplateEditor() { const selected = new Set(editorSelectedIds); const query = $('editorSearch').value.trim().toLowerCase(); const filter = $('editorFilter').value; const items = state.library.filter(ex => (ex.name.toLowerCase().includes(query) || ex.category.toLowerCase().includes(query)) && (filter === 'all' || ex.category === filter)); $('editorExerciseCount').textContent = `${selected.size} selected`; $('templateEditorList').innerHTML = items.map(ex => `<div class="editor-exercise"><div class="editor-name"><b>${esc(ex.name)}</b></div><button class="${selected.has(ex.id) ? 'remove' : ''}" data-template-toggle="${esc(ex.id)}" aria-label="${selected.has(ex.id) ? 'Remove' : 'Add'} ${esc(ex.name)}">${selected.has(ex.id) ? '−' : '+'}</button></div>`).join('') || '<div class="empty">No exercises match your search.</div>'; }
$('templateEditorList').addEventListener('click', e => {
    const button = e.target.closest('button[data-template-toggle]');
    if (!button)
        return;
    const id = button.dataset.templateToggle;
    const ids = new Set(editorSelectedIds);
    if (ids.has(id))
        ids.delete(id);
    else
        ids.add(id);
    editorSelectedIds = state.library.filter(ex => ids.has(ex.id)).map(ex => ex.id);
    renderTemplateEditor();
});
$('editorSearch').oninput = renderTemplateEditor;
$('editorFilter').onchange = renderTemplateEditor;
$('saveTemplateEdits').onclick = () => {
    const name = $('editorTemplateName').value.trim();
    if (!name) {
        toast('Enter a workout name');
        return;
    }
    state.templateName = name;
    state.templateDescription = $('editorTemplateDescription').value.trim();
    state.templateIds = state.library.filter(ex => editorSelectedIds.includes(ex.id)).map(ex => ex.id);
    save();
    renderAll();
    switchPage('workout');
    toast('Workout plan updated');
};
$('cancelTemplateEdit').onclick = () => switchPage('workout');
$('deleteTemplateBtn').onclick = () => {
    $('templateMenu').hidden = true;
    if (confirm('Delete this favourite workout? Your current workout and history will remain.')) {
        state.templateName = '';
        state.templateDescription = '';
        state.templateIds = [];
        save();
        renderAll();
        toast('Favourite workout deleted');
    }
};
$('resetTemplateBtn').onclick = () => {
    $('templateMenu').hidden = true;
    if (confirm('Reload the current workout from your saved favourite workout?'))
        loadBaseTemplate();
};
// Drag-and-drop exercise ordering (drag the handle or card to reorder)
let dragFrom = null;
$('exerciseList').addEventListener('dragstart', e => {
    const card = e.target.closest('.exercise');
    if (!card)
        return;
    dragFrom = +card.dataset.dragIndex;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try {
        e.dataTransfer.setData('text/plain', String(dragFrom));
    }
    catch (_) { }
});
$('exerciseList').addEventListener('dragover', e => {
    const card = e.target.closest('.exercise');
    if (!card)
        return;
    e.preventDefault();
    document.querySelectorAll('.exercise.drop-target').forEach(x => x.classList.remove('drop-target'));
    card.classList.add('drop-target');
});
$('exerciseList').addEventListener('drop', e => {
    const card = e.target.closest('.exercise');
    if (!card || dragFrom === null)
        return;
    e.preventDefault();
    const to = +card.dataset.dragIndex;
    const moved = state.workout.splice(dragFrom, 1)[0];
    state.workout.splice(to, 0, moved);
    dragFrom = null;
    saveCurrentDraft();
    renderWorkout();
});
$('exerciseList').addEventListener('dragend', () => { dragFrom = null; document.querySelectorAll('.exercise.dragging,.exercise.drop-target').forEach(x => x.classList.remove('dragging', 'drop-target')); });
let pointerDragFrom = null, pointerDragging = false;
$('exerciseList').addEventListener('pointerdown', e => {
    const handle = e.target.closest('.drag-handle');
    if (!handle)
        return;
    const card = handle.closest('.exercise');
    if (!card)
        return;
    pointerDragFrom = +card.dataset.dragIndex;
    pointerDragging = false;
    try {
        handle.setPointerCapture(e.pointerId);
    }
    catch (_) { }
});
$('exerciseList').addEventListener('pointermove', e => {
    if (pointerDragFrom === null)
        return;
    const card = document.elementFromPoint(e.clientX, e.clientY)?.closest('.exercise');
    if (!card)
        return;
    pointerDragging = true;
    document.querySelectorAll('.exercise.drop-target').forEach(x => x.classList.remove('drop-target'));
    card.classList.add('drop-target');
});
$('exerciseList').addEventListener('pointerup', e => {
    if (pointerDragFrom === null)
        return;
    const from = pointerDragFrom;
    pointerDragFrom = null;
    if (!pointerDragging)
        return;
    const card = document.elementFromPoint(e.clientX, e.clientY)?.closest('.exercise');
    document.querySelectorAll('.exercise.drop-target').forEach(x => x.classList.remove('drop-target'));
    if (!card)
        return;
    const to = +card.dataset.dragIndex;
    if (from === to)
        return;
    const moved = state.workout.splice(from, 1)[0];
    state.workout.splice(to, 0, moved);
    saveCurrentDraft();
    renderWorkout();
});
$('exerciseList').addEventListener('pointercancel', () => { pointerDragFrom = null; document.querySelectorAll('.exercise.drop-target').forEach(x => x.classList.remove('drop-target')); });
load();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { }));
}
