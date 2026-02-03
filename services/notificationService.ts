
export const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
        console.warn("Trình duyệt không hỗ trợ thông báo.");
        return;
    }
    if (Notification.permission === "default") {
        await Notification.requestPermission();
    }
};

export const sendBrowserNotification = (title: string, body: string, icon?: string) => {
    if (Notification.permission === "granted") {
        const options: any = {
            body,
            icon: icon || '/favicon.ico', // Replace with your app icon
            vibrate: [200, 100, 200],
            tag: 'finance-pro-notification',
            renotify: true
        };
        new Notification(title, options);
        
        // Play sound
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.log("Audio play blocked", e));
        } catch (e) {
            // Ignore audio error
        }
    }
};
