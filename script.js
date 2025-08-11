document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = 'https://wvigsckjnuogezigsnrp.supabase.co'; 
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aWdzY2tqbnVvZ2V6aWdzbnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTU3MjEsImV4cCI6MjA3MDQ3MTcyMX0.rc6flmYgpC5DMVGcK-eU_2XDj_TOxBOrR-3mIgnASNE';
    
    const app = document.getElementById('appContainer');
    const tg = window.Telegram.WebApp;
    tg.ready();
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
        app.innerHTML = `<p>Проверка доступа...</p>`;
        const user = tg.initDataUnsafe?.user;
        if (!user) throw new Error("Запустите приложение через Telegram.");

        // --- ЛОГИКА АВТОРИЗАЦИИ БЕЗ EDGE FUNCTIONS ---
        // 1. Пытаемся получить запись о пользователе
        let { data: employee, error: selectError } = await supabaseClient
            .from('employees')
            .select('*')
            .eq('telegram_id', user.id)
            .single();

        // 2. Если пользователя нет, создаем его
        if (selectError && selectError.code === 'PGRST116') { // Код ошибки "не найдено"
            const { data: newEmployee, error: insertError } = await supabaseClient
                .from('employees')
                .insert({ telegram_id: user.id, first_name: user.first_name, is_active: true })
                .select()
                .single();
            if (insertError) throw insertError;
            employee = newEmployee;
        } else if (selectError) {
            throw selectError;
        }
        
        // 3. Проверяем, активен ли пользователь
        if (!employee.is_active) {
            throw new Error("Доступ запрещен: аккаунт неактивен.");
        }
        // --- КОНЕЦ ЛОГИКИ АВТОРИЗАЦИИ ---

        app.innerHTML = `<p>Загрузка возражений...</p>`;
        const { data: objections, error: objectionsError } = await supabaseClient
            .from('objections')
            .select('*');
        if (objectionsError) throw objectionsError;

        app.innerHTML = `<h1>База знаний</h1>`;
        objections.forEach(obj => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `<h3>${obj.question}</h3><p>${obj.answer}</p>`;
            app.appendChild(card);
        });

    } catch (e) {
        app.innerHTML = `<p style="color: red;">Ошибка: ${e.message}</p>`;
    }
});
