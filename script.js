document.addEventListener('DOMContentLoaded', async () => {
    // --- НАСТРОЙКИ ---
    // 🔴 Не забудьте вставить ваши URL и ключ!
    const SUPABASE_URL = 'https://wvigsckjnuogezigsnrp.supabase.co'; 
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aWdzY2tqbnVvZ2V6aWdzbnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTU3MjEsImV4cCI6MjA3MDQ3MTcyMX0.rc6flmYgpC5DMVGcK-eU_2XDj_TOxBOrR-3mIgnASNE';
    // -----------------

    const appContainer = document.getElementById('appContainer');
    appContainer.innerHTML = `<h1>Проводим финальную диагностику...</h1>`;
    const tg = window.Telegram.WebApp;
    tg.ready();

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
        console.log("Вызываем функцию 'check-employee'...");
        const user = tg.initDataUnsafe?.user;
        if (!user) throw new Error("Запустите приложение через Telegram.");
        
        // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
        // Вызываем функцию с новым именем 'check-employee'
        const { data, error } = await supabaseClient.functions.invoke('check-employee', {
            body: { user }
        });
        // --- КОНЕЦ ИЗМЕНЕНИЯ ---

        if (error) {
            // Если функция вернула ошибку, пытаемся прочитать отчет из тела ошибки
            let errorBody = {};
            try {
                errorBody = await error.context.json();
            } catch (e) {
                // Игнорируем ошибку парсинга, если тело не JSON
            }
            appContainer.innerHTML = `<h2 style="color: red;">Тест провален. Ошибка: ${error.message}</h2><pre>${JSON.stringify(errorBody, null, 2)}</pre>`;
            console.error("Test failed:", error);
        } else {
            // Если функция вернула успешный ответ
             appContainer.innerHTML = `<h2 style="color: green;">Тест завершен!</h2><p>Отладочный отчет от сервера:</p><pre>${JSON.stringify(data, null, 2)}</pre>`;
             console.log("Server response:", data);
        }
    } catch (e) {
        appContainer.innerHTML = `<p style="color: red;">Критическая ошибка: ${e.message}</p>`;
        console.error("Critical error:", e);
    }
});
    main();
});
