let deferredPrompt;
const installButton = document.createElement('button');
installButton.classList.add('install-button');
installButton.style.display = 'none';
installButton.textContent = 'Install App';

// Check if the app is already installed
if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('App is already installed');
} else {
    document.body.appendChild(installButton);
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installButton.style.display = 'block';
});

installButton.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
        deferredPrompt = null;
        installButton.style.display = 'none';
    }
});

window.addEventListener('appinstalled', () => {
    console.log('App was successfully installed');
    installButton.style.display = 'none';
});

// Add to homescreen for Safari on iOS
const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
};

const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

if (isIos() && !isInStandaloneMode()) {
    const iosInstallMessage = document.createElement('div');
    iosInstallMessage.classList.add('ios-install-message');
    iosInstallMessage.innerHTML = 'Install this app on your iPhone: tap <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABIklEQVR42mNgGAVDHjCSoe8FEL8G4v9A/B6IPZA1k2MBDxD/ROr4/0B8EYi5ybGAH4gvAPEOIFYDYlEgvgTEfGRYIAbEp4H4OxCfAGIJqGHiQHwGiH+RaIEIEB8E4m9AfAmIlaEW8EEt+QbEh4BYhAgLeKEu/QS14BUQGwCxKJIFUkD8CmrBG6gFwkDMCbVEEoj/ALEeEHMB8U+oBXJIFvBCFbwFYk0gdgDiD0CsA8RcQPwDaoE0Ey4vQWOSH4jZoZqWQl3CC8QfgVgViDmA+Ds0bHmYiIyvr9BopQLEbED8BRqW1ICYF4i/QdOEJNQCFiYSExYvNNq+QrPLf2h0SQCxGJJhTEBsQmxBQGyxIQrNjeSUB6OAEQBMxaNG0Q09LwAAAABJRU5ErkJggg=="/> then "Add to Home Screen"';
    document.body.appendChild(iosInstallMessage);
    
    setTimeout(() => {
        iosInstallMessage.style.opacity = '0';
        setTimeout(() => {
            iosInstallMessage.remove();
        }, 300);
    }, 10000);
}