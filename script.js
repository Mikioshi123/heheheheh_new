document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = 'https://wvigsckjnuogezigsnrp.supabase.co'; 
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aWdzY2tqbnVvZ2V6aWdzbnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTU3MjEsImV4cCI6MjA3MDQ3MTcyMX0.rc6flmYgpC5DMVGcK-eU_2XDj_TOxBOrR-3mIgnASNE';
    
    const app = document.getElementById('appContainer');
    const tg = window.Telegram.WebApp;
    tg.ready();
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
        app.innerHTML = `<p>Проводим финальную диагностику...</p>`;
        const user = tg.initDataUnsafe?.user;
        if (!user) throw new Error("Запустите приложение через Telegram.");

        const { data, error } = await supabaseClient.functions.invoke('check-and-add-employee', { body: { user } });

        if (error) {
            // Если функция вернула ошибку, пытаемся прочитать отчет из тела ошибки
            const errorBody = await error.context.json();
            app.innerHTML = `<h2 style="color: red;">Тест провален. Ошибка: ${error.message}</h2><pre>${JSON.stringify(errorBody, null, 2)}</pre>`;
        } else {
            // Если функция вернула успешный ответ
             app.innerHTML = `<h2 style="color: green;">Тест завершен!</h2><p>Отладочный отчет от сервера:</p><pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
    } catch (e) {
        app.innerHTML = `<p style="color: red;">Критическая ошибка: ${e.message}</p>`;
    }
});
