document.addEventListener('DOMContentLoaded', () => {
    
    // --- НАСТРОЙКИ ---
    const SUPABASE_URL = 'https://wvigsckjnuogezigsnrp.supabase.co'; 
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aWdzY2tqbnVvZ2V6aWdzbnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTU3MjEsImV4cCI6MjA3MDQ3MTcyMX0.rc6flmYgpC5DMVGcK-eU_2XDj_TOxBOrR-3mIgnASNE';
    // -----------------

    const appContainer = document.getElementById('appContainer');
    const tg = window.Telegram.WebApp;
    tg.ready();

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    let currentUser;
    let objectionsData = [];
    let userPersonalData = { notes: {}, ratings: {} };
    let currentFilter = 'all';
    let currentSearchTerm = '';

    async function main() {
        showLoader("Проверка доступа...");
        currentUser = tg.initDataUnsafe?.user;
        if (!currentUser?.id) {
            showError("Не удалось определить пользователя. Пожалуйста, запустите приложение через Telegram.");
            return;
        }

        try {
            // ШАГ 1: Авторизация через единственную Edge Function
            const { data: authData, error: authError } = await supabaseClient.functions.invoke('check-and-add-employee', { body: { user: currentUser } });
            if (authError || !authData.accessGranted) throw new Error(authData.reason || "Доступ запрещен");

            showLoader("Загрузка данных...");
            
            // ШАГ 2: Все остальные данные грузим напрямую из базы
            const [objectionsRes, notesRes, ratingsRes] = await Promise.all([
                supabaseClient.from('objections').select('*'),
                supabaseClient.from('notes').select('*, employee:employees(first_name)'),
                supabaseClient.from('ratings').select('*, employee:employees(first_name)')
            ]);

            if (objectionsRes.error) throw objectionsRes.error;
            if (notesRes.error) throw notesRes.error;
            if (ratingsRes.error) throw ratingsRes.error;
            
            objectionsData = objectionsRes.data;
            processPersonalData(notesRes.data, ratingsRes.data); // Обрабатываем заметки и рейтинги

            renderMainInterface(currentUser.first_name);
            performSearchAndRender();

        } catch (error) {
            console.error(error);
            showError(`Произошла критическая ошибка: ${error.message}`);
        }
    }

    function processPersonalData(notes, ratings) {
        const notesMap = {};
        notes.forEach(note => {
            if (!notesMap[note.objection_id]) notesMap[note.objection_id] = [];
            notesMap[note.objection_id].push({ text: note.note_text, author: note.employee?.first_name || 'Аноним', authorId: note.employee_id });
        });
        const ratingsMap = {};
        ratings.forEach(rating => {
            if (!ratingsMap[rating.objection_id]) ratingsMap[rating.objection_id] = [];
            ratingsMap[rating.objection_id].push({ value: rating.rating_value, author: rating.employee?.first_name || 'Аноним', authorId: rating.employee_id });
        });
        userPersonalData = { notes: notesMap, ratings: ratingsMap };
    }

    // --- (renderMainInterface, renderResults, setup...Listeners - без изменений) ---
    // ...

    async function saveData(objectionId, noteText, ratingValue) {
        try {
            // Сохраняем/обновляем напрямую (upsert)
            const { error: noteError } = await supabaseClient.from('notes').upsert({ employee_id: currentUser.id, objection_id: objectionId, note_text: noteText });
            const { error: ratingError } = await supabaseClient.from('ratings').upsert({ employee_id: currentUser.id, objection_id: objectionId, rating_value: ratingValue });
            
            if (noteError) throw noteError;
            if (ratingError) throw ratingError;

            tg.showAlert('Ваш отзыв сохранен!');
            await refreshPersonalData();
            performSearchAndRender();
        } catch (error) {
            console.error("Failed to save data:", error);
            tg.showAlert(`Ошибка сохранения: ${error.message}`);
        }
    }

    async function deleteData(objectionId) {
        try {
            // Удаляем напрямую
            await supabaseClient.from('notes').delete().match({ employee_id: currentUser.id, objection_id: objectionId });
            await supabaseClient.from('ratings').delete().match({ employee_id: currentUser.id, objection_id: objectionId });
            tg.showAlert('Ваш отзыв удален.');
            await refreshPersonalData();
            performSearchAndRender();
        } catch (error) {
            console.error("Failed to delete data:", error);
            tg.showAlert(`Ошибка удаления: ${error.message}`);
        }
    }
    
    async function submitFeedback() {
        // ... (код submitFeedback остается прежним, но вызывает submit-feedback)
        try {
            // Если вы хотите сохранять в базу напрямую, а не через функцию:
            // const { error } = await supabaseClient.from('feedback').insert({ employee_id: currentUser.id, search_query: searchTerm, comment: comment });
            // if (error) throw error;
            // Но лучше оставить вызов функции, чтобы она могла отправлять уведомление в TG
            await supabaseClient.functions.invoke('submit-feedback', { body: { userId: currentUser.id, searchQuery: searchTerm, comment: comment, user: currentUser } });
            // ...
        } catch (error) { /* ... */ }
    }

    async function refreshPersonalData() {
        const [notesRes, ratingsRes] = await Promise.all([
            supabaseClient.from('notes').select('*, employee:employees(first_name)'),
            supabaseClient.from('ratings').select('*, employee:employees(first_name)')
        ]);
        if (notesRes.data && ratingsRes.data) {
            processPersonalData(notesRes.data, ratingsRes.data);
        }
    }
    
    // Вставляем полный код всех остальных функций...
    function showLoader(text) { appContainer.innerHTML = `<div class="loader">${text}</div>`; }
    function showError(text) { appContainer.innerHTML = `<div class="error-screen"><h3>Ошибка</h3><p>${text}</p></div>`; }
    function renderMainInterface(userName) { if (tg.colorScheme) { document.body.className = tg.colorScheme; } appContainer.innerHTML = `<h1>Привет, ${userName}!</h1><p>Поиск по возражениям</p><div class="controls"><input type="text" id="searchInput" placeholder="Введите ключевое слово для поиска..."><div class="filters"><button class="filter-btn active" data-filter="all">Все</button><button class="filter-btn" data-filter="Упаковка">Упаковка</button><button class="filter-btn" data-filter="Брокеридж">Брокеридж</button></div></div><div id="resultsContainer"></div>`; setupStaticEventListeners(); }
    function renderResults(results) { const resultsContainer = document.getElementById('resultsContainer'); resultsContainer.innerHTML = ''; if (!results || results.length === 0) { const searchTerm = currentSearchTerm; resultsContainer.innerHTML = `<div class="not-found-container"><p>По запросу "<strong>${searchTerm}</strong>" ничего не найдено.</p><textarea id="feedback-comment" class="note-input" placeholder="Предложите свой вариант отработки или опишите, что искали..."></textarea><button class="action-btn" id="feedback-submit-btn">Отправить на доработку</button></div>`; document.getElementById('feedback-submit-btn')?.addEventListener('click', submitFeedback); return; } results.forEach(item => { const record = item.item ? item.item : item; const card = document.createElement('div'); card.className = 'item-card'; const objectionNotes = userPersonalData.notes[record.id] || []; const objectionRatings = userPersonalData.ratings[record.id] || []; const currentUserRatingObj = objectionRatings.find(r => r.authorId === currentUser.id); const currentUserNoteObj = objectionNotes.find(n => n.authorId === currentUser.id); const currentUserRating = currentUserRatingObj?.value || 0; const currentUserNote = currentUserNoteObj?.text || ''; const othersNotesHTML = objectionNotes.filter(n => n.authorId !== currentUser.id).map(n => `<div class="note-item"><div class="note-author">${n.author || 'Аноним'} написал:</div><div class="note-text">${(n.text || '').replace(/\n/g, '<br>')}</div></div>`).join(''); const averageRating = objectionRatings.length > 0 ? Math.round(objectionRatings.reduce((sum, r) => sum + r.value, 0) / objectionRatings.length) : 0; card.innerHTML = `<h3>${record.question} <span class="category-badge">${record.category}</span></h3><p>${record.answer ? record.answer.replace(/\n/g, '<br>') : ''}</p><div class="user-interaction"><h4>Ваш отзыв:</h4><div class="rating-stars" data-objection-id="${record.id}">${[1, 2, 3, 4, 5].map(star => `<span class="star ${star <= currentUserRating ? 'filled' : ''}" data-value="${star}">★</span>`).join('')}</div><textarea class="note-input" data-objection-id="${record.id}" placeholder="Ваша личная заметка...">${currentUserNote}</textarea><div class="card-actions"><button class="action-btn" data-action="save" data-id="${record.id}">Подтвердить</button>${(currentUserRatingObj || currentUserNoteObj) ? `<button class="action-btn delete" data-action="delete" data-id="${record.id}">Удалить мой отзыв</button>` : ''}</div></div><div class="public-feedback"><h4>Отзывы команды:</h4><div class="average-rating">Общий рейтинг: ${[1, 2, 3, 4, 5].map(star => `<span class="star small ${star <= averageRating ? 'filled' : ''}">★</span>`).join('')} (${objectionRatings.length} оценок)</div><div class="notes-list">${othersNotesHTML.length > 0 ? othersNotesHTML : '<p class="no-feedback">Пока нет других заметок.</p>'}</div></div>`; resultsContainer.appendChild(card); }); setupCardInteractionListeners(); }
    async function submitFeedback() { const searchInput = document.getElementById('searchInput'); const commentInput = document.getElementById('feedback-comment'); const submitButton = document.getElementById('feedback-submit-btn'); const searchTerm = searchInput.value; const comment = commentInput.value; if (!comment || comment.trim() === '') { tg.showAlert('Пожалуйста, заполните поле для отзыва.'); return; } submitButton.disabled = true; submitButton.textContent = 'Отправка...'; try { await supabaseClient.functions.invoke('submit-feedback', { body: { userId: currentUser.id, searchQuery: searchTerm, comment: comment, user: currentUser } }); const notFoundContainer = document.querySelector('.not-found-container'); if (notFoundContainer) { notFoundContainer.innerHTML = '<p>✅ Спасибо! Ваш отзыв отправлен.</p>'; } } catch (error) { console.error("Failed to submit feedback:", error); tg.showAlert('Произошла ошибка при отправке.'); submitButton.disabled = false; submitButton.textContent = 'Отправить на доработку'; } }
    function setupCardInteractionListeners() { document.querySelectorAll('.rating-stars').forEach(starsContainer => { starsContainer.addEventListener('click', (e) => { if (e.target.classList.contains('star')) { const ratingValue = parseInt(e.target.dataset.value); starsContainer.querySelectorAll('.star').forEach(star => { star.classList.toggle('filled', parseInt(star.dataset.value) <= ratingValue); }); } }); }); document.querySelectorAll('.action-btn[data-action]').forEach(button => { button.addEventListener('click', (e) => { const objectionId = parseInt(e.target.dataset.id); const action = e.target.dataset.action; if (action === 'save') { const noteInput = document.querySelector(`.note-input[data-objection-id="${objectionId}"]`); const starsContainer = document.querySelector(`.rating-stars[data-objection-id="${objectionId}"]`); const rating = starsContainer.querySelectorAll('.star.filled').length; saveData(objectionId, noteInput.value, rating); } else if (action === 'delete') { tg.showConfirm('Вы уверены, что хотите удалить свой отзыв?', (confirmed) => { if (confirmed) { deleteData(objectionId); } }); } }); }); }
    function setupStaticEventListeners() { const searchInput = document.getElementById('searchInput'); const filterButtons = document.querySelectorAll('.filter-btn'); searchInput.addEventListener('input', (e) => { currentSearchTerm = e.target.value; performSearchAndRender(); }); filterButtons.forEach(button => { button.addEventListener('click', (e) => { filterButtons.forEach(btn => btn.classList.remove('active')); e.target.classList.add('active'); currentFilter = e.target.dataset.filter; performSearchAndRender(); }); }); }
    function performSearchAndRender() { let results = objectionsData; if (currentFilter !== 'all') { results = results.filter(item => item.category === currentFilter); } if (currentSearchTerm.trim().length >= 3) { const fuseOptions = { keys: ['question'], threshold: 0.0, minMatchCharLength: 3, useExtendedSearch: true, ignoreLocation: true }; const fuseInstance = new Fuse(results, fuseOptions); const extendedSearchTerm = currentSearchTerm.split(' ').filter(word => word.length >= 3).map(word => `'${word}`).join(' | '); results = fuseInstance.search(extendedSearchTerm); } renderResults(results); }

    main();
});
